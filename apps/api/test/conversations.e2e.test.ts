import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startTestDb } from "./test-db";

let app: INestApplication;
let prisma: PrismaClient;
const storageDir = mkdtempSync(join(tmpdir(), "vv-api-files-"));
let stopDb: () => Promise<void>;
const tokens = { attention: "", production: "", customer: "", owner: "" };
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
  process.env.STORAGE_DIR = storageDir;
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
  const duena = await prisma.user.create({ data: { email: "duena@viavinilo.test", name: "Dueña", roles: ["OWNER"] } });
  tokens.owner = await jwt.signAsync({ sub: duena.id });

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
  rmSync(storageDir, { recursive: true, force: true });
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

describe("bot del chat de la app (D-056, D-057)", () => {
  const convId = async () => (await prisma.conversation.findUniqueOrThrow({ where: { customerId } })).id;
  const lastIn = () => prisma.message.findFirstOrThrow({ where: { direction: "IN", channel: "APP" }, orderBy: { createdAt: "desc" } });

  it("D-056: arranca apagado en todos los chats: los mensajes no quedan para el bot", async () => {
    const status = await as("attention").get("/conversations/bot");
    expect(status.body).toMatchObject({ chatsWithBot: 0 });
    await as("customer").post("/app/chat", { text: "Hola" });
    expect((await lastIn()).botStatus).toBeNull();
  });

  it("D-057: es individual: prendido en el chat, los mensajes de ese cliente quedan para el bot", async () => {
    const id = await convId();
    expect((await as("attention").post(`/conversations/${id}/bot`, { enabled: true })).body.botEnabled).toBe(true);
    expect((await as("attention").get("/conversations/bot")).body.chatsWithBot).toBe(1);
    await as("customer").post("/app/chat", { text: "¿Y el domingo?" });
    expect((await lastIn()).botStatus).toBe("PENDING");
  });

  it("D-057: 'Apagar en todos' lo apaga de una vez y queda en auditoría", async () => {
    const res = await as("attention").post("/conversations/bot/off");
    expect(res.status).toBe(200);
    expect(res.body.chatsWithBot).toBe(0);
    expect((await prisma.auditLog.findFirst({ where: { action: "bot_off_everywhere" } }))?.after).toEqual({ chats: 1 });
    await as("customer").post("/app/chat", { text: "¿Hay alguien?" });
    expect((await lastIn()).botStatus).toBeNull();
  });

  it("D-058: 'Prender en todos' lo prende en todos los chats de clientes (no en los de quien no es cliente) y queda en auditoría", async () => {
    const res = await as("attention").post("/conversations/bot/on");
    expect(res.status).toBe(200);
    const withCustomer = await prisma.conversation.count({ where: { customerId: { not: null } } });
    expect(res.body.chatsWithBot).toBe(withCustomer);
    expect(await prisma.conversation.count({ where: { customerId: null, botEnabled: true } })).toBe(0);
    expect(await prisma.auditLog.findFirst({ where: { action: "bot_on_everywhere" } })).not.toBeNull();
    await as("attention").post("/conversations/bot/off");
  });

  it("D-056: un chat 'Pide asesor' no le pasa mensajes al bot; cuando responde una persona deja de estar marcado", async () => {
    const id = await convId();
    await prisma.conversation.update({ where: { id }, data: { botEnabled: true, needsHuman: true, needsHumanReason: "Reclamo" } });
    expect((await as("attention").get("/conversations?filter=HUMAN")).body.total).toBe(1);
    await as("customer").post("/app/chat", { text: "¿Hay alguien?" });
    expect((await lastIn()).botStatus).toBeNull();

    await as("attention").post(`/conversations/${id}/messages`, { text: "Hola Ana, te ayudo yo.", channel: "APP" });
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id } })).needsHuman).toBe(false);
    expect((await as("attention").get("/conversations?filter=HUMAN")).body.total).toBe(0);
  });

  it("D-060: los avisos de estado arrancan apagados y solo el dueño los prende", async () => {
    expect((await as("attention").get("/conversations/notices")).body).toEqual({ enabled: false, since: null });
    const put = (who: "attention" | "owner", enabled: boolean) =>
      http().put("/conversations/notices").set("Authorization", `Bearer ${tokens[who]}`).send({ enabled });
    expect((await put("attention", true)).status).toBe(403);
    const on = await put("owner", true);
    expect(on.body.enabled).toBe(true);
    expect(typeof on.body.since).toBe("string");
    expect((await put("owner", false)).body.enabled).toBe(false);
  });

  it("D-061: '/reset' por el chat de la app borra la memoria del bot y responde al toque", async () => {
    const id = await convId();
    await prisma.conversation.update({ where: { id }, data: { needsHuman: true, needsHumanReason: "Reclamo" } });
    const res = await as("customer").post("/app/chat", { text: "/reset" });
    expect(res.status).toBe(201);
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { id } });
    expect(conv.botResetAt).not.toBeNull();
    expect(conv.needsHuman).toBe(false);
    const thread = await as("customer").get("/app/chat");
    expect(thread.body.messages.at(-1)).toMatchObject({ direction: "OUT", body: "Memoria borrada correctamente.", fromBot: true });
    // El mensaje "/reset" no queda para el bot.
    expect((await prisma.message.findFirstOrThrow({ where: { body: "/reset" } })).botStatus).toBeNull();
  });

  it("D-056: el bot no se puede prender en el hilo de alguien que no es cliente", async () => {
    const stranger = await prisma.conversation.findFirstOrThrow({ where: { customerId: null } });
    expect((await as("attention").post(`/conversations/${stranger.id}/bot`, { enabled: true })).status).toBe(422);
  });

  it("D-057: un mail reenviado desde una casilla nuestra se marca del lado del equipo", async () => {
    const id = await convId();
    await prisma.message.create({
      data: { conversationId: id, direction: "IN", channel: "MAIL", sectorId: dtfId, fromEmail: "dtf@viavinilo.test", body: "RV: pedido" },
    });
    const thread = await as("attention").get(`/conversations/${id}`);
    const fwd = thread.body.messages.find((m: { body: string }) => m.body === "RV: pedido");
    expect(fwd.fromStaff).toBe(true);
    expect(thread.body.messages.filter((m: { fromStaff: boolean }) => m.fromStaff)).toHaveLength(1);
  });
});

