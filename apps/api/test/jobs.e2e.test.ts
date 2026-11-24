import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import type { JobStatus, PrismaClient, Sector } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FILE_ERROR_REASONS, MACHINES, buildSectors } from "../prisma/seed-data";
import { startTestDb } from "./test-db";

let app: INestApplication;
let prisma: PrismaClient;
let stopDb: () => Promise<void>;
let baseUrl: string;
const tokens = { owner: "", attention: "", production: "", latex: "", granFormato: "" };
const sectors: Record<string, Sector> = {};
let customerId: string;
let reasonId: string;

const http = (role: keyof typeof tokens) => ({
  get: (url: string) => request(app.getHttpServer()).get(url).set("Authorization", `Bearer ${tokens[role]}`),
  post: (url: string, body?: object) =>
    request(app.getHttpServer()).post(url).set("Authorization", `Bearer ${tokens[role]}`).send(body),
  patch: (url: string, body: object) =>
    request(app.getHttpServer()).patch(url).set("Authorization", `Bearer ${tokens[role]}`).send(body),
});

let seq = 0;
async function newJob(sector = "DTF", extra: { status?: JobStatus; depositRequired?: boolean; materialProductId?: string } = {}) {
  return prisma.jobOrder.create({
    data: {
      customerId,
      sectorId: sectors[sector]!.id,
      status: extra.status ?? "RECEIVED",
      source: "EMAIL",
      sourceMessageId: `<job-${++seq}@test>`,
      description: `Trabajo ${seq}`,
      depositRequired: extra.depositRequired ?? false,
      materialProductId: extra.materialProductId,
    },
  });
}

beforeAll(async () => {
  const db = await startTestDb();
  stopDb = db.stop;
  process.env.DATABASE_URL = db.url;
  process.env.JWT_SECRET = "secreto-de-prueba-de-al-menos-32-caracteres";
  process.env.BOARD_POLL_MS = "150";

  const { NestFactory } = await import("@nestjs/core");
  const { JwtService } = await import("@nestjs/jwt");
  const { AppModule } = await import("../src/app.module");
  const { PrismaService } = await import("../src/prisma/prisma.service");
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, "127.0.0.1");
  baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  prisma = app.get(PrismaService);

  // Mismos datos que el seed: sectores con su secuencia, máquinas y motivos de error.
  for (const s of buildSectors("viavinilo.test")) {
    sectors[s.code] = await prisma.sector.create({
      data: { code: s.code, name: s.name, inboxEmail: s.inboxEmail, stages: { create: s.stages } },
    });
  }
  // D-082: los sub-servicios cuelgan de su tablero, igual que en el seed.
  for (const s of buildSectors("viavinilo.test")) {
    if (s.parent) await prisma.sector.update({ where: { code: s.code }, data: { parentId: sectors[s.parent]!.id } });
  }
  for (const m of MACHINES) {
    await prisma.machine.create({
      data: { name: m.name, sectors: { create: m.sectors.map((c) => ({ sectorId: sectors[c]!.id })) } },
    });
  }
  await prisma.fileErrorReason.createMany({ data: FILE_ERROR_REASONS });
  reasonId = (await prisma.fileErrorReason.findUniqueOrThrow({ where: { code: "LOW_RESOLUTION" } })).id;

  const owner = await prisma.user.create({ data: { email: "duenio@vv.test", name: "Dueño", roles: ["OWNER"] } });
  const attention = await prisma.user.create({ data: { email: "asesor@vv.test", name: "Asesor", roles: ["ATTENTION"] } });
  const production = await prisma.user.create({
    data: { email: "dtf@vv.test", name: "Impresor DTF", roles: ["PRODUCTION"], sectors: { create: { sectorId: sectors.DTF!.id } } },
  });
  const latex = await prisma.user.create({
    data: { email: "latex@vv.test", name: "Impresor Látex", roles: ["PRODUCTION"], sectors: { create: { sectorId: sectors.LATEX!.id } } },
  });
  const granFormato = await prisma.user.create({
    data: { email: "gf@vv.test", name: "Encargado Gran Formato", roles: ["PRODUCTION"], sectors: { create: { sectorId: sectors.GRAN_FORMATO!.id } } },
  });
  const jwt = app.get(JwtService);
  tokens.latex = await jwt.signAsync({ sub: latex.id });
  tokens.granFormato = await jwt.signAsync({ sub: granFormato.id });
  tokens.owner = await jwt.signAsync({ sub: owner.id });
  tokens.attention = await jwt.signAsync({ sub: attention.id });
  tokens.production = await jwt.signAsync({ sub: production.id });

  customerId = (
    await prisma.customer.create({
      data: { status: "ACTIVE", firstName: "Juan", lastName: "Pérez", searchText: "juan perez", dni: "30123456" },
    })
  ).id;
});

