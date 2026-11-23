import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { processFileChecks } from "../src/file-check";
import { downloadLink, filenameFrom, isAllowedHost, linkTarget, type DownloadResult, type LinkTarget } from "../src/links/download";
import { processLinkDownloads } from "../src/links/process";
import { LocalDiskStorage } from "../src/storage";
import { startTestDb } from "./test-db";

let prisma: PrismaClient;
let stopDb: () => Promise<void>;
const dir = mkdtempSync(join(tmpdir(), "vv-links-"));
const storage = new LocalDiskStorage(dir);
let sectorId = "";
let customerId = "";

const DRIVE = "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing";
const ONEDRIVE = "https://1drv.ms/i/c/0123456789abcdef/EaBcDeFgHiJkLmNoPqRsTuVwXyZ";

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
const job = (links: string[], extra: object = {}) =>
  prisma.jobOrder.create({ data: { customerId, sectorId, status: "RECEIVED", source: "EMAIL", description: "Remeras 58 x 100 cm", externalLinks: links, ...extra } });
const okWith = (content: Buffer, filename = "remeras.png") => async (): Promise<DownloadResult> => ({ ok: true, file: { filename, mime: "image/png", content } });

beforeAll(async () => {
  const db = await startTestDb();
  stopDb = db.stop;
  prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
  sectorId = (await prisma.sector.create({ data: { code: "DTF", name: "DTF" } })).id;
  customerId = (await prisma.customer.create({ data: { status: "ACTIVE", firstName: "Ana" } })).id;
});
beforeEach(async () => {
  await prisma.jobFile.deleteMany();
  await prisma.jobOrder.deleteMany();
});
afterAll(async () => {
  await prisma?.$disconnect();
  await stopDb?.();
  rmSync(dir, { recursive: true, force: true });
});

