import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { simpleParser } from "mailparser";
import { SMTPServer } from "smtp-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./test-db";

const SECRET = "secreto-de-prueba-de-al-menos-32-caracteres";
let app: INestApplication;
let prisma: PrismaClient;
let stopDb: () => Promise<void>;
let smtp: SMTPServer;
const inbox: { to: string; text: string }[] = [];
let staffToken = "";

const http = () => request(app.getHttpServer());

/** Espera el mail que manda la API (el SMTP de prueba lo recibe en otro tick). */
async function lastMailTo(to: string) {
  for (let i = 0; i < 50; i++) {
    const mail = [...inbox].reverse().find((m) => m.to === to);
    if (mail) return mail;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`no llegó ningún mail a ${to}`);
}

const codeFrom = (text: string) => /(\d{6})/.exec(text)?.[1] ?? "";

/** Crea un código directo en la base, como lo haría la API, sin gastar el límite de pedidos. */
async function seedCode(email: string, code: string, opts: { expiresAt?: Date } = {}) {
  const contact = await prisma.customerEmail.findUniqueOrThrow({ where: { email } });
  await prisma.customerLoginCode.create({
    data: {
      customerId: contact.customerId,
      email,
      codeHash: createHmac("sha256", SECRET).update(code).digest("hex"),
      expiresAt: opts.expiresAt ?? new Date(Date.now() + 600_000),
    },
  });
}

async function createCustomer(n: number, status: "ACTIVE" | "PENDING" | "BLOCKED" = "ACTIVE") {
  return prisma.customer.create({
    data: {
      firstName: "Ana",
      lastName: `Gómez ${n}`,
      dni: `3000000${n}`,
      status,
      emails: { create: [{ email: `ana${n}@cliente.test`, isPrimary: true }] },
      phones: { create: [{ phone: `+54938746600${n}`, isPrimary: true }] },
    },
  });
}

beforeAll(async () => {
  smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onData(stream, _session, callback) {
      void simpleParser(stream).then((mail) => {
        inbox.push({ to: mail.to && "text" in mail.to ? mail.to.text : "", text: mail.text ?? "" });
        callback();
      });
    },
  });
  await new Promise<void>((resolve) => smtp.listen(0, "127.0.0.1", resolve));

  const testDb = await startTestDb();
  stopDb = testDb.stop;
  process.env.DATABASE_URL = testDb.url;
  process.env.JWT_SECRET = SECRET;
  process.env.SMTP_URL = `smtp://127.0.0.1:${(smtp.server.address() as AddressInfo).port}`;

  const { NestFactory } = await import("@nestjs/core");
  const { AppModule } = await import("../src/app.module");
  const { PrismaService } = await import("../src/prisma/prisma.service");
  const { JwtService } = await import("@nestjs/jwt");
  app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  prisma = app.get(PrismaService);

  const owner = await prisma.user.create({ data: { email: "duenio@viavinilo.test", name: "Dueño", roles: ["OWNER"] } });
  staffToken = await app.get(JwtService).signAsync({ sub: owner.id });

  for (const n of [1, 2, 3, 4]) await createCustomer(n);
  await createCustomer(5, "PENDING");
});

afterAll(async () => {
  await app?.close();
  await stopDb?.();
  await new Promise<void>((resolve) => smtp?.close(() => resolve()));
  delete process.env.SMTP_URL;
});

