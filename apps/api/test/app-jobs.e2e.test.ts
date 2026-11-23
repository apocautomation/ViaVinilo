import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./test-db";

let app: INestApplication;
let prisma: PrismaClient;
let stopDb: () => Promise<void>;
const tokens = { ana: "", beto: "", staff: "" };
let anaId = "";
let betoId = "";
let sectorId = "";

const get = (who: keyof typeof tokens, url: string) => request(app.getHttpServer()).get(url).set("Authorization", `Bearer ${tokens[who]}`);

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
  tokens.staff = await jwt.signAsync({ sub: owner.id });
  anaId = (await prisma.customer.create({ data: { status: "ACTIVE", firstName: "Ana" } })).id;
  betoId = (await prisma.customer.create({ data: { status: "ACTIVE", firstName: "Beto" } })).id;
  tokens.ana = await jwt.signAsync({ sub: anaId, kind: "customer" });
  tokens.beto = await jwt.signAsync({ sub: betoId, kind: "customer" });

  const sector = await prisma.sector.create({
    data: {
      code: "SUBLIMACION",
      name: "Sublimación",
      stages: { create: (["RECEIVED", "FILE_ERROR", "QUOTED", "DEPOSIT_RECEIVED", "PRINTED", "CALENDERING", "READY", "DELIVERED"] as const).map((status, position) => ({ status, position })) },
    },
  });
  sectorId = sector.id;
});

afterAll(async () => {
  await app?.close();
  await stopDb?.();
});

