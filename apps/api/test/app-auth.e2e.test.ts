import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { ThrottlerStorage } from "@nestjs/throttler";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "../src/auth/password";
import { startTestDb } from "./test-db";

let app: INestApplication;
let prisma: PrismaClient;
let stopDb: () => Promise<void>;
let staffToken = "";

const PASSWORD = "clave-app-123";
const http = () => request(app.getHttpServer());
const login = (email: string, password: string) => http().post("/app/auth/login").send({ email, password });
const staff = () => ({
  get: (url: string) => http().get(url).set("Authorization", `Bearer ${staffToken}`),
  post: (url: string, body?: object) => http().post(url).set("Authorization", `Bearer ${staffToken}`).send(body),
});

async function createCustomer(n: number, opts: { status?: "ACTIVE" | "PENDING" | "BLOCKED"; password?: string | null } = {}) {
  const password = opts.password === undefined ? PASSWORD : opts.password;
  return prisma.customer.create({
    data: {
      firstName: "Ana",
      lastName: `Gómez ${n}`,
      dni: `3000000${n}`,
      status: opts.status ?? "ACTIVE",
      appPasswordHash: password ? await hashPassword(password) : null,
      emails: {
        create: [
          { email: `ana${n}@cliente.test`, isPrimary: true },
          { email: `ventas${n}@cliente.test` },
        ],
      },
      phones: { create: [{ phone: `+54938746600${n}`, isPrimary: true }] },
    },
  });
}

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

  const owner = await prisma.user.create({ data: { email: "duenio@viavinilo.test", name: "Dueño", roles: ["OWNER"] } });
  staffToken = await app.get(JwtService).signAsync({ sub: owner.id });

  await createCustomer(1);
  await createCustomer(2, { status: "PENDING" });
  await createCustomer(3, { password: null });
  await createCustomer(4);
});

// Cada test arranca con el límite de intentos por IP en cero; el límite se prueba aparte.
beforeEach(() => {
  const storage = app.get(ThrottlerStorage) as unknown as { storage: Map<string, unknown>; hitExpirations: Map<string, unknown> };
  storage.storage.clear();
  storage.hitExpirations.clear();
});

afterAll(async () => {
  await app?.close();
  await stopDb?.();
});