describe("ingreso de clientes a la app (D-038)", () => {
  it("D-038: un email que no es de un cliente recibe la misma respuesta, pero no se manda nada", async () => {
    const res = await http().post("/app/auth/request-code").send({ email: "nadie@cliente.test" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sent: true });
    expect(await prisma.customerLoginCode.count({ where: { email: "nadie@cliente.test" } })).toBe(0);
  });

  it("D-038: el cliente activo recibe el código por mail y entra; la sesión no sirve en el ERP", async () => {
    const res = await http().post("/app/auth/request-code").send({ email: "  ANA1@cliente.test " });
    expect(res.status).toBe(200);
    const mail = await lastMailTo("ana1@cliente.test");
    const code = codeFrom(mail.text);
    expect(code).toMatch(/^\d{6}$/);

    // El código se guarda hasheado, nunca en claro.
    const stored = await prisma.customerLoginCode.findFirstOrThrow({ where: { email: "ana1@cliente.test" } });
    expect(stored.codeHash).not.toContain(code);

    const login = await http().post("/app/auth/verify").send({ email: "ana1@cliente.test", code });
    expect(login.status).toBe(200);
    expect(login.body.customer.firstName).toBe("Ana");
    expect(login.body.customer).not.toHaveProperty("internalNotes");
    const token = login.body.accessToken as string;

    const me = await http().get("/app/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.notificationPrefs).toEqual({ push: true, email: true });

    expect((await http().get("/customers").set("Authorization", `Bearer ${token}`)).status).toBe(401);
    expect((await http().get("/app/me").set("Authorization", `Bearer ${staffToken}`)).status).toBe(401);

    // Un código ya usado no sirve otra vez.
    expect((await http().post("/app/auth/verify").send({ email: "ana1@cliente.test", code })).status).toBe(401);
  });

  it("D-038: no se manda otro código al mismo email antes de un minuto", async () => {
    await http().post("/app/auth/request-code").send({ email: "ana2@cliente.test" });
    await lastMailTo("ana2@cliente.test");
    await http().post("/app/auth/request-code").send({ email: "ana2@cliente.test" });
    expect(await prisma.customerLoginCode.count({ where: { email: "ana2@cliente.test" } })).toBe(1);
  });

  it("D-038: un alta pendiente no recibe código", async () => {
    const res = await http().post("/app/auth/request-code").send({ email: "ana5@cliente.test" });
    expect(res.status).toBe(200);
    expect(await prisma.customerLoginCode.count({ where: { email: "ana5@cliente.test" } })).toBe(0);
  });

  it("D-038: después de 5 intentos fallidos el código se bloquea, aunque después pongan el bueno", async () => {
    await seedCode("ana3@cliente.test", "123456");
    for (let i = 0; i < 5; i++) {
      const res = await http().post("/app/auth/verify").send({ email: "ana3@cliente.test", code: "000000" });
      expect(res.status).toBe(401);
    }
    const res = await http().post("/app/auth/verify").send({ email: "ana3@cliente.test", code: "123456" });
    expect(res.status).toBe(401);
  });

  it("D-038: un código vencido no sirve", async () => {
    await seedCode("ana4@cliente.test", "654321", { expiresAt: new Date(Date.now() - 1000) });
    const res = await http().post("/app/auth/verify").send({ email: "ana4@cliente.test", code: "654 321" });
    expect(res.status).toBe(401);
  });

  it("D-038: si bloquean al cliente, su sesión deja de servir al instante", async () => {
    await seedCode("ana4@cliente.test", "111222");
    const login = await http().post("/app/auth/verify").send({ email: "ana4@cliente.test", code: "111222" });
    expect(login.status).toBe(200);
    const contact = await prisma.customerEmail.findUniqueOrThrow({ where: { email: "ana4@cliente.test" } });
    await prisma.customer.update({ where: { id: contact.customerId }, data: { status: "BLOCKED" } });
    const me = await http().get("/app/me").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(401);
  });
});

describe("ficha completa del cliente en el ERP (D-038)", () => {
  it("D-038: el alta guarda los datos fiscales, la cuenta corriente y los avisos", async () => {
    const res = await http()
      .post("/customers")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        firstName: "Lucía",
        lastName: "Ruiz",
        dni: "31.222.333",
        emails: ["lucia@estampados.test"],
        phones: ["387 455-1122"],
        businessName: "Estampados Ruiz",
        cuit: "30-50001091-2",
        legalName: "Estampados Ruiz S.R.L.",
        taxCondition: "RESPONSABLE_INSCRIPTO",
        fiscalAddress: "Av. Belgrano 100",
        city: "Salta",
        province: "Salta",
        creditEnabled: true,
        notificationPrefs: { push: true, email: false },
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: "ACTIVE",
      cuit: "30500010912",
      taxCondition: "RESPONSABLE_INSCRIPTO",
      creditEnabled: true,
      notificationPrefs: { push: true, email: false },
    });

    const dup = await http()
      .post("/customers")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        firstName: "Otro",
        lastName: "Cliente",
        dni: "31222444",
        emails: ["otro@x.test"],
        phones: ["387 455-1199"],
        cuit: "30500010912",
      });
    expect(dup.status).toBe(409);
    expect(dup.body.message).toBe("Ya existe un cliente con ese CUIT");
  });
});
