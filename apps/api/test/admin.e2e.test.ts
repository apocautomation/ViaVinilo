import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./test-db";

let app: INestApplication;
let prisma: PrismaClient;
let stopDb: () => Promise<void>;
const tokens = { owner: "", attention: "", production: "" };
let ownerId = "";
let dtfId = "";
let granId = "";

const http = () => request(app.getHttpServer());
const as = (who: keyof typeof tokens) => ({
  get: (url: string) => http().get(url).set("Authorization", `Bearer ${tokens[who]}`),
  post: (url: string, body?: object) => http().post(url).set("Authorization", `Bearer ${tokens[who]}`).send(body),
  patch: (url: string, body?: object) => http().patch(url).set("Authorization", `Bearer ${tokens[who]}`).send(body),
  put: (url: string, body?: object) => http().put(url).set("Authorization", `Bearer ${tokens[who]}`).send(body),
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
  const owner = await prisma.user.create({ data: { email: "duena@viavinilo.test", name: "Dueña", roles: ["OWNER"] } });
  const attention = await prisma.user.create({ data: { email: "asesor@viavinilo.test", name: "Vero", roles: ["ATTENTION"] } });
  ownerId = owner.id;
  tokens.owner = await jwt.signAsync({ sub: owner.id });
  tokens.attention = await jwt.signAsync({ sub: attention.id });
  dtfId = (await prisma.sector.create({ data: { code: "DTF", name: "DTF" } })).id;
  granId = (await prisma.sector.create({ data: { code: "GRAN_FORMATO", name: "Gran Formato" } })).id;
});

afterAll(async () => {
  await app?.close();
  await stopDb?.();
});

describe("Configuración: usuarios, roles y tableros (D-067)", () => {
  let impresorId = "";

  it("D-067: solo el dueño entra a Configuración", async () => {
    expect((await as("attention").get("/admin/users")).status).toBe(403);
    expect((await as("owner").get("/admin/users")).status).toBe(200);
  });

  it("D-067: el dueño crea un usuario de producción con sus tableros; entra con su contraseña y ve solo esos tableros", async () => {
    const res = await as("owner").post("/admin/users", { name: "Impresor DTF", email: "Impresor@ViaVinilo.test", roles: ["PRODUCTION"], sectorIds: [dtfId], password: "tablero-dtf-2026" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: "impresor@viavinilo.test", roles: ["PRODUCTION"], active: true });
    expect(res.body.sectors.map((s: { code: string }) => s.code)).toEqual(["DTF"]);
    expect(JSON.stringify(res.body)).not.toMatch(/password|tablero-dtf/i);
    impresorId = res.body.id;

    const login = await http().post("/auth/login").send({ email: "impresor@viavinilo.test", password: "tablero-dtf-2026" });
    expect(login.status).toBeLessThan(300);
    tokens.production = login.body.accessToken;
    expect((await as("production").get("/sectors")).body.map((s: { code: string }) => s.code)).toEqual(["DTF"]);
    // No se repite el email ni se acepta una contraseña corta.
    expect((await as("owner").post("/admin/users", { name: "Otro", email: "impresor@viavinilo.test", roles: ["ATTENTION"], password: "otra-clave-larga" })).status).toBe(409);
    expect((await as("owner").post("/admin/users", { name: "Otro", email: "otro@viavinilo.test", roles: ["ATTENTION"], password: "corta" })).status).toBe(400);
  });

  it("D-067: cambiarle los tableros y el rol se aplica al toque y queda en auditoría", async () => {
    const res = await as("owner").patch(`/admin/users/${impresorId}`, { sectorIds: [dtfId, granId] });
    expect(res.body.sectors).toHaveLength(2);
    expect((await as("production").get("/sectors")).body).toHaveLength(2);
    expect(await prisma.auditLog.count({ where: { entity: "User", entityId: impresorId } })).toBe(2);
  });

  it("D-067: cambiar la contraseña no la deja en la auditoría; desactivado no puede entrar", async () => {
    expect((await as("owner").post(`/admin/users/${impresorId}/password`, { password: "nueva-clave-2026" })).status).toBe(200);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: impresorId, action: "set_password" } });
    expect(JSON.stringify(audit)).not.toContain("nueva-clave");
    expect((await http().post("/auth/login").send({ email: "impresor@viavinilo.test", password: "tablero-dtf-2026" })).status).toBe(401);

    await as("owner").patch(`/admin/users/${impresorId}`, { active: false });
    expect((await http().post("/auth/login").send({ email: "impresor@viavinilo.test", password: "nueva-clave-2026" })).status).toBe(401);
    expect((await as("production").get("/sectors")).status).toBe(401);
  });

  it("D-067: siempre queda un dueño activo y nadie se saca a sí mismo el acceso", async () => {
    expect((await as("owner").patch(`/admin/users/${ownerId}`, { active: false })).status).toBe(422);
    expect((await as("owner").patch(`/admin/users/${ownerId}`, { roles: ["ATTENTION"] })).status).toBe(422);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: ownerId } })).roles).toEqual(["OWNER"]);
  });
});