describe("archivos en Conversaciones (D-062)", () => {
  const pdf = Buffer.from("%PDF-1.4 archivo de prueba");

  it("D-062: el cliente manda su archivo por el chat y se crea el pedido en el tablero del servicio", async () => {
    const res = await http()
      .post("/app/chat/files")
      .set("Authorization", `Bearer ${tokens.customer}`)
      .field("sector", "DTF")
      .field("note", "58 x 100 cm, 2 copias, retiro en San Juan")
      .attach("file", pdf, "Diseño remera.pdf");
    expect(res.status).toBe(201);
    expect(res.body.job.label).toMatch(/^VV-\d+$/);
    const job = await prisma.jobOrder.findUniqueOrThrow({ where: { id: res.body.job.id }, include: { files: true, sector: true } });
    expect(job).toMatchObject({ status: "RECEIVED", source: "API", customerId, description: "58 x 100 cm, 2 copias, retiro en San Juan" });
    expect(job.sector.code).toBe("DTF");
    expect(job.files[0]).toMatchObject({ filename: "Diseño remera.pdf", mime: "application/pdf" });
    // El cliente lo ve en su chat y lo puede descargar.
    const thread = await as("customer").get("/app/chat");
    const msg = thread.body.messages.at(-1);
    expect(msg).toMatchObject({ direction: "IN", jobId: job.id });
    const dl = await http().get(`/app/chat/files/${msg.id}/0`).set("Authorization", `Bearer ${tokens.customer}`).buffer(true);
    expect(dl.status).toBe(200);
    expect(Buffer.from(dl.body).toString()).toBe(pdf.toString());
  });

  it("D-083: el cliente elige dónde retira al mandar el archivo y lo ve en su pedido", async () => {
    const res = await http()
      .post("/app/chat/files")
      .set("Authorization", `Bearer ${tokens.customer}`)
      .field("sector", "DTF")
      .field("note", "58 x 50 cm")
      .field("pickupBranch", "chile")
      .attach("file", pdf, "Remera chile.pdf");
    expect(res.status).toBe(201);
    const job = await prisma.jobOrder.findUniqueOrThrow({ where: { id: res.body.job.id } });
    expect(job.pickupBranch).toBe("chile");
    const mine = await as("customer").get(`/app/jobs/${job.number}`);
    expect(mine.body.pickup).toBe("Av. Chile");
    // Sin elección (app vieja): se muestra la sucursal del servicio.
    await prisma.jobOrder.update({ where: { id: job.id }, data: { pickupBranch: null } });
    expect((await as("customer").get(`/app/jobs/${job.number}`)).body.pickup).toBe("San Juan");
  });

  it("D-062: no acepta archivos que no son de impresión", async () => {
    const res = await http().post("/app/chat/files").set("Authorization", `Bearer ${tokens.customer}`).field("sector", "DTF").attach("file", Buffer.from("x"), "virus.exe");
    expect(res.status).toBe(422);
  });

  it("D-062: el asesor responde con un archivo por mail y queda en la cola con el adjunto", async () => {
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { customerId } });
    const res = await http()
      .post(`/conversations/${conv.id}/files`)
      .set("Authorization", `Bearer ${tokens.attention}`)
      .field("channel", "MAIL")
      .field("text", "Te mando la prueba de color")
      .attach("files", pdf, "prueba.pdf");
    expect(res.status).toBe(201);
    const out = await prisma.outboundEmail.findFirstOrThrow({ where: { text: "Te mando la prueba de color" } });
    expect(out.attachments).toEqual([expect.objectContaining({ name: "prueba.pdf", mime: "application/pdf" })]);
    // Y el asesor lo puede descargar desde el hilo.
    const thread = await as("attention").get(`/conversations/${conv.id}`);
    const sent = thread.body.messages.find((m: { body: string }) => m.body === "Te mando la prueba de color");
    expect((await http().get(`/conversations/${conv.id}/files/${sent.id}/0`).set("Authorization", `Bearer ${tokens.attention}`)).status).toBe(200);
  });

  it("D-086: el archivo del pedido se puede descargar antes de cotizar, para poder cotizarlo", async () => {
    const job = await prisma.jobOrder.findFirstOrThrow({ where: { source: "API", status: "RECEIVED" }, include: { files: true } });
    const ok = await http().get(`/jobs/${job.id}/files/${job.files[0]!.id}`).set("Authorization", `Bearer ${tokens.attention}`).buffer(true);
    expect(ok.status).toBe(200);
    expect(ok.headers["content-disposition"]).toContain("attachment");
  });
});

