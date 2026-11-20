import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../src/auth/password";
import { startTestDb } from "./test-db";

let app: INestApplication;
let prisma: PrismaClient;
let stopDb: () => Promise<void>;
const tokens: Record<"owner" | "attention" | "production", string> = { owner: "", attention: "", production: "" };

const PASSWORD = "clave-de-prueba-123";

/** Firma un token como lo haría el login, sin gastar intentos del límite de 5 por minuto. */
async function tokenFor(email: string) {
  const { JwtService } = await import("@nestjs/jwt");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return app.get(JwtService).signAsync({ sub: user.id });
}

const api = (role: keyof typeof tokens) => ({
  get: (url: string) => request(app.getHttpServer()).get(url).set("Authorization", `Bearer ${tokens[role]}`),
  post: (url: string, body?: object) =>
    request(app.getHttpServer()).post(url).set("Authorization", `Bearer ${tokens[role]}`).send(body),
  patch: (url: string, body: object) =>
    request(app.getHttpServer()).patch(url).set("Authorization", `Bearer ${tokens[role]}`).send(body),
  delete: (url: string) => request(app.getHttpServer()).delete(url).set("Authorization", `Bearer ${tokens[role]}`),
});

const newCustomer = (n: number) => ({
  firstName: "Juan",
  lastName: `Pérez ${n}`,
  dni: `30.000.00${n}`,
  emails: [`Juan${n}@Example.com`],
  phones: [`387 466-99${String(n).padStart(2, "0")}`],
});

beforeAll(async () => {
  const testDb = await startTestDb();
  stopDb = testDb.stop;
  process.env.DATABASE_URL = testDb.url;
  process.env.JWT_SECRET = "secreto-de-prueba-de-al-menos-32-caracteres";

  const { NestFactory } = await import("@nestjs/core");
  const { AppModule } = await import("../src/app.module");
  const { PrismaService } = await import("../src/prisma/prisma.service");
  app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  prisma = app.get(PrismaService);

  const passwordHash = await hashPassword(PASSWORD);
  await prisma.user.createMany({
    data: [
      { email: "duenio@viavinilo.test", name: "Dueño", roles: ["OWNER"], passwordHash },
      { email: "asesor@viavinilo.test", name: "Asesor", roles: ["ATTENTION"], passwordHash },
      { email: "impresor@viavinilo.test", name: "Impresor", roles: ["PRODUCTION"], passwordHash },
      { email: "baja@viavinilo.test", name: "Ex empleado", roles: ["OWNER"], passwordHash, active: false },
    ],
  });
  tokens.owner = await tokenFor("duenio@viavinilo.test");
  tokens.attention = await tokenFor("asesor@viavinilo.test");
  tokens.production = await tokenFor("impresor@viavinilo.test");
});

afterAll(async () => {
  await app?.close();
  await stopDb?.();
});

describe("auth del personal", () => {
  it("/health es público", async () => {
    const res = await request(app.getHttpServer()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", db: "ok" });
  });

  it("sin token no se puede usar la API", async () => {
    const res = await request(app.getHttpServer()).get("/customers");
    expect(res.status).toBe(401);
  });

  it("con email y contraseña correctos devuelve el token y el usuario", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: " Asesor@ViaVinilo.test ", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: "asesor@viavinilo.test", roles: ["ATTENTION"] });
    const me = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${res.body.accessToken}`);
    expect(me.status).toBe(200);
  });

  it("con contraseña incorrecta o usuario inactivo no entra, con el mismo mensaje", async () => {
    const wrong = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "duenio@viavinilo.test", password: "incorrecta-123" });
    const inactive = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "baja@viavinilo.test", password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(inactive.status).toBe(401);
    expect(wrong.body.message).toBe(inactive.body.message);
  });

  it("/auth/me devuelve el usuario y sus roles, sin la contraseña", async () => {
    const res = await api("attention").get("/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: "asesor@viavinilo.test", roles: ["ATTENTION"] });
    expect(JSON.stringify(res.body)).not.toContain("scrypt");
  });

  it("D-017: si desactivan al usuario, su token deja de servir en el acto", async () => {
    await prisma.user.create({
      data: {
        email: "temporal@viavinilo.test",
        name: "Temporal",
        roles: ["ATTENTION"],
        passwordHash: await hashPassword(PASSWORD),
      },
    });
    const token = await tokenFor("temporal@viavinilo.test");
    const before = await request(app.getHttpServer()).get("/auth/me").set("Authorization", `Bearer ${token}`);
    expect(before.status).toBe(200);
    await prisma.user.update({ where: { email: "temporal@viavinilo.test" }, data: { active: false } });
    const res = await request(app.getHttpServer()).get("/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("un token adulterado o firmado con otra clave no sirve", async () => {
    const res = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${tokens.owner.slice(0, -4)}xxxx`);
    expect(res.status).toBe(401);
  });

  it("limita los intentos de login a 5 por minuto", async () => {
    // Los tests de arriba ya usaron 3 intentos en este minuto.
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "duenio@viavinilo.test", password: "incorrecta-123" });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([401, 401, 429, 429]);
  });
});