describe("Configuración: permiso para ver los totales (D-089)", () => {
  it("D-089: el dueño le da o le quita a un usuario el permiso de ver los totales en pesos; queda auditado", async () => {
    const created = await as("owner").post("/admin/users", { name: "Caja", email: "caja@viavinilo.test", roles: ["ATTENTION"], password: "caja-clave-2026" });
    expect(created.status).toBe(201);
    expect(created.body.canSeeBilling).toBe(false);
    const on = await as("owner").patch(`/admin/users/${created.body.id}`, { canSeeBilling: true });
    expect(on.body.canSeeBilling).toBe(true);
    const audit = await prisma.auditLog.findFirst({ where: { entity: "User", entityId: created.body.id, action: "update" }, orderBy: { createdAt: "desc" } });
    expect(audit).toMatchObject({ before: { canSeeBilling: false }, after: { canSeeBilling: true } });
    expect((await as("attention").patch(`/admin/users/${created.body.id}`, { canSeeBilling: false })).status).toBe(403);
  });
});

describe("opciones de impresión por tablero (D-095, D-108)", () => {
  it("D-095: el dueño agrega, renombra y desactiva opciones; el código no se repite; queda auditado", async () => {
    expect((await as("attention").post(`/sectors/${dtfId}/variants`, { code: "AGLI", name: "Glitter" })).status).toBe(403);
    const created = await as("owner").post(`/sectors/${dtfId}/variants`, { code: "agli", name: "Glitter" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ code: "AGLI", name: "Glitter", active: true, tangoSku: null });
    expect((await as("owner").post(`/sectors/${dtfId}/variants`, { code: "AGLI", name: "Otro" })).status).toBe(409);
    const off = await as("owner").patch(`/variants/${created.body.id}`, { active: false, name: "Glitter fino" });
    expect(off.body).toMatchObject({ active: false, name: "Glitter fino" });
    const all = await as("owner").get("/sectors/all");
    expect(all.body.find((s: { id: string }) => s.id === dtfId).variants.map((v: { code: string }) => v.code)).toContain("AGLI");
    const audit = await prisma.auditLog.findFirst({ where: { entity: "SectorVariant", entityId: created.body.id, action: "update" } });
    expect(audit).toMatchObject({ before: { active: true }, after: { active: false, name: "Glitter fino" } });
  });

  it("D-108: guarda el código de Tango y los anchos; el código de Tango no se repite; el código no lleva guiones", async () => {
    expect((await as("owner").post(`/sectors/${dtfId}/variants`, { code: "A-SET", name: "Con guion" })).status).toBe(400);
    const created = await as("owner").post(`/sectors/${dtfId}/variants`, { code: "ASET", name: "Jersey Set", tangoSku: "ZZTEST001", width: "160", usableWidth: "155" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ code: "ASET", tangoSku: "ZZTEST001", width: "160", usableWidth: "155" });
    const dup = await as("owner").post(`/sectors/${dtfId}/variants`, { code: "ASET2", name: "Otra", tangoSku: "ZZTEST001" });
    expect(dup.status).toBe(409);
    expect(dup.body.message).toBe("Ese código de Tango ya lo tiene otra opción");
    const edited = await as("owner").patch(`/variants/${created.body.id}`, { width: "150", usableWidth: "145" });
    expect(edited.body).toMatchObject({ width: "150", usableWidth: "145", tangoSku: "ZZTEST001" });
  });
});