describe("control de archivo y reenvío por la app (D-065)", () => {
  it("D-065: el paso automático arranca apagado y solo el dueño lo prende", async () => {
    expect((await as("attention").get("/settings/file-check")).body).toEqual({ enabled: false, since: null });
    const put = (who: "attention" | "owner", enabled: boolean) =>
      http().put("/settings/file-check").set("Authorization", `Bearer ${tokens[who]}`).send({ enabled });
    expect((await put("attention", true)).status).toBe(403);
    expect((await put("owner", true)).body.enabled).toBe(true);
    expect(await prisma.auditLog.count({ where: { entity: "AppSetting", entityId: "auto-file-error" } })).toBe(1);
    expect((await put("owner", false)).body.enabled).toBe(false);
  });

  it("D-065: con un pedido en 'Archivo con error', el archivo que manda por el chat se suma a ese pedido y vuelve a 'Archivo recibido'", async () => {
    const job = await prisma.jobOrder.findFirstOrThrow({ where: { source: "API", customerId } });
    await prisma.jobOrder.update({ where: { id: job.id }, data: { status: "FILE_ERROR", fileCheck: { verdict: "error", detail: "x" } } });
    const before = await prisma.jobOrder.count();
    const res = await http()
      .post("/app/chat/files")
      .set("Authorization", `Bearer ${tokens.customer}`)
      .field("sector", "DTF")
      .attach("file", Buffer.from("%PDF-1.4 corregido"), "corregido.pdf");
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ resent: true, job: { id: job.id } });
    expect(await prisma.jobOrder.count()).toBe(before);
    const after = await prisma.jobOrder.findUniqueOrThrow({ where: { id: job.id }, include: { files: true, events: { orderBy: { createdAt: "desc" }, take: 1 } } });
    expect(after.status).toBe("RECEIVED");
    expect(after.fileCheck).toBeNull();
    expect(after.files.map((f) => f.filename)).toContain("corregido.pdf");
    expect(after.events[0]).toMatchObject({ fromStatus: "FILE_ERROR", toStatus: "RECEIVED" });
  });
});