afterAll(async () => {
  await app?.close();
  await stopDb?.();
});

describe("tablero de producción (E1.4)", () => {
  it("muestra las columnas de la secuencia del sector, con 'Archivo con error' después de 'Archivo recibido'", async () => {
    const res = await http("production").get("/jobs/board?sector=DTF");
    expect(res.status).toBe(200);
    expect(res.body.columns.map((c: { key: string }) => c.key)).toEqual([
      "RECEIVED", "FILE_ERROR", "QUOTED", "AWAITING_DEPOSIT", "DEPOSIT_RECEIVED", "PRINTED", "READY", "DELIVERED",
    ]);
    expect(res.body.columns[0].label).toBe("Archivo recibido");
    expect(res.body.machines).toHaveLength(5);
  });

  it("ordena por llegada, no muestra altas pendientes ni canceladas, y cada tarjeta trae su próximo paso", async () => {
    const a = await newJob();
    const b = await newJob();
    await newJob("DTF", { status: "PENDING_SIGNUP" });
    await newJob("DTF", { status: "CANCELLED" });
    const res = await http("production").get("/jobs/board?sector=DTF");
    const received = res.body.columns[0].cards;
    expect(received.map((c: { id: string }) => c.id)).toEqual([a.id, b.id]);
    expect(received[0]).toMatchObject({ label: `VV-${String(a.number).padStart(6, "0")}`, next: "QUOTED", other: ["FILE_ERROR", "CANCELLED"] });
    expect(received[0].customer).toMatchObject({ name: "Juan Pérez" });
    const all = res.body.columns.flatMap((c: { cards: { status: string }[] }) => c.cards.map((x) => x.status));
    expect(all).not.toContain("PENDING_SIGNUP");
    expect(all).not.toContain("CANCELLED");
  });

  it("D-017: producción solo ve el tablero de su sector; dueño y atención ven todos", async () => {
    expect((await http("production").get("/jobs/board?sector=GRAN_FORMATO")).status).toBe(403);
    expect((await http("attention").get("/jobs/board?sector=GRAN_FORMATO")).status).toBe(200);
    const visible = await http("production").get("/sectors");
    expect(visible.body.map((s: { code: string }) => s.code)).toEqual(["DTF"]);
  });

  it("busca por número de orden y por cliente sin tildes", async () => {
    const job = await newJob();
    const byNumber = await http("production").get(`/jobs/board?sector=DTF&q=VV-${String(job.number).padStart(6, "0")}`);
    expect(byNumber.body.columns[0].cards.map((c: { id: string }) => c.id)).toEqual([job.id]);
    const byName = await http("production").get("/jobs/board?sector=DTF&q=perez");
    expect(byName.body.columns[0].cards.length).toBeGreaterThan(0);
  });

  it("E1.4: marca cuántas órdenes pendientes comparten material, para imprimirlas juntas", async () => {
    const vinilo = await prisma.product.create({ data: { name: "Vinilo blanco 1,52", isPrintMedia: true } });
    const a = await newJob("CALANDRADO", { materialProductId: vinilo.id });
    await newJob("CALANDRADO", { materialProductId: vinilo.id });
    await newJob("CALANDRADO");
    const res = await http("owner").get("/jobs/board?sector=CALANDRADO&groupByMaterial=true");
    const cards = res.body.columns[0].cards;
    expect(cards.find((c: { id: string }) => c.id === a.id).sameMaterialCount).toBe(1);
    // Agrupado por material: las dos del mismo material quedan juntas y primero.
    expect(cards.slice(0, 2).every((c: { material: { id: string } | null }) => c.material?.id === vinilo.id)).toBe(true);
  });
});