describe("Configuración: máquinas y motivos de error (D-067)", () => {
  it("D-067: el dueño crea una máquina para un tablero y la desactiva", async () => {
    const created = await as("owner").post("/admin/machines", { name: "DTF 60 nueva", sectorIds: [dtfId] });
    expect(created.status).toBe(201);
    const list = await as("owner").get("/admin/machines");
    expect(list.body.find((m: { name: string }) => m.name === "DTF 60 nueva").sectors[0].name).toBe("DTF");
    expect((await as("owner").patch(`/admin/machines/${created.body.id}`, { active: false })).status).toBe(200);
    expect((await prisma.machine.findUniqueOrThrow({ where: { id: created.body.id } })).active).toBe(false);
  });

  it("D-067: el dueño agrega un motivo de error y aparece en el tablero; desactivado deja de aparecer", async () => {
    const created = await as("owner").post("/admin/error-reasons", { label: "Falta el fondo transparente" });
    expect(created.status).toBe(201);
    expect((await as("attention").get("/file-error-reasons")).body.map((r: { label: string }) => r.label)).toContain("Falta el fondo transparente");
    await as("owner").patch(`/admin/error-reasons/${created.body.id}`, { active: false });
    expect((await as("attention").get("/file-error-reasons")).body.map((r: { label: string }) => r.label)).not.toContain("Falta el fondo transparente");
  });
});

describe("campanita: avisos reales y tiempos configurables (D-067)", () => {
  it("D-067: sin nada pendiente no hay avisos", async () => {
    expect((await as("attention").get("/notifications")).body).toEqual({ total: 0, items: [] });
  });

  it("D-067: avisa chats que piden asesor, chats sin atención, mensajes nuevos, pedidos sin cotizar y altas pendientes", async () => {
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
    const c = await prisma.customer.create({ data: { status: "ACTIVE", firstName: "Ana" } });
    const c2 = await prisma.customer.create({ data: { status: "ACTIVE", firstName: "Beto" } });
    await prisma.customer.create({ data: { status: "PENDING", createdAt: hoursAgo(30) } });
    await prisma.conversation.create({ data: { customerId: c.id, staffUnread: 2, lastMessageAt: hoursAgo(2), needsHuman: true } });
    await prisma.conversation.create({ data: { customerId: c2.id, staffUnread: 1, lastMessageAt: new Date() } });
    await prisma.jobOrder.create({ data: { customerId: c.id, sectorId: dtfId, status: "RECEIVED", source: "EMAIL", createdAt: hoursAgo(6) } });
    await prisma.jobOrder.create({ data: { customerId: c.id, sectorId: granId, status: "RECEIVED", source: "EMAIL", fileCheck: { verdict: "error", detail: "x" } } });

    const res = await as("attention").get("/notifications");
    const byKind = Object.fromEntries(res.body.items.map((i: { kind: string; count: number }) => [i.kind, i.count]));
    expect(byKind).toEqual({ needs_human: 1, unattended: 1, unread: 1, file_problem: 1, unquoted: 1, pending_signup: 1 });
    expect(res.body.total).toBe(6);
    // Lo urgente va primero.
    expect(res.body.items[0].level).toBe("urgent");
  });

  it("D-067: el dueño cambia los tiempos y los avisos lo respetan", async () => {
    expect((await as("attention").put("/admin/alerts", { unansweredMinutes: 5, unquotedHours: 1, pendingSignupHours: 1 })).status).toBe(403);
    const res = await as("owner").put("/admin/alerts", { unansweredMinutes: 240, unquotedHours: 12, pendingSignupHours: 48 });
    expect(res.body).toEqual({ unansweredMinutes: 240, unquotedHours: 12, pendingSignupHours: 48, delayedHours: 24, businessHoursOnly: false, showCancelledToCustomer: true });
    const kinds = (await as("attention").get("/notifications")).body.items.map((i: { kind: string }) => i.kind);
    // Con 4 h de tolerancia el chat de hace 2 h ya no está "sin atención": cuenta como mensajes nuevos.
    expect(kinds).not.toContain("unattended");
    expect(kinds).not.toContain("unquoted");
    expect(kinds).not.toContain("pending_signup");
    expect(kinds).toContain("unread");
  });
});