describe("ingreso de clientes a la app con email y contraseña (D-039)", () => {
  it("D-039: entra con cualquier email de su ficha; la sesión no sirve en el ERP ni la del ERP en la app", async () => {
    const res = await login("  VENTAS1@cliente.test ", PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.customer.firstName).toBe("Ana");
    expect(res.body.customer).not.toHaveProperty("internalNotes");
    expect(JSON.stringify(res.body)).not.toContain("scrypt");
    const token = res.body.accessToken as string;

    const me = await http().get("/app/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.emails).toHaveLength(2);

    expect((await http().get("/customers").set("Authorization", `Bearer ${token}`)).status).toBe(401);
    expect((await http().get("/app/me").set("Authorization", `Bearer ${staffToken}`)).status).toBe(401);
  });

  it("D-039: contraseña mal, email inexistente, alta pendiente o sin contraseña cargada dan el mismo error", async () => {
    const cases = [
      login("ana1@cliente.test", "otra-clave-999"),
      login("nadie@cliente.test", PASSWORD),
      login("ana2@cliente.test", PASSWORD),
    ];
    for (const res of await Promise.all(cases)) {
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Email o contraseña incorrectos");
    }
  });

  it("D-039: un cliente sin contraseña cargada no puede entrar con ninguna", async () => {
    expect((await login("ana3@cliente.test", "")).status).toBe(400);
    expect((await login("ana3@cliente.test", PASSWORD)).status).toBe(401);
  });

  it("D-039: después de 5 intentos en un minuto desde la misma IP, frena", async () => {
    for (let i = 0; i < 5; i++) expect((await login("ana1@cliente.test", "mala-clave-000")).status).toBe(401);
    expect((await login("ana1@cliente.test", PASSWORD)).status).toBe(429);
  });
});

describe("contraseña de la app cargada por el asesor (D-039)", () => {
  it("D-039: el hash nunca sale en las respuestas del ERP ni en la auditoría", async () => {
    const created = await staff().post("/customers", {
      firstName: "Lucía",
      lastName: "Ruiz",
      dni: "31.222.333",
      emails: ["lucia@estampados.test"],
      phones: ["387 455-1122"],
      appPassword: "lucia-2026",
    });
    expect(created.status).toBe(201);
    expect(created.body).not.toHaveProperty("appPasswordHash");
    expect(created.body.appPasswordSetAt).toBeTruthy();

    const list = await staff().get("/customers?search=ruiz");
    expect(JSON.stringify(list.body)).not.toContain("scrypt");
    const audits = await prisma.auditLog.findMany({ where: { entityId: created.body.id } });
    expect(JSON.stringify(audits)).not.toContain("scrypt");

    expect((await login("lucia@estampados.test", "lucia-2026")).status).toBe(200);
  });

  it("D-039: la contraseña de la app tiene al menos 8 caracteres", async () => {
    const res = await staff().post("/customers", {
      firstName: "Corta",
      lastName: "Clave",
      dni: "31222999",
      emails: ["corta@x.test"],
      phones: ["387 455-9999"],
      appPassword: "1234",
    });
    expect(res.status).toBe(400);
  });

  it("D-039: al cambiarla, la vieja deja de servir y se cortan las sesiones abiertas", async () => {
    const before = await login("ana4@cliente.test", PASSWORD);
    expect(before.status).toBe(200);
    const contact = await prisma.customerEmail.findUniqueOrThrow({ where: { email: "ana4@cliente.test" } });

    // El token viejo y el cambio no pueden caer en el mismo segundo.
    await new Promise((r) => setTimeout(r, 1100));
    const changed = await staff().post(`/customers/${contact.customerId}/app-password`, { password: "nueva-clave-456" });
    expect(changed.status).toBe(200);
    expect(changed.body).not.toHaveProperty("appPasswordHash");

    const me = await http().get("/app/me").set("Authorization", `Bearer ${before.body.accessToken}`);
    expect(me.status).toBe(401);
    expect((await login("ana4@cliente.test", PASSWORD)).status).toBe(401);
    expect((await login("ana4@cliente.test", "nueva-clave-456")).status).toBe(200);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: contact.customerId, action: "set_app_password" } });
    expect(audit.userId).toBeTruthy();
  });

  it("D-039: si bloquean al cliente, su sesión deja de servir al instante", async () => {
    const res = await login("ana1@cliente.test", PASSWORD);
    const contact = await prisma.customerEmail.findUniqueOrThrow({ where: { email: "ana1@cliente.test" } });
    await prisma.customer.update({ where: { id: contact.customerId }, data: { status: "BLOCKED" } });
    expect((await http().get("/app/me").set("Authorization", `Bearer ${res.body.accessToken}`)).status).toBe(401);
  });
});

describe("ficha completa del cliente en el ERP (D-038)", () => {
  it("D-038: el alta guarda los datos fiscales, la cuenta corriente y los avisos, y el CUIT es único", async () => {
    const body = {
      firstName: "Mara",
      lastName: "Sosa",
      dni: "32.111.444",
      emails: ["mara@estampados.test"],
      phones: ["387 455-2233"],
      businessName: "Estampados Sosa",
      cuit: "30-50001091-2",
      legalName: "Estampados Sosa S.R.L.",
      taxCondition: "RESPONSABLE_INSCRIPTO",
      fiscalAddress: "Av. Belgrano 100",
      city: "Salta",
      province: "Salta",
      creditEnabled: true,
      notificationPrefs: { push: true, email: false },
    };
    const res = await staff().post("/customers", body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: "ACTIVE",
      cuit: "30500010912",
      taxCondition: "RESPONSABLE_INSCRIPTO",
      creditEnabled: true,
      notificationPrefs: { push: true, email: false },
    });

    const dup = await staff().post("/customers", {
      ...body,
      dni: "32111555",
      emails: ["otro@x.test"],
      phones: ["387 455-1199"],
    });
    expect(dup.status).toBe(409);
    expect(dup.body.message).toBe("Ya existe un cliente con ese CUIT");
  });
});
