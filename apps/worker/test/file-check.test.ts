import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FILE_CHECK_SETTING_KEY, processFileChecks } from "../src/file-check";
import { ingestMail } from "../src/mail/ingest";
import { LocalDiskStorage } from "../src/storage";
import { buildMail } from "./mail-fixtures";
import { startTestDb } from "./test-db";

let prisma: PrismaClient;
let stopDb: () => Promise<void>;
const dir = mkdtempSync(join(tmpdir(), "vv-filecheck-"));
const storage = new LocalDiskStorage(dir);
let sector: { id: string; code: string; name: string; inboxEmail: string | null } & Record<string, unknown>;
const deps = () => ({ prisma, storage, notifier: { async sendSignupInvite() {} } });
let seq = 0;

/** PNG mínimo con ese tamaño en píxeles. */
function png(width: number, height: number): Buffer {
  const b = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]).copy(b);
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  b[24] = 8;
  b[25] = 6;
  return b;
}
const mail = (text: string, file: Buffer, name = "remera.png") =>
  buildMail({ from: "ana@cliente.test", to: "dtf@viavinilo.test", subject: "Pedido DTF", messageId: `<fc-${++seq}@cliente.test>`, text, attachments: [{ filename: name, content: file, contentType: "image/png" }] });

beforeAll(async () => {
  const db = await startTestDb();
  stopDb = db.stop;
  prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
  sector = await prisma.sector.create({ data: { code: "DTF", name: "DTF", inboxEmail: "dtf@viavinilo.test" } });
  await prisma.fileErrorReason.create({ data: { code: "LOW_RESOLUTION", label: "Resolución baja" } });
  await prisma.customer.create({ data: { status: "ACTIVE", firstName: "Ana", emails: { create: { email: "ana@cliente.test", isPrimary: true } } } });
});
beforeEach(async () => {
  await prisma.message.deleteMany();
  await prisma.jobEvent.deleteMany();
  await prisma.jobFile.deleteMany();
  await prisma.jobOrder.deleteMany();
  await prisma.appSetting.deleteMany();
});
afterAll(async () => {
  await prisma?.$disconnect();
  await stopDb?.();
  rmSync(dir, { recursive: true, force: true });
});

const autoOn = () => prisma.appSetting.create({ data: { key: FILE_CHECK_SETTING_KEY, value: { enabled: true, since: new Date(Date.now() - 60_000).toISOString() } } });