describe("clientes", () => {
  let customerId: string;

  it("actualización §2.1: el asesor da de alta un cliente activo con número de cliente", async () => {
    const res = await api("attention").post("/customers", newCustomer(1));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "ACTIVE", dni: "30000001", firstName: "Juan" });
    expect(res.body.customerNumber).toBeGreaterThan(0);
    expect(res.body.emails[0]).toMatchObject({ email: "juan1@example.com", isPrimary: true });
    expect(res.body.phones[0]).toMatchObject({ phone: "+5493874669901", isPrimary: true });
    customerId = res.body.id;

    const audit = await prisma.auditLog.findMany({ where: { entityId: customerId } });
    expect(audit.map((a) => a.action)).toEqual(["create"]);
  });

  it("los números de cliente son únicos y correlativos", async () => {
    const res = await api("attention").post("/customers", newCustomer(2));
    const first = await api("attention").get(`/customers/${customerId}`);
    expect(res.body.customerNumber).toBe(first.body.customerNumber + 1);
  });

  it("D-017: producción puede consultar pero no dar de alta", async () => {
    expect((await api("production").get("/customers")).status).toBe(200);
    const res = await api("production").post("/customers", newCustomer(3));
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("No tenés permiso para hacer esto");
  });

  it("valida los datos mínimos y responde por campo en español", async () => {
    const res = await api("attention").post("/customers", { ...newCustomer(4), dni: "12", emails: [] });
    expect(res.status).toBe(400);
    expect(res.body.errors).toMatchObject({
      dni: "El DNI tiene que tener 7 u 8 números",
      emails: "Cargá al menos un email",
    });
  });

  it("no permite repetir DNI, email ni teléfono entre clientes", async () => {
    const dni = await api("attention").post("/customers", { ...newCustomer(5), dni: "30.000.001" });
    expect(dni.status).toBe(409);
    expect(dni.body.message).toBe("Ya existe un cliente con ese DNI");

    const email = await api("attention").post("/customers", { ...newCustomer(6), emails: ["JUAN1@example.com"] });
    expect(email.status).toBe(409);
    expect(email.body.message).toBe("Ese email ya está cargado en otro cliente");

    // El mismo celular escrito con 15: es el mismo número (I-12).
    const phone = await api("attention").post("/customers", { ...newCustomer(7), phones: ["0387 15 466-9901"] });
    expect(phone.status).toBe(409);
    expect(phone.body.message).toBe("Ese teléfono ya está cargado en otro cliente");
  });

  it("busca por nombre y apellido, número de cliente, DNI, email y teléfono", async () => {
    const { body: c } = await api("attention").get(`/customers/${customerId}`);
    const searches = [
      "juan pérez 1",
      "PEREZ 1 juan", // sin tildes, en mayúsculas y en otro orden
      String(c.customerNumber),
      "30000001",
      "juan1@",
      "466-9901",
    ];
    for (const search of searches) {
      const res = await api("production").get(`/customers?search=${encodeURIComponent(search)}`);
      expect(res.status).toBe(200);
      expect(res.body.items.map((i: { id: string }) => i.id)).toContain(customerId);
    }
  });

  it("agrega un segundo email y lo puede marcar como principal", async () => {
    const res = await api("attention").post(`/customers/${customerId}/emails`, {
      email: "Compras@Juan.com",
      isPrimary: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.emails).toHaveLength(2);
    expect(res.body.emails[0]).toMatchObject({ email: "compras@juan.com", isPrimary: true });
    expect(res.body.emails.filter((e: { isPrimary: boolean }) => e.isPrimary)).toHaveLength(1);
  });

  it("un cliente activo no puede quedarse sin teléfono", async () => {
    const { body: c } = await api("attention").get(`/customers/${customerId}`);
    const res = await api("attention").delete(`/customers/${customerId}/phones/${c.phones[0].id}`);
    expect(res.status).toBe(422);
  });

  it("actualización §2.1: las notas internas se pueden editar y quedan en auditoría", async () => {
    const res = await api("attention").patch(`/customers/${customerId}`, { internalNotes: "Buen cliente" });
    expect(res.status).toBe(200);
    expect(res.body.internalNotes).toBe("Buen cliente");
    const audit = await prisma.auditLog.findFirst({ where: { entityId: customerId, action: "update" } });
    expect(audit).not.toBeNull();
  });

  it("bloquear exige motivo y queda en auditoría; desbloquear vuelve a activo", async () => {
    expect((await api("attention").post(`/customers/${customerId}/block`, {})).status).toBe(400);
    const blocked = await api("attention").post(`/customers/${customerId}/block`, { reason: "Deuda" });
    expect(blocked.body.status).toBe("BLOCKED");
    const unblocked = await api("attention").post(`/customers/${customerId}/unblock`);
    expect(unblocked.body.status).toBe("ACTIVE");
    const audit = await prisma.auditLog.findFirst({ where: { entityId: customerId, action: "block" } });
    expect(audit?.after).toMatchObject({ status: "BLOCKED", reason: "Deuda" });
  });

  describe("alta pendiente (D-014)", () => {
    let pendingId: string;

    beforeAll(async () => {
      // Así llega un cliente desde un mail de alguien que no está dado de alta.
      const pending = await prisma.customer.create({
        data: { status: "PENDING", emails: { create: { email: "nuevo@gremio.test", isPrimary: true } } },
      });
      pendingId = pending.id;
    });

    it("actualización §2.1: no se aprueba sin los datos mínimos y dice qué falta", async () => {
      const res = await api("attention").post(`/customers/${pendingId}/approve`);
      expect(res.status).toBe(422);
      expect(res.body.missing).toEqual(["nombre", "apellido", "DNI", "teléfono"]);
    });

    it("con los datos completos, el asesor lo aprueba y queda registrado quién", async () => {
      await api("attention").patch(`/customers/${pendingId}`, { firstName: "Ana", lastName: "Gómez", dni: "28123456" });
      const found = await api("attention").get("/customers?search=gomez");
      expect(found.body.items.map((i: { id: string }) => i.id)).toContain(pendingId);
      await api("attention").post(`/customers/${pendingId}/phones`, { phone: "387 555-1234" });
      const res = await api("attention").post(`/customers/${pendingId}/approve`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ACTIVE");
      const user = await prisma.user.findUnique({ where: { email: "asesor@viavinilo.test" } });
      expect(res.body.approvedById).toBe(user?.id);
    });

    it("no se puede aprobar dos veces", async () => {
      const res = await api("attention").post(`/customers/${pendingId}/approve`);
      expect(res.status).toBe(422);
    });

    it("D-017: producción no puede aprobar altas", async () => {
      const res = await api("production").post(`/customers/${pendingId}/approve`);
      expect(res.status).toBe(403);
    });

    it("D-054: muestra los clientes parecidos (mismo nombre, teléfono o el N.º que dijo tener)", async () => {
      const claimed = await prisma.customer.create({ data: { status: "ACTIVE", firstName: "Otro", lastName: "Cliente" } });
      const dup = await prisma.customer.create({
        data: {
          status: "PENDING",
          firstName: "Ana",
          lastName: "Gómez",
          searchText: "ana gomez",
          internalNotes: `Dice ser el cliente N.º ${claimed.customerNumber}`,
          emails: { create: { email: "ana.otra@gremio.test", isPrimary: true } },
        },
      });
      const res = await api("attention").get(`/customers/${dup.id}/matches`);
      expect(res.status).toBe(200);
      expect(res.body.map((m: { id: string }) => m.id).sort()).toEqual([pendingId, claimed.id].sort());
    });

    it("D-054: rechazar un alta exige motivo, la bloquea y queda en auditoría", async () => {
      const spam = await prisma.customer.create({
        data: { status: "PENDING", emails: { create: { email: "spam@gremio.test", isPrimary: true } } },
      });
      expect((await api("attention").post(`/customers/${spam.id}/reject`, {})).status).toBe(400);
      const res = await api("attention").post(`/customers/${spam.id}/reject`, { reason: "Duplicado del N.º 10" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("BLOCKED");
      const audit = await prisma.auditLog.findFirst({ where: { entityId: spam.id, action: "reject" } });
      expect(audit?.after).toMatchObject({ status: "BLOCKED", reason: "Duplicado del N.º 10" });
      // Un cliente activo no se "rechaza".
      expect((await api("attention").post(`/customers/${pendingId}/reject`, { reason: "x" })).status).toBe(422);
    });
  });

  describe("baja", () => {
    it("D-017: solo el dueño da de baja; el email queda libre para otro alta", async () => {
      const created = await api("attention").post("/customers", newCustomer(8));
      expect((await api("attention").delete(`/customers/${created.body.id}`)).status).toBe(403);
      expect((await api("owner").delete(`/customers/${created.body.id}`)).status).toBe(204);
      expect((await api("owner").get(`/customers/${created.body.id}`)).status).toBe(404);

      const again = await api("attention").post("/customers", { ...newCustomer(8), dni: "30.000.009" });
      expect(again.status).toBe(201);
    });
  });
});
