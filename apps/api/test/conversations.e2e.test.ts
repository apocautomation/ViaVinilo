import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./test-db";

let app: INestApplication;
let prisma: PrismaClient;
let stopDb: () => Promise<void>;
const tokens = { attention: "", production: "", customer: "" };
let customerId = "";
let dtfId = "";

const http = () => request(app.getHttpServer());
const as = (who: keyof typeof tokens) => ({
  get: (url: string) => http().get(url).set("Authorization", `Bearer ${tokens[who]}`),
  post: (url: string, body?: object) => http().post(url).set("Authorization", `Bearer ${tokens[who]}`).send(body),
});

beforeAll(async () => {
  const testDb = await startTestDb();
  stopDb = testDb.stop;
  process.env.DATABASE_URL = testDb.url;
  process.env.JWT_SECRET = "secreto-de-prueba-de-al-menos-32-caracteres";
  const { NestFactory } = await import("@nestjs/core");
  const { AppModule } = await import("../src/app.module");
  const { PrismaService } = await import("../src/prisma/prisma.service");
  const { JwtService } = await import("@nestjs/jwt");
  app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);

  const asesor = await prisma.user.create({ data: { email: "asesor@viavinilo.test", name: "Vero", roles: ["ATTENTION"] } });
  const impresor = await prisma.user.create({ data: { email: "impresor@viavinilo.test", name: "Imp", roles: ["PRODUCTION"] } });
  tokens.attention = await jwt.signAsync({ sub: asesor.id });
  tokens.production = await jwt.signAsync({ sub: impresor.id });

  const dtf = await prisma.sector.create({ data: { code: "DTF", name: "DTF", inboxEmail: "dtf@viavinilo.test" } });
  dtfId = dtf.id;
  const c = await prisma.customer.create({
    data: {
      firstName: "Ana",
      lastName: "Gómez",
      searchText: "ana gomez",
      status: "ACTIVE",
      emails: { create: [{ email: "ana@cliente.test", isPrimary: true }] },
    },
  });
  customerId = c.id;
  tokens.customer = await jwt.signAsync({ sub: c.id, kind: "customer" });
});

afterAll(async () => {
  await app?.close();
  await stopDb?.();
});

describe("Conversaciones: chat de la app y mails en un solo hilo (D-045)", () => {
  it("D-045: el cliente escribe en el Chat de la app y aparece sin leer en la bandeja del ERP", async () => {
    const sent = await as("customer").post("/app/chat", { text: "¿Ya está listo mi pedido?" });
    expect(sent.status).toBe(201);
    expect(sent.body).not.toHaveProperty("authorId");

    const list = await as("attention").get("/conversations?filter=UNREAD");
    expect(list.status).toBe(200);
    const conv = list.body.items[0];
    expect(conv).toMatchObject({ staffUnread: 1, lastChannel: "APP", lastMessagePreview: "¿Ya está listo mi pedido?" });
    expect(conv.customer.firstName).toBe("Ana");

    expect((await as("attention").post(`/conversations/${conv.id}/read`)).status).toBe(200);
    expect((await as("attention").get("/conversations?filter=UNREAD")).body.total).toBe(0);
  });

  it("D-045: el asesor responde por la app y el cliente lo ve en su chat, sin saber quién del equipo fue", async () => {
    const conv = (await as("attention").get("/conversations")).body.items[0];
    const reply = await as("attention").post(`/conversations/${conv.id}/messages`, { text: "Sí, ya lo podés retirar", channel: "APP" });
    expect(reply.status).toBe(201);

    expect((await as("customer").get("/app/chat/unread")).body.unread).toBe(1);
    const thread = await as("customer").get("/app/chat");
    expect(thread.body.messages.map((m: { direction: string; body: string }) => [m.direction, m.body])).toEqual([
      ["IN", "¿Ya está listo mi pedido?"],
      ["OUT", "Sí, ya lo podés retirar"],
    ]);
    expect(JSON.stringify(thread.body)).not.toContain("Vero");
    expect((await as("customer").get("/app/chat/unread")).body.unread).toBe(0);
  });

  it("D-045: la respuesta por mail sale desde la casilla del sector, al que escribió y en el mismo hilo", async () => {
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { customerId } });
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        direction: "IN",
        channel: "MAIL",
        sectorId: dtfId,
        fromEmail: "compras@cliente.test",
        subject: "Logos para gorras",
        body: "Va el archivo",
        mailUid: 777,
        externalKey: "DTF:<x@cliente.test>",
      },
    });
    const reply = await as("attention").post(`/conversations/${conv.id}/messages`, { text: "Sale $ 21.600", channel: "MAIL" });
    expect(reply.status).toBe(201);
    const mail = await prisma.outboundEmail.findFirstOrThrow({ where: { kind: "conversation-reply" } });
    expect(mail).toMatchObject({
      to: "compras@cliente.test",
      subject: "Re: Logos para gorras",
      fromAddress: "dtf@viavinilo.test",
      inReplyToUid: 777,
      status: "PENDING",
    });
    const detail = await as("attention").get(`/conversations/${conv.id}`);
    expect(detail.body.messages.at(-1)).toMatchObject({ direction: "OUT", channel: "MAIL", outboundEmailId: mail.id });
    expect(detail.body.messages.at(-1).author.name).toBe("Vero");
  });

  it("D-045: producción no ve la bandeja y un cliente no puede entrar a la del ERP", async () => {
    expect((await as("production").get("/conversations")).status).toBe(403);
    expect((await as("customer").get("/conversations")).status).toBe(401);
    expect((await as("attention").get("/app/chat")).status).toBe(401);
  });

  it("D-045: a un remitente que todavía no es cliente solo se le puede responder por mail", async () => {
    const conv = await prisma.conversation.create({ data: { contactEmail: "nuevo@grafica.test", contactName: "Nueva" } });
    const app = await as("attention").post(`/conversations/${conv.id}/messages`, { text: "Hola", channel: "APP" });
    expect(app.status).toBe(422);
    const mail = await as("attention").post(`/conversations/${conv.id}/messages`, { text: "Hola, escribinos por WhatsApp", channel: "MAIL" });
    expect(mail.status).toBe(201);
    const out = await prisma.outboundEmail.findFirstOrThrow({ where: { to: "nuevo@grafica.test" } });
    expect(out.fromAddress).toBeNull();
  });

  it("D-045: busca por nombre del cliente o por email", async () => {
    expect((await as("attention").get("/conversations?search=gomez")).body.total).toBe(1);
    expect((await as("attention").get("/conversations?search=nuevo@grafica")).body.total).toBe(1);
  });
});