describe("pedidos del cliente en la app (D-069)", () => {
  let quotedNumber = 0;

  it("D-069: sin sesión de cliente no se ven pedidos; el personal tampoco entra por acá", async () => {
    expect((await request(app.getHttpServer()).get("/app/jobs")).status).toBe(401);
    expect((await get("staff", "/app/jobs")).status).toBe(401);
  });

  it("D-069: un cliente sin pedidos ve la lista vacía", async () => {
    expect((await get("ana", "/app/jobs")).body).toEqual({ orders: [] });
  });

  it("D-069: el cliente ve su pedido con el estado, la medida, el precio y la hora estimada del tablero", async () => {
    const job = await prisma.jobOrder.create({
      data: {
        customerId: anaId,
        sectorId,
        status: "QUOTED",
        source: "EMAIL",
        description: "Tela tropical",
        measure: "150 × 300 cm",
        quotedAmount: "84500.50",
        depositRequired: true,
        depositAmount: "42250.25",
        estimatedReadyAt: new Date("2026-11-23T15:00:00Z"),
        files: { create: { filename: "tropical.png", storageKey: "k1", sizeBytes: 2_500_000n, mime: "image/png", checksum: "x" } },
        events: {
          create: [
            { toStatus: "RECEIVED", createdAt: new Date("2026-11-20T12:00:00Z") },
            { fromStatus: "RECEIVED", toStatus: "QUOTED", note: "Nota interna: cliente moroso", createdAt: new Date("2026-11-20T13:00:00Z") },
          ],
        },
      },
    });
    quotedNumber = job.number;
    const res = await get("ana", "/app/jobs");
    expect(res.body.orders).toHaveLength(1);
    const o = res.body.orders[0];
    expect(o).toMatchObject({
      id: String(job.number),
      num: `VV-${String(job.number).padStart(6, "0")}`,
      sector: "Sublimación",
      desc: "Tela tropical",
      measure: "150 × 300 cm",
      status: "QUOTED",
      amount: "84500.5",
      depositRequired: true,
      depositAmount: "42250.25",
      depositPaid: false,
      channel: "Mail",
      error: null,
    });
    expect(o.readyAt).toBe("2026-11-23T15:00:00.000Z");
    // Con seña, el recorrido incluye "Seña recibida"; nunca "Archivo con error" como paso.
    expect(o.steps).toEqual(["RECEIVED", "QUOTED", "DEPOSIT_RECEIVED", "PRINTED", "CALENDERING", "READY", "DELIVERED"]);
    expect(o.files).toEqual([{ name: "tropical.png", size: "2,4 MB", available: true }]);
    expect(o.history.map((h: { status: string }) => h.status)).toEqual(["RECEIVED", "QUOTED"]);
  });

  it("D-069: nunca salen notas internas, quién lo movió ni datos del sistema", async () => {
    const raw = JSON.stringify((await get("ana", `/app/jobs/${quotedNumber}`)).body);
    expect(raw).not.toMatch(/moroso|Nota interna|storageKey|checksum|userId|fileCheck|customerId/);
  });

  it("D-069: un cliente no ve los pedidos de otro, ni en la lista ni por número", async () => {
    expect((await get("beto", "/app/jobs")).body.orders).toEqual([]);
    const other = await get("beto", `/app/jobs/${quotedNumber}`);
    expect(other.status).toBe(404);
    expect((await get("beto", "/app/jobs/999999")).body.message).toBe(other.body.message);
  });

  it("D-069: sin seña, el recorrido no muestra el paso de la seña", async () => {
    const job = await prisma.jobOrder.create({ data: { customerId: betoId, sectorId, status: "RECEIVED", source: "API" } });
    const o = (await get("beto", `/app/jobs/${job.number}`)).body;
    expect(o.steps).toEqual(["RECEIVED", "QUOTED", "PRINTED", "CALENDERING", "READY", "DELIVERED"]);
    expect(o.channel).toBe("App");
    expect(o.amount).toBeNull();
    // Sin eventos todavía: "recibido" se toma de la fecha del pedido.
    expect(o.history).toHaveLength(1);
  });

  it("D-069: con el archivo con error ve el motivo que eligió el operador", async () => {
    const reason = await prisma.fileErrorReason.create({ data: { code: "BAJA_RES", label: "Baja resolución", sortOrder: 1 } });
    const job = await prisma.jobOrder.create({
      data: { customerId: betoId, sectorId, status: "FILE_ERROR", source: "EMAIL", events: { create: [{ toStatus: "RECEIVED" }, { fromStatus: "RECEIVED", toStatus: "FILE_ERROR", reasonId: reason.id, note: "interno" }] } },
    });
    const o = (await get("beto", `/app/jobs/${job.number}`)).body;
    expect(o.status).toBe("FILE_ERROR");
    expect(o.error).toBe("Baja resolución");
  });

  it("D-069: con el alta pendiente, el cliente ve su pedido como recibido", async () => {
    const job = await prisma.jobOrder.create({ data: { customerId: betoId, sectorId, status: "PENDING_SIGNUP", source: "EMAIL" } });
    expect((await get("beto", `/app/jobs/${job.number}`)).body.status).toBe("RECEIVED");
  });

  it("D-069: no se muestran los pedidos cancelados ni los borrados; los entregados van al final", async () => {
    await prisma.jobOrder.create({ data: { customerId: anaId, sectorId, status: "CANCELLED", source: "EMAIL" } });
    await prisma.jobOrder.create({ data: { customerId: anaId, sectorId, status: "RECEIVED", source: "EMAIL", deletedAt: new Date() } });
    await prisma.jobOrder.create({ data: { customerId: anaId, sectorId, status: "DELIVERED", source: "EMAIL", deliveredAt: new Date() } });
    const statuses = (await get("ana", "/app/jobs")).body.orders.map((o: { status: string }) => o.status);
    expect(statuses).toEqual(["QUOTED", "DELIVERED"]);
  });

  it("D-073: si el dueño lo prende, el cliente ve sus pedidos cancelados; apagado, no", async () => {
    const cancelled = await prisma.jobOrder.findFirstOrThrow({ where: { customerId: anaId, status: "CANCELLED" } });
    expect((await get("ana", `/app/jobs/${cancelled.number}`)).status).toBe(404);
    await prisma.appSetting.create({ data: { key: "alerts", value: { unansweredMinutes: 30, unquotedHours: 4, pendingSignupHours: 24, showCancelledToCustomer: true } } });
    const statuses = (await get("ana", "/app/jobs")).body.orders.map((o: { status: string }) => o.status);
    expect(statuses).toContain("CANCELLED");
    expect((await get("ana", `/app/jobs/${cancelled.number}`)).body.status).toBe("CANCELLED");
    // Sigue sin ver los de otro cliente ni los borrados.
    expect((await get("beto", `/app/jobs/${cancelled.number}`)).status).toBe(404);
    expect(statuses.filter((s: string) => s === "RECEIVED")).toHaveLength(0);
  });

  it("D-074: el cliente cancela su pedido mientras está en cotización o antes; el equipo se entera", async () => {
    const post = (who: "ana" | "beto", n: number) => request(app.getHttpServer()).post(`/app/jobs/${n}/cancel`).set("Authorization", `Bearer ${tokens[who]}`);
    const quoted = await prisma.jobOrder.create({ data: { customerId: betoId, sectorId, status: "QUOTED", source: "EMAIL", quotedAmount: "1000" } });
    expect((await get("beto", `/app/jobs/${quoted.number}`)).body.canCancel).toBe(true);
    // Otro cliente no puede cancelarlo.
    expect((await post("ana", quoted.number)).status).toBe(404);
    expect((await post("beto", quoted.number)).status).toBe(200);

    const after = await prisma.jobOrder.findUniqueOrThrow({ where: { id: quoted.id }, include: { events: true } });
    expect(after.status).toBe("CANCELLED");
    expect(after.events.at(-1)).toMatchObject({ fromStatus: "QUOTED", toStatus: "CANCELLED", note: "Cancelado por el cliente desde la app", userId: null });
    expect(await prisma.auditLog.count({ where: { entity: "JobOrder", entityId: quoted.id, action: "customer_cancel" } })).toBe(1);
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { customerId: betoId }, include: { messages: true } });
    expect(conv.staffUnread).toBe(1);
    expect(conv.messages.at(-1)).toMatchObject({ direction: "IN", channel: "APP", jobId: quoted.id });
    // Repetirlo no hace nada ni avisa de nuevo.
    expect((await post("beto", quoted.number)).status).toBe(200);
    expect((await prisma.conversation.findUniqueOrThrow({ where: { customerId: betoId } })).staffUnread).toBe(1);
  });

  it("D-074: con la seña pagada, impreso o listo ya no puede cancelarlo desde la app", async () => {
    for (const status of ["DEPOSIT_RECEIVED", "PRINTED", "CALENDERING", "READY", "DELIVERED"] as const) {
      const job = await prisma.jobOrder.create({ data: { customerId: betoId, sectorId, status, source: "EMAIL" } });
      expect((await get("beto", `/app/jobs/${job.number}`)).body.canCancel).toBe(false);
      const res = await request(app.getHttpServer()).post(`/app/jobs/${job.number}/cancel`).set("Authorization", `Bearer ${tokens.beto}`);
      expect(res.status).toBe(409);
      expect((await prisma.jobOrder.findUniqueOrThrow({ where: { id: job.id } })).status).toBe(status);
    }
  });
});
