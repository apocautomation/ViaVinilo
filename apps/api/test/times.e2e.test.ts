import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./test-db";

let app: INestApplication;
let prisma: PrismaClient;
let stopDb: () => Promise<void>;
const tokens = { owner: "", production: "", customer: "" };
let dtfId = "";
let granId = "";
let customerId = "";

const get = (who: keyof typeof tokens, url: string) => request(app.getHttpServer()).get(url).set("Authorization", `Bearer ${tokens[who]}`);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

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

  dtfId = (await prisma.sector.create({ data: { code: "DTF", name: "DTF" } })).id;
  granId = (await prisma.sector.create({ data: { code: "GRAN_FORMATO", name: "Gran Formato" } })).id;
  const owner = await prisma.user.create({ data: { email: "duena@viavinilo.test", name: "Dueña", roles: ["OWNER"] } });
  const prod = await prisma.user.create({ data: { email: "dtf@viavinilo.test", name: "Impresor", roles: ["PRODUCTION"], sectors: { create: { sectorId: dtfId } } } });
  customerId = (await prisma.customer.create({ data: { status: "ACTIVE", firstName: "Ana", lastName: "Gómez" } })).id;
  tokens.owner = await jwt.signAsync({ sub: owner.id });
  tokens.production = await jwt.signAsync({ sub: prod.id });
  tokens.customer = await jwt.signAsync({ sub: customerId, kind: "customer" });

  const machine = await prisma.machine.create({ data: { name: "DTF 1" } });
  // Pedido DTF terminado: 2 h en "Archivo recibido", 4 h en "Cotizado".
  await prisma.jobOrder.create({
    data: {
      customerId,
      sectorId: dtfId,
      machineId: machine.id,
      status: "PRINTED",
      source: "EMAIL",
      createdAt: hoursAgo(10),
      events: { create: [{ toStatus: "RECEIVED", createdAt: hoursAgo(10) }, { toStatus: "QUOTED", createdAt: hoursAgo(8) }, { toStatus: "PRINTED", createdAt: hoursAgo(4) }] },
    },
  });
  // Otro DTF: 4 h en "Archivo recibido". Sigue en "Cotizado" hace 30 h → demorado.
  await prisma.jobOrder.create({
    data: {
      customerId,
      sectorId: dtfId,
      status: "QUOTED",
      source: "EMAIL",
      createdAt: hoursAgo(34),
      events: { create: [{ toStatus: "RECEIVED", createdAt: hoursAgo(34) }, { toStatus: "QUOTED", createdAt: hoursAgo(30) }] },
    },
  });
  // Gran Formato: recién entró, sin eventos todavía.
  await prisma.jobOrder.create({ data: { customerId, sectorId: granId, status: "RECEIVED", source: "API", createdAt: hoursAgo(1) } });
  // Listo para retirar hace una semana: espera al cliente, no cuenta como demorado.
  await prisma.jobOrder.create({ data: { customerId, sectorId: granId, status: "READY", source: "EMAIL", createdAt: hoursAgo(24 * 20), events: { create: [{ toStatus: "READY", createdAt: hoursAgo(24 * 7) }] } } });
  // Borrado: no cuenta en nada.
  await prisma.jobOrder.create({ data: { customerId, sectorId: dtfId, status: "RECEIVED", source: "EMAIL", createdAt: hoursAgo(50), deletedAt: new Date() } });
});

afterAll(async () => {
  await app?.close();
  await stopDb?.();
});

describe("panel de tiempos (SPEC E1.6, D-070)", () => {
  it("E1.6: solo el personal lo ve", async () => {
    expect((await request(app.getHttpServer()).get("/jobs/times")).status).toBe(401);
    expect((await get("customer", "/jobs/times")).status).toBe(401);
    expect((await get("owner", "/jobs/times")).status).toBe(200);
  });

  it("E1.6: cuenta los trabajos que entraron por día, por sector y por máquina", async () => {
    const res = (await get("owner", "/jobs/times?days=14")).body;
    expect(res.totals.created).toBe(3);
    expect(res.perDay).toHaveLength(14);
    expect(res.perDay.reduce((n: number, d: { total: number }) => n + d.total, 0)).toBe(3);
    const bySector: Record<string, number> = {};
    for (const d of res.perDay) for (const [s, c] of Object.entries(d.bySector as Record<string, number>)) bySector[s] = (bySector[s] ?? 0) + c;
    expect(bySector).toEqual({ DTF: 2, "Gran Formato": 1 });
    expect(res.perMachine).toEqual([{ machine: "Sin máquina asignada", count: 2 }, { machine: "DTF 1", count: 1 }]);
  });

  it("E1.6: calcula el tiempo promedio en cada estado con los cambios reales", async () => {
    const res = (await get("owner", "/jobs/times")).body;
    const of = (status: string) => res.stageAverages.find((r: { sector: string; status: string }) => r.sector === "DTF" && r.status === status);
    // "Archivo recibido": 2 h y 4 h → 3 h. "Cotizado": solo el que ya salió de ahí (4 h).
    expect(of("RECEIVED")).toMatchObject({ avgHours: 3, count: 2 });
    expect(of("QUOTED")).toMatchObject({ avgHours: 4, count: 1 });
    expect(of("PRINTED")).toBeUndefined();
  });

  it("E1.6: lista los demorados (más de X horas en el mismo paso), del más viejo al más nuevo", async () => {
    const res = (await get("owner", "/jobs/times")).body;
    expect(res.delayedHours).toBe(24);
    expect(res.delayed).toHaveLength(1);
    expect(res.delayed[0]).toMatchObject({ sector: "DTF", status: "QUOTED", customer: "Ana Gómez", hours: 30 });
    expect(res.totals).toMatchObject({ open: 3, delayed: 1 });
  });

  it("E1.6: el límite de demora es configurable por el dueño", async () => {
    await request(app.getHttpServer())
      .put("/admin/alerts")
      .set("Authorization", `Bearer ${tokens.owner}`)
      .send({ unansweredMinutes: 30, unquotedHours: 4, pendingSignupHours: 24, delayedHours: 3 });
    const res = (await get("owner", "/jobs/times")).body;
    expect(res.delayedHours).toBe(3);
    // Ahora también el que está en "Impreso" hace 4 h. El de Gran Formato (1 h) no.
    expect(res.delayed.map((d: { status: string }) => d.status)).toEqual(["QUOTED", "PRINTED"]);
    expect((await get("production", "/jobs/times/threshold")).body).toEqual({ delayedHours: 3 });
  });

  it("E1.6: producción ve solo los tiempos de sus tableros", async () => {
    const res = (await get("production", "/jobs/times")).body;
    expect(res.sectors).toEqual(["DTF"]);
    expect(res.totals.created).toBe(2);
    expect(res.stageAverages.every((r: { sector: string }) => r.sector === "DTF")).toBe(true);
  });

  it("E1.6: el período se puede acotar y no acepta valores fuera de rango", async () => {
    expect((await get("owner", "/jobs/times?days=1")).body.totals.created).toBe(2);
    expect((await get("owner", "/jobs/times?days=500")).status).toBe(400);
  });
});