describe("sub-servicios de un tablero (D-082)", () => {
  type C = { id: string; service: { code: string; name: string } | null };
  const cardsOf = (body: { columns: { cards: C[] }[] }) => body.columns.flatMap((c) => c.cards);

  it("D-082: el tablero de Gran Formato junta los pedidos de sus sub-servicios y dice de cuál es cada uno", async () => {
    const general = await newJob("GRAN_FORMATO");
    const latex = await newJob("LATEX");
    const cortes = await newJob("CORTES");
    const res = await http("owner").get("/jobs/board?sector=GRAN_FORMATO");
    expect(res.body.services.map((s: { code: string }) => s.code).sort()).toEqual(["CORTES", "ECOSOLVENTE", "LATEX", "UV_RIGIDOS", "UV_ROLLO"]);
    const cards = cardsOf(res.body);
    expect(cards.find((c) => c.id === general.id)?.service).toBeNull();
    expect(cards.find((c) => c.id === latex.id)?.service).toEqual({ code: "LATEX", name: "Látex" });
    expect(cards.find((c) => c.id === cortes.id)?.service?.name).toBe("Cortes");

    const soloLatex = await http("owner").get("/jobs/board?sector=GRAN_FORMATO&service=LATEX");
    expect(cardsOf(soloLatex.body).map((c) => c.id)).toEqual([latex.id]);
    expect((await http("owner").get("/jobs/board?sector=GRAN_FORMATO&service=DTF")).status).toBe(404);
  });

  it("D-082: en la lista de tableros no aparecen los sub-servicios sueltos", async () => {
    const res = await http("owner").get("/sectors");
    const codes = res.body.map((s: { code: string }) => s.code);
    expect(codes.sort()).toEqual(["CALANDRADO", "DTF", "DTF_UV", "GRAN_FORMATO", "SUBLIMACION", "TPU"]);
    expect(res.body.find((s: { code: string }) => s.code === "GRAN_FORMATO").services).toHaveLength(5);
  });

  it("D-017 y D-082: quien tiene Gran Formato ve sus sub-servicios; quien tiene solo Látex entra a ese tablero y ve solo lo suyo", async () => {
    const latex = await newJob("LATEX");
    const cortes = await newJob("CORTES");
    const all = cardsOf((await http("granFormato").get("/jobs/board?sector=GRAN_FORMATO")).body).map((c) => c.id);
    expect(all).toEqual(expect.arrayContaining([latex.id, cortes.id]));

    const visible = await http("latex").get("/sectors");
    expect(visible.body.map((s: { code: string }) => s.code)).toEqual(["GRAN_FORMATO"]);
    expect(visible.body[0].services).toEqual([{ code: "LATEX", name: "Látex" }]);
    const mine = await http("latex").get("/jobs/board?sector=GRAN_FORMATO");
    const ids = cardsOf(mine.body).map((c) => c.id);
    expect(ids).toContain(latex.id);
    expect(ids).not.toContain(cortes.id);
    expect((await http("latex").post(`/jobs/${cortes.id}/transition`, { to: "QUOTED", quotedAmount: "1000" })).status).toBe(403);
    expect((await http("latex").get("/jobs/board?sector=DTF")).status).toBe(403);
  });

  it("D-082: un pedido se puede pasar a otro sub-servicio del mismo tablero, no a otro tablero; queda auditado", async () => {
    const job = await newJob("GRAN_FORMATO");
    const detail = await http("owner").get(`/jobs/${job.id}`);
    expect(detail.body.services.map((s: { code: string }) => s.code)).toContain("ECOSOLVENTE");

    const moved = await http("granFormato").patch(`/jobs/${job.id}/service`, { sector: "ECOSOLVENTE" });
    expect(moved.status).toBe(200);
    expect(moved.body.service).toEqual({ code: "ECOSOLVENTE", name: "Ecosolvente" });
    const audit = await prisma.auditLog.findFirst({ where: { entityId: job.id, action: "service" } });
    expect(audit?.after).toEqual({ sector: "ECOSOLVENTE" });

    const otro = await http("owner").patch(`/jobs/${job.id}/service`, { sector: "DTF" });
    expect(otro.status).toBe(400);
    expect(otro.body.message).toBe("Ese servicio no es de este tablero");
    // De vuelta al tablero general.
    expect((await http("owner").patch(`/jobs/${job.id}/service`, { sector: "GRAN_FORMATO" })).body.service).toBeNull();
  });
});