describe("control automático del archivo en el pedido (D-065)", () => {
  it("D-065: apagado, solo deja la sugerencia en el pedido y no lo mueve", async () => {
    const r = await ingestMail(deps(), sector as never, await mail("Medida: 58 x 100 cm", png(1500, 2586)));
    expect(await processFileChecks(prisma, storage)).toEqual({ checked: 1, errors: 0 });
    const job = await prisma.jobOrder.findUniqueOrThrow({ where: { id: r.jobId! } });
    expect(job.status).toBe("RECEIVED");
    expect(job.fileCheck).toMatchObject({ verdict: "error", reasonCode: "LOW_RESOLUTION", effectiveDpi: 66 });
    // No se vuelve a controlar.
    expect(await processFileChecks(prisma, storage)).toEqual({ checked: 0, errors: 0 });
  });

  it("D-065: prendido, un archivo claramente pixelado pasa solo a 'Archivo con error' con el motivo", async () => {
    await autoOn();
    const r = await ingestMail(deps(), sector as never, await mail("Medida: 58 x 100 cm", png(1500, 2586)));
    expect(await processFileChecks(prisma, storage)).toEqual({ checked: 1, errors: 1 });
    const job = await prisma.jobOrder.findUniqueOrThrow({ where: { id: r.jobId! }, include: { events: { orderBy: { createdAt: "desc" }, include: { reason: true } } } });
    expect(job.status).toBe("FILE_ERROR");
    expect(job.events[0]).toMatchObject({ fromStatus: "RECEIVED", toStatus: "FILE_ERROR", userId: null });
    expect(job.events[0]!.reason?.code).toBe("LOW_RESOLUTION");
    expect(job.events[0]!.note).toContain("da 66 dpi; el mínimo para DTF es 250");
  });

  it("D-065: prendido, un archivo bueno o dudoso no se mueve; sin medida no opina", async () => {
    await autoOn();
    const good = await ingestMail(deps(), sector as never, await mail("58 x 100 cm", png(6850, 11811)));
    const doubt = await ingestMail(deps(), sector as never, await mail("58 x 100 cm", png(4000, 6900)));
    const noMeasure = await ingestMail(deps(), sector as never, await mail("va el archivo", png(100, 100)));
    expect(await processFileChecks(prisma, storage)).toEqual({ checked: 3, errors: 0 });
    const verdict = async (id: string) => ((await prisma.jobOrder.findUniqueOrThrow({ where: { id } })).fileCheck as { verdict: string }).verdict;
    expect([await verdict(good.jobId!), await verdict(doubt.jobId!), await verdict(noMeasure.jobId!)]).toEqual(["ok", "review", "unknown"]);
    expect(await prisma.jobOrder.count({ where: { status: "FILE_ERROR" } })).toBe(0);
  });

  it("D-065: el cliente manda el archivo corregido y el mismo pedido vuelve solo a 'Archivo recibido'", async () => {
    await autoOn();
    const first = await ingestMail(deps(), sector as never, await mail("Medida: 58 x 100 cm", png(1500, 2586)));
    await processFileChecks(prisma, storage);
    const raw = await mail("Ahí va corregido", png(6850, 11811), "remera-corregida.png");
    const second = await ingestMail(deps(), sector as never, raw);
    expect(second).toMatchObject({ result: "RESENT", jobId: first.jobId });
    expect(await prisma.jobOrder.count()).toBe(1);
    // El mismo mail leído dos veces no duplica el archivo.
    expect((await ingestMail(deps(), sector as never, raw)).result).toBe("DUPLICATE");
    let job = await prisma.jobOrder.findUniqueOrThrow({ where: { id: first.jobId! }, include: { files: true } });
    expect(job.status).toBe("RECEIVED");
    expect(job.files).toHaveLength(2);
    // Se vuelve a controlar con el archivo nuevo y la medida del primer mail: ahora está bien.
    expect(await processFileChecks(prisma, storage)).toEqual({ checked: 1, errors: 0 });
    job = await prisma.jobOrder.findUniqueOrThrow({ where: { id: first.jobId! }, include: { files: true } });
    expect(job.fileCheck).toMatchObject({ verdict: "ok", file: "remera-corregida.png" });
  });

  it("D-071: con la medida sin unidad ('58x100') controla igual, pero nunca mueve el pedido solo", async () => {
    await autoOn();
    const r = await ingestMail(deps(), sector as never, await mail("dtf 58x100 para el sábado", png(1500, 2586)));
    expect(await processFileChecks(prisma, storage)).toEqual({ checked: 1, errors: 0 });
    const job = await prisma.jobOrder.findUniqueOrThrow({ where: { id: r.jobId! } });
    expect(job.status).toBe("RECEIVED");
    expect(job.fileCheck).toMatchObject({ verdict: "review", effectiveDpi: 66 });
  });

  it("D-071: sin ninguna medida deja el dato de hasta qué tamaño se puede imprimir", async () => {
    const r = await ingestMail(deps(), sector as never, await mail("Hola, te mando el archivo", png(5709, 9843)));
    await processFileChecks(prisma, storage);
    const job = await prisma.jobOrder.findUniqueOrThrow({ where: { id: r.jobId! } });
    expect(job.fileCheck).toMatchObject({ verdict: "unknown", hint: "Tiene 5709 × 9843 píxeles: alcanza para imprimir hasta 58 × 100 cm a 250 dpi." });
  });

  it("D-071: un PDF se controla por el tamaño de su página", async () => {
    const pdf = Buffer.from(["%PDF-1.4", "1 0 obj", "<< /Type /Page /MediaBox [0 0 1644.09 2834.65] >>", "endobj", ""].join("\n"));
    const r = await ingestMail(deps(), sector as never, await mail("Medida: 58 x 100 cm", pdf, "remeras.pdf"));
    await processFileChecks(prisma, storage);
    const job = await prisma.jobOrder.findUniqueOrThrow({ where: { id: r.jobId! } });
    expect(job.fileCheck).toMatchObject({ verdict: "ok", detail: "El PDF mide 58 × 100 cm, lo pedido.", file: "remeras.pdf" });
  });
});