describe("links de Drive y OneDrive: de qué link se baja (D-072)", () => {
  it("D-072: reconoce los links de un archivo de Google Drive", () => {
    const direct = "https://drive.usercontent.google.com/download?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345&export=download&confirm=t";
    expect(linkTarget(DRIVE)).toEqual({ provider: "drive", url: direct });
    expect(linkTarget("https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345")).toEqual({ provider: "drive", url: direct });
    expect(linkTarget("https://drive.google.com/uc?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345&export=download")?.url).toBe(direct);
  });

  it("D-072: una carpeta, un documento u otro servicio no se bajan solos", () => {
    expect(linkTarget("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345?usp=sharing")).toBeNull();
    expect(linkTarget("https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit")).toBeNull();
    expect(linkTarget("https://we.tl/t-AbC123")).toBeNull();
    expect(linkTarget("http://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view")).toBeNull();
    expect(linkTarget("https://drive.google.com/open?id=../../etc/passwd")).toBeNull();
  });

  it("D-072: un link compartido de OneDrive se convierte en su descarga directa", () => {
    expect(linkTarget(ONEDRIVE)).toEqual({
      provider: "onedrive",
      url: "https://my.microsoftpersonalcontent.com/personal/0123456789abcdef/_layouts/15/download.aspx?share=EaBcDeFgHiJkLmNoPqRsTuVwXyZ",
    });
    expect(linkTarget(`${ONEDRIVE}?e=AbCd12`)?.url).toContain("share=EaBcDeFgHiJkLmNoPqRsTuVwXyZ");
    // Otras formas de link de OneDrive no se bajan solas.
    expect(linkTarget("https://1drv.ms/u/s!AbCdEfGhIjKlMnOp")).toBeNull();
    expect(linkTarget("https://onedrive.live.com/?id=root&cid=0123456789ABCDEF")).toBeNull();
  });

  it("D-072: solo se permiten direcciones del propio servicio", () => {
    expect(isAllowedHost("drive", "https://doc-0s-1c-docs.googleusercontent.com/docs/securesc/x")).toBe(true);
    expect(isAllowedHost("drive", "https://drive.google.com.atacante.com/x")).toBe(false);
    expect(isAllowedHost("drive", "https://postgres:5432/")).toBe(false);
    expect(isAllowedHost("drive", "https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedHost("drive", "https://usuario@drive.google.com/x")).toBe(false);
    expect(isAllowedHost("drive", "http://drive.google.com/x")).toBe(false);
    expect(isAllowedHost("onedrive", "https://my.microsoftpersonalcontent.com/personal/abc/_layouts/15/download.aspx?share=x")).toBe(true);
    expect(isAllowedHost("onedrive", "https://microsoftpersonalcontent.com.atacante.com/x")).toBe(false);
    expect(isAllowedHost("onedrive", "https://drive.google.com/x")).toBe(false);
  });

  it("D-072: el nombre del archivo nunca trae rutas", () => {
    expect(filenameFrom(`attachment; filename="remeras escuela.png"`, "archivo")).toBe("remeras escuela.png");
    expect(filenameFrom(`attachment; filename="x.png"; filename*=UTF-8''dise%C3%B1o%20final.png`, "archivo")).toBe("diseño final.png");
    expect(filenameFrom(`attachment; filename="../../etc/passwd"`, "archivo")).toBe("_.._etc_passwd");
    expect(filenameFrom(null, "archivo")).toBe("archivo");
  });
});

describe("links de Drive y OneDrive: la descarga (D-072)", () => {
  const target: LinkTarget = { provider: "drive", url: "https://drive.usercontent.google.com/download?id=abc" };
  const respond = (status: number, headers: Record<string, string>, body?: Buffer | string) => new Response(status >= 300 && status < 400 ? null : (body ?? ""), { status, headers });
  /** Servidor de mentira: responde según la dirección pedida y anota a dónde se conectó. */
  const fake = (routes: Record<string, () => Response>) => {
    const visited: string[] = [];
    const impl = (async (url: string | URL | Request) => {
      visited.push(String(url));
      const r = routes[String(url)];
      if (!r) throw new Error(`conexión no esperada a ${String(url)}`);
      return r();
    }) as typeof fetch;
    return { impl, visited };
  };

  it("D-072: sigue la redirección de Drive y baja el archivo con su nombre", async () => {
    const final = "https://doc-0s-1c-docs.googleusercontent.com/docs/x";
    const { impl } = fake({
      [target.url]: () => respond(303, { location: final }),
      [final]: () => respond(200, { "content-type": "image/png", "content-disposition": `attachment; filename="remeras.png"` }, png(10, 10)),
    });
    const r = await downloadLink(target, { maxBytes: 1000, fetchImpl: impl });
    expect(r).toMatchObject({ ok: true, file: { filename: "remeras.png", mime: "image/png" } });
  });

  it("D-072: si la descarga manda a otro servidor, no se conecta", async () => {
    const { impl, visited } = fake({ [target.url]: () => respond(302, { location: "https://169.254.169.254/latest/meta-data" }) });
    expect(await downloadLink(target, { maxBytes: 1000, fetchImpl: impl })).toEqual({ ok: false, reason: "error" });
    expect(visited).toEqual([target.url]);
  });

  it("D-072: un link que pide iniciar sesión o devuelve una página no es público", async () => {
    const login = fake({ [target.url]: () => respond(302, { location: "https://accounts.google.com/ServiceLogin?x=1" }) });
    expect(await downloadLink(target, { maxBytes: 1000, fetchImpl: login.impl })).toEqual({ ok: false, reason: "private" });
    const page = fake({ [target.url]: () => respond(200, { "content-type": "text/html; charset=utf-8" }, "<html>Necesitás permiso</html>") });
    expect(await downloadLink(target, { maxBytes: 1000, fetchImpl: page.impl })).toEqual({ ok: false, reason: "private" });
  });

  it("D-072: corta si el archivo pasa el máximo, aunque el servidor no avise el tamaño", async () => {
    const declared = fake({ [target.url]: () => respond(200, { "content-type": "image/png", "content-length": "5000" }, png(10, 10)) });
    expect(await downloadLink(target, { maxBytes: 1000, fetchImpl: declared.impl })).toEqual({ ok: false, reason: "too_big" });
    const silent = fake({ [target.url]: () => respond(200, { "content-type": "image/png" }, Buffer.alloc(5000)) });
    expect(await downloadLink(target, { maxBytes: 1000, fetchImpl: silent.impl })).toEqual({ ok: false, reason: "too_big" });
  });

  it("D-072: un link borrado se informa como que ya no existe", async () => {
    const { impl } = fake({ [target.url]: () => respond(404, {}) });
    expect(await downloadLink(target, { maxBytes: 1000, fetchImpl: impl })).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("links de Drive y OneDrive: el archivo queda en el pedido (D-072)", () => {
  it("D-072: el archivo del link queda guardado en el pedido y pasa por el control automático", async () => {
    const j = await job([DRIVE]);
    expect(await processLinkDownloads(prisma, storage, okWith(png(6850, 11811)))).toEqual({ jobs: 1, files: 1, failed: 0 });
    const file = await prisma.jobFile.findFirstOrThrow({ where: { jobId: j.id } });
    expect(file).toMatchObject({ filename: "remeras.png", mime: "image/png", sizeBytes: 64n });
    expect((await storage.get(file.storageKey)).length).toBe(64);
    await processFileChecks(prisma, storage);
    expect((await prisma.jobOrder.findUniqueOrThrow({ where: { id: j.id } })).fileCheck).toMatchObject({ verdict: "ok", file: "remeras.png" });
  });

  it("D-072: cada pedido se intenta una sola vez", async () => {
    await job([DRIVE]);
    let calls = 0;
    const counting = async (): Promise<DownloadResult> => (calls++, { ok: false, reason: "error" });
    await processLinkDownloads(prisma, storage, counting);
    expect(await processLinkDownloads(prisma, storage, counting)).toEqual({ jobs: 0, files: 0, failed: 0 });
    expect(calls).toBe(1);
  });

  it("D-072: si el link no es público, la tarjeta le dice al operador qué pedirle al cliente", async () => {
    const j = await job([DRIVE]);
    expect(await processLinkDownloads(prisma, storage, async () => ({ ok: false, reason: "private" }))).toEqual({ jobs: 1, files: 0, failed: 1 });
    await processFileChecks(prisma, storage);
    const after = await prisma.jobOrder.findUniqueOrThrow({ where: { id: j.id } });
    expect(after.linksNote).toContain("el link no es público");
    expect(after.fileCheck).toMatchObject({ verdict: "unknown", hint: after.linksNote });
    expect(await prisma.jobFile.count()).toBe(0);
  });

  it("D-072: un link de otro servicio no se baja y se avisa", async () => {
    const j = await job(["https://we.tl/t-AbC123"]);
    let called = false;
    await processLinkDownloads(prisma, storage, async () => ((called = true), { ok: false, reason: "error" }));
    expect(called).toBe(false);
    expect((await prisma.jobOrder.findUniqueOrThrow({ where: { id: j.id } })).linksNote).toContain("no se baja solo");
  });

  it("D-072: no toca pedidos entregados, cancelados, borrados ni sin links", async () => {
    await job([DRIVE], { status: "DELIVERED" });
    await job([DRIVE], { status: "CANCELLED" });
    await job([DRIVE], { deletedAt: new Date() });
    await job([]);
    expect(await processLinkDownloads(prisma, storage, okWith(png(10, 10)))).toEqual({ jobs: 0, files: 0, failed: 0 });
  });

  it("D-073: baja todos los links del pedido, sin tope", async () => {
    const links = Array.from({ length: 8 }, (_, i) => `https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz01234${i}/view`);
    const j = await job(links);
    let n = 0;
    const each = async (): Promise<DownloadResult> => ({ ok: true, file: { filename: `hoja-${++n}.png`, mime: "image/png", content: png(10, 10) } });
    expect(await processLinkDownloads(prisma, storage, each)).toEqual({ jobs: 1, files: 8, failed: 0 });
    expect(await prisma.jobFile.count({ where: { jobId: j.id } })).toBe(8);
  });
});