describe("sucursal de retiro (D-083)", () => {
  it("D-083: el taller ve y corrige dónde retira el cliente; queda auditado", async () => {
    const job = await newJob();
    const set = await http("production").patch(`/jobs/${job.id}/pickup`, { branch: "chile" });
    expect(set.status).toBe(200);
    expect(set.body.pickupBranch).toBe("chile");
    const board = await http("production").get("/jobs/board?sector=DTF");
    const card = board.body.columns.flatMap((c: { cards: { id: string }[] }) => c.cards).find((c: { id: string }) => c.id === job.id);
    expect(card.pickupBranch).toBe("chile");
    const audit = await prisma.auditLog.findFirst({ where: { entityId: job.id, action: "pickup" } });
    expect(audit?.after).toEqual({ pickupBranch: "chile" });
    expect((await http("production").patch(`/jobs/${job.id}/pickup`, { branch: "tucuman" })).status).toBe(400);
    expect((await http("production").patch(`/jobs/${job.id}/pickup`, { branch: null })).body.pickupBranch).toBeNull();
  });
});

describe("cambios de estado", () => {
  it("actualización §2.4: los pasos no se pueden saltear", async () => {
    const job = await newJob();
    const res = await http("production").post(`/jobs/${job.id}/transition`, { to: "PRINTED" });
    expect(res.status).toBe(422);
    expect(res.body.message).toBe("Los pasos no se pueden saltear: falta completar el paso anterior");
  });

  it("R-JOB-2: para cotizar hay que cargar el precio; el cambio de precio queda auditado", async () => {
    const job = await newJob();
    const sinPrecio = await http("production").post(`/jobs/${job.id}/transition`, { to: "QUOTED" });
    expect(sinPrecio.status).toBe(422);
    expect(sinPrecio.body.message).toBe("Para cotizar hay que cargar el precio");

    const res = await http("production").post(`/jobs/${job.id}/transition`, {
      to: "QUOTED",
      quotedAmount: "18500,50",
      estimatedReadyAt: "2026-11-20T18:00:00-03:00",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "QUOTED", quotedAmount: "18500.5", next: "PRINTED" });
    expect(new Date(res.body.estimatedReadyAt).toISOString()).toBe("2026-11-20T21:00:00.000Z");
    const audit = await prisma.auditLog.findFirst({ where: { entityId: job.id, action: "price" } });
    expect(audit?.after).toEqual({ quotedAmount: "18500.5" });
    expect(res.body.events.map((e: { toStatus: string }) => e.toStatus)).toEqual(["QUOTED"]);
  });

  it("R-JOB-3: bloquea Impreso sin seña cuando la orden la requiere", async () => {
    const job = await newJob("DTF", { depositRequired: true });
    await http("production").post(`/jobs/${job.id}/transition`, { to: "QUOTED", quotedAmount: "10000" });
    const res = await http("production").post(`/jobs/${job.id}/transition`, { to: "PRINTED" });
    expect(res.status).toBe(422);
    expect(res.body.message).toBe("Primero hay que registrar la seña");

    const deposit = await http("production").post(`/jobs/${job.id}/transition`, { to: "DEPOSIT_RECEIVED" });
    expect(deposit.body).toMatchObject({ status: "DEPOSIT_RECEIVED", next: "PRINTED" });
    const row = await prisma.jobOrder.findUniqueOrThrow({ where: { id: job.id } });
    expect(row.paymentStatus).toBe("DEPOSIT");
    expect(row.depositPaidAt).not.toBeNull();
  });

  it("D-079: la seña se pide al cotizar; el pedido queda esperando ese monto y el cambio queda auditado", async () => {
    const job = await newJob();
    const mayor = await http("production").post(`/jobs/${job.id}/transition`, { to: "QUOTED", quotedAmount: "20.000", depositAmount: "25.000" });
    expect(mayor.status).toBe(422);
    expect(mayor.body.message).toBe("La seña no puede ser mayor que el precio");

    const res = await http("production").post(`/jobs/${job.id}/transition`, { to: "QUOTED", quotedAmount: "20.000", depositAmount: "10.000" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "QUOTED", quotedAmount: "20000", depositRequired: true, depositAmount: "10000", next: "DEPOSIT_RECEIVED" });
    const audit = await prisma.auditLog.findFirst({ where: { entityId: job.id, action: "deposit" } });
    expect(audit?.after).toEqual({ depositAmount: "10000" });
    // R-JOB-3 sigue valiendo: sin la seña no se imprime.
    expect((await http("production").post(`/jobs/${job.id}/transition`, { to: "PRINTED" })).status).toBe(422);
    const board = await http("production").get("/jobs/board?sector=DTF");
    const card = board.body.columns.flatMap((c: { cards: { id: string }[] }) => c.cards).find((c: { id: string }) => c.id === job.id);
    expect(card).toMatchObject({ depositRequired: true, depositAmount: "10000" });
  });

  it("D-081: el cotizado con seña pendiente va a la columna 'Esperando seña'; sin seña queda en 'Cotizado'", async () => {
    const conSena = await newJob();
    const sinSena = await newJob();
    await http("production").post(`/jobs/${conSena.id}/transition`, { to: "QUOTED", quotedAmount: "20.000", depositAmount: "10.000" });
    await http("production").post(`/jobs/${sinSena.id}/transition`, { to: "QUOTED", quotedAmount: "20.000" });
    const ids = async (key: string) => {
      const board = await http("production").get("/jobs/board?sector=DTF");
      const col = board.body.columns.find((c: { key: string }) => c.key === key);
      return { label: col.label as string, status: col.status as string, ids: col.cards.map((c: { id: string }) => c.id) as string[] };
    };
    const waiting = await ids("AWAITING_DEPOSIT");
    expect(waiting).toMatchObject({ label: "Esperando seña", status: "QUOTED" });
    expect(waiting.ids).toContain(conSena.id);
    expect(waiting.ids).not.toContain(sinSena.id);
    expect((await ids("QUOTED")).ids).toContain(sinSena.id);
    expect((await ids("QUOTED")).ids).not.toContain(conSena.id);
    // Al registrar la seña sale de la columna.
    await http("production").post(`/jobs/${conSena.id}/transition`, { to: "DEPOSIT_RECEIVED" });
    expect((await ids("AWAITING_DEPOSIT")).ids).not.toContain(conSena.id);
    expect((await ids("DEPOSIT_RECEIVED")).ids).toContain(conSena.id);
  });

  it("D-079: cotizar sin seña deja el pedido listo para imprimir, aunque antes la pidiera", async () => {
    const job = await newJob("DTF", { depositRequired: true });
    const res = await http("production").post(`/jobs/${job.id}/transition`, { to: "QUOTED", quotedAmount: "20.000", depositAmount: null });
    expect(res.body).toMatchObject({ status: "QUOTED", depositRequired: false, depositAmount: null, next: "PRINTED" });
  });

  it("R-JOB-3: solo el dueño puede forzar la impresión sin seña, y queda auditado", async () => {
    const job = await newJob("DTF", { depositRequired: true });
    await http("production").post(`/jobs/${job.id}/transition`, { to: "QUOTED", quotedAmount: "10000" });
    const prod = await http("production").post(`/jobs/${job.id}/transition`, { to: "PRINTED", force: true });
    expect(prod.status).toBe(403);
    const owner = await http("owner").post(`/jobs/${job.id}/transition`, { to: "PRINTED", force: true, note: "Cliente de confianza" });
    expect(owner.status).toBe(200);
    expect(owner.body.status).toBe("PRINTED");
    expect(owner.body.events.at(-1).note).toBe("Sin seña (forzado por el dueño): Cliente de confianza");
    const audit = await prisma.auditLog.findFirst({ where: { entityId: job.id, action: "force_without_deposit" } });
    expect(audit).not.toBeNull();
  });

  it("archivo con error: exige motivo, queda en el historial y vuelve a 'Archivo recibido'", async () => {
    const job = await newJob();
    expect((await http("production").post(`/jobs/${job.id}/transition`, { to: "FILE_ERROR" })).status).toBe(400);
    const err = await http("production").post(`/jobs/${job.id}/transition`, { to: "FILE_ERROR", reasonId });
    expect(err.body).toMatchObject({ status: "FILE_ERROR", next: "RECEIVED" });
    expect(err.body.events.at(-1)).toMatchObject({ toStatus: "FILE_ERROR", reason: "Resolución baja", user: "Impresor DTF" });
    const back = await http("production").post(`/jobs/${job.id}/transition`, { to: "RECEIVED", note: "Lo reenvió por mail" });
    expect(back.body.status).toBe("RECEIVED");
  });

  it("recorrido completo de Sublimación: pasa por calandra; al entregar corre la retención (D-015)", async () => {
    const job = await newJob("SUBLIMACION");
    const steps: [string, object?][] = [
      ["QUOTED", { quotedAmount: "5000" }], ["PRINTED"], ["CALENDERING"], ["READY"], ["DELIVERED"],
    ];
    for (const [to, extra] of steps) {
      const res = await http("owner").post(`/jobs/${job.id}/transition`, { to, ...extra });
      expect(res.status, `pasar a ${to}`).toBe(200);
    }
    const row = await prisma.jobOrder.findUniqueOrThrow({ where: { id: job.id } });
    expect(row.deliveredAt).not.toBeNull();
    const board = await http("owner").get("/jobs/board?sector=SUBLIMACION");
    const delivered = board.body.columns.find((c: { status: string }) => c.status === "DELIVERED");
    expect(delivered.cards.map((c: { id: string }) => c.id)).toContain(job.id);
    const closed = await http("owner").post(`/jobs/${job.id}/transition`, { to: "CANCELLED", note: "x" });
    expect(closed.status).toBe(422);
  });

  it("cancelar exige motivo", async () => {
    const job = await newJob();
    expect((await http("attention").post(`/jobs/${job.id}/transition`, { to: "CANCELLED" })).status).toBe(400);
    const ok = await http("attention").post(`/jobs/${job.id}/transition`, { to: "CANCELLED", note: "Lo pidió el cliente" });
    expect(ok.body.status).toBe("CANCELLED");
  });

  it("dos clics a la vez sobre la misma orden: uno solo avanza", async () => {
    const job = await newJob();
    const [a, b] = await Promise.all([
      http("production").post(`/jobs/${job.id}/transition`, { to: "QUOTED", quotedAmount: "100" }),
      http("production").post(`/jobs/${job.id}/transition`, { to: "QUOTED", quotedAmount: "100" }),
    ]);
    expect([a.status, b.status].filter((s) => s === 200)).toHaveLength(1);
    expect(await prisma.jobEvent.count({ where: { jobId: job.id } })).toBe(1);
  });

  it("producción no puede mover órdenes de otro sector", async () => {
    const job = await newJob("GRAN_FORMATO");
    expect((await http("production").post(`/jobs/${job.id}/transition`, { to: "QUOTED", quotedAmount: "1" })).status).toBe(403);
  });
});

