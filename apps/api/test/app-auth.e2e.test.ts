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
const login = (user: string, password: string) => http().post("/app/auth/login").send({ user, password });
const INVALID = "Los datos no son correctos. Revisá tu email o celular y la contraseña";
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
      expect(res.body.message).toBe(INVALID);
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

describe("ingreso con celular, activación por link e invitaciones (D-049)", () => {
  /** Saca el token del último mail en cola para ese email (el worker lo mandaría). */
  async function linkFromOutbox(email: string) {
    const mail = await prisma.outboundEmail.findFirstOrThrow({ where: { to: email }, orderBy: { createdAt: "desc" } });
    return /\/activar\/([A-Za-z0-9_-]+)/.exec(mail.text)?.[1] ?? "";
  }

  it("D-049: el cliente entra con su celular escrito de cualquier forma", async () => {
    await prisma.customer.create({
      data: {
        firstName: "Celu",
        lastName: "Solo",
        status: "ACTIVE",
        appPasswordHash: await hashPassword(PASSWORD),
        phones: { create: [{ phone: "+5493874661234", isPrimary: true }] },
      },
    });
    const res = await login("387 466-1234", PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.customer.lastName).toBe("Solo");
    expect((await login("0387 15 466-1234", PASSWORD)).status).toBe(200);
    expect((await login("0387 15 466-1234", "otra-clave-999")).status).toBe(401);
  });

  it("D-049: pide el link en /activar, crea su contraseña y queda logueado; el link sirve una sola vez", async () => {
    const asked = await http().post("/app/auth/activation/request").send({ email: "Ana3@Cliente.test" });
    expect(asked.status).toBe(200);
    expect(asked.body).toEqual({ sent: true });
    const token = await linkFromOutbox("ana3@cliente.test");
    expect(token.length).toBeGreaterThan(20);
    // El link no queda guardado en claro: solo su hash.
    expect(await prisma.appActivation.count({ where: { tokenHash: token } })).toBe(0);

    const done = await http().post("/app/auth/activation/complete").send({ token, password: "mi-clave-propia" });
    expect(done.status).toBe(200);
    expect(done.body.accessToken).toBeTruthy();
    expect((await login("ana3@cliente.test", "mi-clave-propia")).status).toBe(200);
    expect((await http().post("/app/auth/activation/complete").send({ token, password: "otra-clave-123" })).status).toBe(401);
  });

  it("D-049: /activar responde lo mismo con un email que no es de un cliente y no manda nada", async () => {
    const res = await http().post("/app/auth/activation/request").send({ email: "nadie@cliente.test" });
    expect(res.body).toEqual({ sent: true });
    expect(await prisma.outboundEmail.count({ where: { to: "nadie@cliente.test" } })).toBe(0);
  });

  it("D-049: un link vencido no sirve", async () => {
    await http().post("/app/auth/activation/request").send({ email: "ventas4@cliente.test" });
    const token = await linkFromOutbox("ventas4@cliente.test");
    await prisma.appActivation.updateMany({ where: { email: "ventas4@cliente.test" }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await http().post("/app/auth/activation/complete").send({ token, password: "clave-vencida-1" })).status).toBe(401);
  });

  it("D-049: el ERP invita a todos los pendientes; los que no tienen email quedan marcados para completar", async () => {
    const sinEmail = await prisma.customer.create({
      data: { firstName: "Sin", lastName: "Email", status: "ACTIVE", importSource: "runamatic", phones: { create: [{ phone: "+5493874660099", isPrimary: true }] } },
    });
    await prisma.customer.create({
      data: {
        firstName: "Con",
        lastName: "Email",
        status: "ACTIVE",
        importSource: "runamatic",
        emails: { create: [{ email: "conemail@cliente.test", isPrimary: true }] },
      },
    });
    const res = await staff().post("/customers/invite", { allPending: true });
    expect(res.status).toBe(200);
    expect(res.body.withoutEmail).toBeGreaterThanOrEqual(1);
    expect(res.body.invited).toBeGreaterThanOrEqual(1);
    const queued = await prisma.outboundEmail.findMany({ where: { kind: "activation-invite" } });
    expect(queued.length).toBe(res.body.invited);
    expect(queued.every((m) => m.status === "PENDING")).toBe(true);

    const gaps = await staff().get("/customers?gap=NO_EMAIL");
    expect(gaps.body.items.map((c: { id: string }) => c.id)).toContain(sinEmail.id);
    expect((await staff().post("/customers/invite", {})).status).toBe(400);
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

describe("notificaciones push de la app (D-068)", () => {
  const ENDPOINT = "https://fcm.googleapis.com/fcm/send/dispositivo-1";
  const keys = { p256dh: "clave-publica-del-navegador-de-prueba", auth: "secreto-auth-prueba" };
  // Token firmado directo: los tests de arriba cambian contraseñas y estados de estos clientes.
  const tokenOf = async (n: number) => {
    const { JwtService } = await import("@nestjs/jwt");
    const c = await prisma.customer.findFirstOrThrow({ where: { lastName: `Gómez ${n}` } });
    if (c.status !== "ACTIVE") await prisma.customer.update({ where: { id: c.id }, data: { status: "ACTIVE" } });
    return app.get(JwtService).signAsync({ sub: c.id, kind: "customer" });
  };
  const asCustomer = (token: string) => ({
    get: (url: string) => http().get(url).set("Authorization", `Bearer ${token}`),
    post: (url: string, body?: object) => http().post(url).set("Authorization", `Bearer ${token}`).send(body),
    put: (url: string, body?: object) => http().put(url).set("Authorization", `Bearer ${token}`).send(body),
  });

  it("D-068: sin sesión de cliente no se puede suscribir; el personal tampoco", async () => {
    expect((await http().post("/app/push/subscriptions").send({ endpoint: ENDPOINT, keys })).status).toBe(401);
    expect((await staff().post("/app/push/subscriptions", { endpoint: ENDPOINT, keys })).status).toBe(401);
  });

  it("D-068: el cliente suscribe su celular; repetirlo no lo duplica", async () => {
    const c = asCustomer(await tokenOf(1));
    expect((await c.post("/app/push/subscriptions", { endpoint: ENDPOINT, keys })).status).toBe(200);
    expect((await c.post("/app/push/subscriptions", { endpoint: ENDPOINT, keys })).status).toBe(200);
    expect(await prisma.pushSubscription.count({ where: { endpoint: ENDPOINT } })).toBe(1);
  });

  it("D-068: rechaza una dirección que no es de un servicio de push", async () => {
    const c = asCustomer(await tokenOf(1));
    expect((await c.post("/app/push/subscriptions", { endpoint: "https://postgres:5432/x", keys })).status).toBe(400);
    expect((await c.post("/app/push/subscriptions", { endpoint: "http://fcm.googleapis.com/fcm/send/x", keys })).status).toBe(400);
  });

  it("D-068: si otro cliente entra en el mismo celular, la suscripción pasa a ese cliente", async () => {
    const c4 = asCustomer(await tokenOf(4));
    await c4.post("/app/push/subscriptions", { endpoint: ENDPOINT, keys });
    const sub = await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint: ENDPOINT }, include: { customer: true } });
    expect(sub.customer.lastName).toBe("Gómez 4");
  });

  it("D-068: un cliente no puede dar de baja la suscripción de otro; la suya sí", async () => {
    await asCustomer(await tokenOf(1)).post("/app/push/unsubscribe", { endpoint: ENDPOINT });
    expect(await prisma.pushSubscription.count({ where: { endpoint: ENDPOINT } })).toBe(1);
    await asCustomer(await tokenOf(4)).post("/app/push/unsubscribe", { endpoint: ENDPOINT });
    expect(await prisma.pushSubscription.count({ where: { endpoint: ENDPOINT } })).toBe(0);
  });

  it("D-068: el cliente elige sus avisos y quedan guardados", async () => {
    const c = asCustomer(await tokenOf(1));
    expect((await c.put("/app/notification-prefs", { push: false, email: true })).body).toEqual({ push: false, email: true });
    expect((await c.get("/app/me")).body.notificationPrefs).toEqual({ push: false, email: true });
    expect((await c.put("/app/notification-prefs", { push: "si" })).status).toBe(400);
  });

  it("D-068: la clave pública sale del entorno; sin claves, la app no ofrece notificaciones", async () => {
    const c = asCustomer(await tokenOf(1));
    delete process.env.VAPID_PUBLIC_KEY;
    expect((await c.get("/app/push/key")).body).toEqual({ publicKey: null });
    process.env.VAPID_PUBLIC_KEY = "clave-publica-de-prueba";
    expect((await c.get("/app/push/key")).body).toEqual({ publicKey: "clave-publica-de-prueba" });
    delete process.env.VAPID_PUBLIC_KEY;
  });
});