describe("asignación de máquina", () => {
  it("solo acepta máquinas que trabajan en el sector de la orden", async () => {
    const job = await newJob();
    const dtfMachine = await prisma.machine.findUniqueOrThrow({ where: { name: "DTF 1" } });
    const gfMachine = await prisma.machine.findUniqueOrThrow({ where: { name: "Gran Formato 1" } });
    expect((await http("production").patch(`/jobs/${job.id}/machine`, { machineId: gfMachine.id })).status).toBe(400);
    const ok = await http("production").patch(`/jobs/${job.id}/machine`, { machineId: dtfMachine.id });
    expect(ok.body.machine).toEqual({ id: dtfMachine.id, name: "DTF 1" });
    const filtered = await http("production").get(`/jobs/board?sector=DTF&machineId=${dtfMachine.id}`);
    expect(filtered.body.columns[0].cards.map((c: { id: string }) => c.id)).toEqual([job.id]);
  });
});

describe("alta aprobada (D-014)", () => {
  it("al aprobar el alta, las órdenes pendientes pasan a 'Archivo recibido' y aparecen en el tablero", async () => {
    const pending = await prisma.customer.create({
      data: {
        status: "PENDING",
        firstName: "Ana",
        lastName: "Gómez",
        searchText: "ana gomez",
        dni: "28123456",
        emails: { create: { email: "ana@nuevo.test", isPrimary: true } },
        phones: { create: { phone: "+5493875551234", isPrimary: true } },
      },
    });
    const job = await prisma.jobOrder.create({
      data: { customerId: pending.id, sectorId: sectors.DTF!.id, status: "PENDING_SIGNUP", source: "EMAIL", sourceMessageId: "<ana@test>" },
    });
    const res = await http("attention").post(`/customers/${pending.id}/approve`);
    expect(res.status).toBe(200);
    const row = await prisma.jobOrder.findUniqueOrThrow({ where: { id: job.id }, include: { events: true } });
    expect(row.status).toBe("RECEIVED");
    expect(row.events.at(-1)).toMatchObject({ fromStatus: "PENDING_SIGNUP", toStatus: "RECEIVED", note: "Alta del cliente aprobada" });
  });
});

describe("tiempo real", () => {
  it("el stream avisa cuando entra una orden nueva al sector (también las que crea el worker)", async () => {
    const ctrl = new AbortController();
    const res = await fetch(`${baseUrl}/jobs/board/stream?sector=DTF`, {
      headers: { Authorization: `Bearer ${tokens.production}` },
      signal: ctrl.signal,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const versions: string[] = [];
    let buffer = "";
    // Formato SSE: bloques separados por línea en blanco, con líneas "event:", "id:" y "data:".
    const readUntil = async (n: number) => {
      while (versions.length < n) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const lines = block.split("\n");
          const event = lines.find((l) => l.startsWith("event: "))?.slice(7);
          const data = lines.find((l) => l.startsWith("data: "))?.slice(6);
          if (event !== "changed" || !data) continue;
          const v = JSON.parse(data).version as string;
          if (!versions.includes(v)) versions.push(v);
        }
      }
    };
    await readUntil(1);
    await newJob(); // como la crearía el worker de mails, directo en la base
    await readUntil(2);
    ctrl.abort();
    expect(versions).toHaveLength(2);
    expect(versions[1]).not.toBe(versions[0]);
  });
});

describe("listado de pedidos del ERP (Ventas → Pedidos)", () => {
  it("lista los pedidos reales por pestaña y producción solo ve los de su sector", async () => {
    const enCurso = await newJob("DTF");
    const listo = await newJob("DTF", { status: "READY" });
    const otroSector = await newJob("GRAN_FORMATO");

    const active = await http("attention").get("/jobs?tab=ACTIVE");
    expect(active.status).toBe(200);
    const ids = active.body.items.map((j: { id: string }) => j.id);
    expect(ids).toEqual(expect.arrayContaining([enCurso.id, otroSector.id]));
    expect(ids).not.toContain(listo.id);
    expect(active.body.items[0]).toHaveProperty("label");

    const ready = await http("attention").get("/jobs?tab=READY");
    expect(ready.body.items.map((j: { id: string }) => j.id)).toContain(listo.id);

    const prod = await http("production").get("/jobs?tab=ALL");
    expect(prod.body.items.every((j: { sector: { code: string } }) => j.sector.code === "DTF")).toBe(true);

    const bySector = await http("owner").get("/jobs?tab=ALL&sector=GRAN_FORMATO");
    expect(bySector.body.items.map((j: { id: string }) => j.id)).toContain(otroSector.id);
    const byNumber = await http("owner").get(`/jobs?tab=ALL&search=${otroSector.number}`);
    expect(byNumber.body.items.map((j: { id: string }) => j.id)).toContain(otroSector.id);
  });
});
