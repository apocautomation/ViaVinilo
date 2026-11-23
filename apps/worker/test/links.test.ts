import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { processFileChecks } from "../src/file-check";
import { driveFolderId, filenameFrom, isAllowedHost, isNoiseLink, linkTarget, openLink, resolveLink, type LinkTarget, type OpenResult } from "../src/links/download";
import { processLinkDownloads, type LinkClient } from "../src/links/process";
import { LocalDiskStorage } from "../src/storage";
import { startTestDb } from "./test-db";

let prisma: PrismaClient;
let stopDb: () => Promise<void>;
const dir = mkdtempSync(join(tmpdir(), "vv-links-"));
const storage = new LocalDiskStorage(dir);
let sectorId = "";
let customerId = "";

const DRIVE = "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing";
const DRIVE_DIRECT = "https://drive.usercontent.google.com/download?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345&export=download&confirm=t";
const ONEDRIVE = "https://1drv.ms/i/c/0123456789abcdef/EaBcDeFgHiJkLmNoPqRsTuVwXyZ";
const FOLDER = "https://drive.google.com/drive/folders/1FoLdErAbCdEfGhIjKlMnOpQrStUvWx?usp=sharing";

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
const streamOf = (content: Buffer) => new Response(content).body!;
const opened = (content: Buffer, filename = "remeras.png", declared = true): OpenResult => ({
  ok: true,
  file: { filename, mime: "image/png", declaredBytes: declared ? content.length : null, body: streamOf(content) },
});
/** Cliente de mentira: resuelve los links con las reglas reales pero sin salir a internet. */
const clientWith = (open: LinkClient["open"], resolve?: LinkClient["resolve"]): LinkClient => ({
  resolve: resolve ?? (async (link) => (linkTarget(link) ? { provider: linkTarget(link)!.provider, targets: [linkTarget(link)!] } : null)),
  open,
});
const job = (links: string[], extra: object = {}) =>
  prisma.jobOrder.create({ data: { customerId, sectorId, status: "RECEIVED", source: "EMAIL", description: "Remeras 58 x 100 cm", externalLinks: links, ...extra } });
const NO_MIN = { minFreeBytes: 0 };

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

describe("links: de qué link se baja (D-072, D-076)", () => {
  it("D-072: reconoce los links de un archivo de Google Drive", () => {
    expect(linkTarget(DRIVE)).toEqual({ provider: "drive", url: DRIVE_DIRECT });
    expect(linkTarget("https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345")).toEqual({ provider: "drive", url: DRIVE_DIRECT });
    expect(linkTarget("https://docs.google.com/uc?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345&export=download")?.url).toBe(DRIVE_DIRECT);
  });

  it("D-072: un documento de Google o un link armado no se toman como archivo", () => {
    expect(linkTarget("https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit")).toBeNull();
    expect(linkTarget("http://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view")).toBeNull();
    expect(linkTarget("https://drive.google.com/open?id=../../etc/passwd")).toBeNull();
    expect(linkTarget("https://mega.nz/file/AbCdEfGh#clave")).toBeNull();
  });

  it("D-072: un link compartido de OneDrive se convierte en su descarga directa", () => {
    expect(linkTarget(ONEDRIVE)).toEqual({
      provider: "onedrive",
      url: "https://my.microsoftpersonalcontent.com/personal/0123456789abcdef/_layouts/15/download.aspx?share=EaBcDeFgHiJkLmNoPqRsTuVwXyZ",
    });
    expect(linkTarget(`${ONEDRIVE}?e=AbCd12`)?.url).toContain("share=EaBcDeFgHiJkLmNoPqRsTuVwXyZ");
    expect(linkTarget("https://1drv.ms/u/s!AbCdEfGhIjKlMnOp")).toBeNull();
  });

  it("D-076: un link compartido de Dropbox se baja con dl=1", () => {
    expect(linkTarget("https://www.dropbox.com/scl/fi/abc123/remeras.png?rlkey=xyz&dl=0")).toEqual({ provider: "dropbox", url: "https://www.dropbox.com/scl/fi/abc123/remeras.png?rlkey=xyz&dl=1" });
    expect(linkTarget("https://www.dropbox.com/home")).toBeNull();
  });

  it("D-076: los links del pie de los mails de Google no son archivos y se ignoran", () => {
    expect(isNoiseLink("https://drive.google.com/abuse?id=AbCd")).toBe(true);
    expect(isNoiseLink("https://drive.google.com/drive/blockuser?blockerEmail=a@b.c")).toBe(true);
    expect(isNoiseLink(DRIVE)).toBe(false);
    expect(driveFolderId(FOLDER)).toBe("1FoLdErAbCdEfGhIjKlMnOpQrStUvWx");
    expect(driveFolderId(DRIVE)).toBeNull();
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
    expect(isAllowedHost("wetransfer", "https://download.wetransfer.com/eugv/abc")).toBe(true);
    expect(isAllowedHost("wetransfer", "https://wetransfer.com.atacante.com/x")).toBe(false);
    expect(isAllowedHost("onedrive", "https://drive.google.com/x")).toBe(false);
  });

  it("D-072: el nombre del archivo nunca trae rutas", () => {
    expect(filenameFrom(`attachment; filename="remeras escuela.png"`, "archivo")).toBe("remeras escuela.png");
    expect(filenameFrom(`attachment; filename="x.png"; filename*=UTF-8''dise%C3%B1o%20final.png`, "archivo")).toBe("diseño final.png");
    expect(filenameFrom(`attachment; filename="../../etc/passwd"`, "archivo")).toBe("_.._etc_passwd");
    expect(filenameFrom(null, "archivo")).toBe("archivo");
  });
});

describe("links: resolver y abrir la descarga (D-072, D-076)", () => {
  const target: LinkTarget = { provider: "drive", url: "https://drive.usercontent.google.com/download?id=abc" };
  const respond = (status: number, headers: Record<string, string>, body?: Buffer | string) => new Response(status >= 300 && status < 400 ? null : (body ?? ""), { status, headers });
  /** Servidor de mentira: responde según la dirección pedida y anota a dónde se conectó. */
  const fake = (routes: Record<string, (init?: RequestInit) => Response>) => {
    const visited: string[] = [];
    const impl = (async (url: string | URL | Request, init?: RequestInit) => {
      visited.push(String(url));
      const r = routes[String(url)];
      if (!r) throw new Error(`conexión no esperada a ${String(url)}`);
      return r(init);
    }) as typeof fetch;
    return { impl, visited };
  };
  const read = async (r: OpenResult) => (r.ok ? Buffer.from(await new Response(r.file.body).arrayBuffer()) : null);

  it("D-072: sigue la redirección de Drive y abre el archivo con su nombre", async () => {
    const final = "https://doc-0s-1c-docs.googleusercontent.com/docs/x";
    const { impl } = fake({
      [target.url]: () => respond(303, { location: final }),
      [final]: () => respond(200, { "content-type": "image/png", "content-length": "64", "content-disposition": `attachment; filename="remeras.png"` }, png(10, 10)),
    });
    const r = await openLink(target, { fetchImpl: impl });
    expect(r).toMatchObject({ ok: true, file: { filename: "remeras.png", mime: "image/png", declaredBytes: 64 } });
    expect((await read(r))!.length).toBe(64);
  });

  it("D-072: si la descarga manda a otro servidor, no se conecta", async () => {
    const { impl, visited } = fake({ [target.url]: () => respond(302, { location: "https://169.254.169.254/latest/meta-data" }) });
    expect(await openLink(target, { fetchImpl: impl })).toEqual({ ok: false, reason: "error" });
    expect(visited).toEqual([target.url]);
  });

  it("D-072: un link que pide iniciar sesión o devuelve una página no es público", async () => {
    const login = fake({ [target.url]: () => respond(302, { location: "https://accounts.google.com/ServiceLogin?x=1" }) });
    expect(await openLink(target, { fetchImpl: login.impl })).toEqual({ ok: false, reason: "private" });
    const page = fake({ [target.url]: () => respond(200, { "content-type": "text/html; charset=utf-8" }, "<html>Necesitás permiso</html>") });
    expect(await openLink(target, { fetchImpl: page.impl })).toEqual({ ok: false, reason: "private" });
  });

  it("D-072: un link borrado se informa como que ya no existe", async () => {
    const { impl } = fake({ [target.url]: () => respond(404, {}) });
    expect(await openLink(target, { fetchImpl: impl })).toEqual({ ok: false, reason: "not_found" });
  });

  it("D-076: una carpeta de Drive da una descarga por cada archivo", async () => {
    const html = `<a href="https://drive.google.com/file/d/1ArchivoUnoAbCdEfGhIjKl/view">a</a><a href="https://drive.google.com/file/d/1ArchivoDosAbCdEfGhIjKl/view">b</a><a href="https://drive.google.com/file/d/1ArchivoUnoAbCdEfGhIjKl/view">a</a>`;
    const { impl } = fake({ "https://drive.google.com/embeddedfolderview?id=1FoLdErAbCdEfGhIjKlMnOpQrStUvWx": () => respond(200, { "content-type": "text/html" }, html) });
    const r = await resolveLink(FOLDER, impl);
    expect(r).toMatchObject({ provider: "drive" });
    expect((r as { targets: LinkTarget[] }).targets.map((t) => t.url)).toEqual([
      "https://drive.usercontent.google.com/download?id=1ArchivoUnoAbCdEfGhIjKl&export=download&confirm=t",
      "https://drive.usercontent.google.com/download?id=1ArchivoDosAbCdEfGhIjKl&export=download&confirm=t",
    ]);
  });

  it("D-076: WeTransfer: del link corto a la descarga directa, pidiéndosela a su API", async () => {
    const page = "https://wetransfer.com/downloads/abcdef0123456789abcdef0123456789/a1b2c3?t_exp=1";
    const api = "https://wetransfer.com/api/v4/transfers/abcdef0123456789abcdef0123456789/download";
    let sent = "";
    const { impl } = fake({
      "https://we.tl/t-AbC123xyz": () => respond(302, { location: page }),
      [api]: (init) => ((sent = String(init?.body)), respond(200, { "content-type": "application/json" }, JSON.stringify({ direct_link: "https://download.wetransfer.com/eugv/x?token=1" }))),
    });
    expect(await resolveLink("https://we.tl/t-AbC123xyz", impl)).toEqual({ provider: "wetransfer", targets: [{ provider: "wetransfer", url: "https://download.wetransfer.com/eugv/x?token=1" }] });
    expect(JSON.parse(sent)).toEqual({ security_hash: "a1b2c3", intent: "entire_transfer" });
  });

  it("D-076: WeTransfer vencido, o que devuelve una descarga en otro servidor, no se baja", async () => {
    const page = "https://wetransfer.com/downloads/abcdef0123456789abcdef0123456789/a1b2c3";
    const api = "https://wetransfer.com/api/v4/transfers/abcdef0123456789abcdef0123456789/download";
    const expired = fake({ "https://we.tl/t-x": () => respond(302, { location: page }), [api]: () => respond(404, {}) });
    expect(await resolveLink("https://we.tl/t-x", expired.impl)).toEqual({ provider: "wetransfer", failure: "not_found" });
    const evil = fake({ "https://we.tl/t-x": () => respond(302, { location: page }), [api]: () => respond(200, {}, JSON.stringify({ direct_link: "https://169.254.169.254/x" })) });
    expect(await resolveLink("https://we.tl/t-x", evil.impl)).toEqual({ provider: "wetransfer", failure: "not_found" });
    const away = fake({ "https://we.tl/t-x": () => respond(302, { location: "https://atacante.com/downloads/a/b" }) });
    expect(await resolveLink("https://we.tl/t-x", away.impl)).toEqual({ provider: "wetransfer", failure: "error" });
  });
});

describe("links: el archivo queda en el pedido (D-072, D-076)", () => {
  it("D-072: el archivo del link queda guardado en el pedido y pasa por el control automático", async () => {
    const j = await job([DRIVE]);
    expect(await processLinkDownloads(prisma, storage, clientWith(async () => opened(png(6850, 11811))), NO_MIN)).toEqual({ jobs: 1, files: 1, failed: 0 });
    const file = await prisma.jobFile.findFirstOrThrow({ where: { jobId: j.id } });
    expect(file).toMatchObject({ filename: "remeras.png", mime: "image/png", sizeBytes: 64n });
    expect(file.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect((await storage.get(file.storageKey)).equals(png(6850, 11811))).toBe(true);
    await processFileChecks(prisma, storage);
    expect((await prisma.jobOrder.findUniqueOrThrow({ where: { id: j.id } })).fileCheck).toMatchObject({ verdict: "ok", file: "remeras.png" });
  });

  it("D-076: no hay tope de tamaño: un archivo de más de 150 MB se guarda entero, escrito de a pedazos", async () => {
    const j = await job([DRIVE]);
    const chunk = Buffer.alloc(8 * 1024 * 1024, 7);
    const total = 20; // 160 MB
    let sentChunks = 0;
    const big = new ReadableStream<Uint8Array>({ pull: (c) => (sentChunks++ < total ? c.enqueue(chunk) : c.close()) });
    const open = async (): Promise<OpenResult> => ({ ok: true, file: { filename: "lona.tif", mime: "image/tiff", declaredBytes: null, body: big } });
    expect(await processLinkDownloads(prisma, storage, clientWith(open), NO_MIN)).toEqual({ jobs: 1, files: 1, failed: 0 });
    expect((await prisma.jobFile.findFirstOrThrow({ where: { jobId: j.id } })).sizeBytes).toBe(BigInt(total * chunk.length));
  }, 60_000);

  it("D-073: baja todos los links del pedido, sin tope de cantidad", async () => {
    const links = Array.from({ length: 8 }, (_, i) => `https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz01234${i}/view`);
    const j = await job(links);
    let n = 0;
    expect(await processLinkDownloads(prisma, storage, clientWith(async () => opened(png(10, 10), `hoja-${++n}.png`)), NO_MIN)).toEqual({ jobs: 1, files: 8, failed: 0 });
    expect(await prisma.jobFile.count({ where: { jobId: j.id } })).toBe(8);
  });

  it("D-076: una carpeta de Drive deja todos sus archivos en el pedido", async () => {
    const j = await job([FOLDER]);
    const targets: LinkTarget[] = [1, 2, 3].map((i) => ({ provider: "drive", url: `https://drive.usercontent.google.com/download?id=archivo${i}` }));
    let n = 0;
    const client = clientWith(async () => opened(png(10, 10), `hoja-${++n}.png`), async () => ({ provider: "drive", targets }));
    expect(await processLinkDownloads(prisma, storage, client, NO_MIN)).toEqual({ jobs: 1, files: 3, failed: 0 });
    expect(await prisma.jobFile.count({ where: { jobId: j.id } })).toBe(3);
  });

  it("D-076: si el disco se queda sin lugar, no baja el archivo y la tarjeta lo avisa", async () => {
    const j = await job([DRIVE]);
    // Se pide dejar libre más de lo que hay: no hay lugar para nada.
    const r = await processLinkDownloads(prisma, storage, clientWith(async () => opened(png(10, 10))), { minFreeBytes: Number.MAX_SAFE_INTEGER });
    expect(r).toEqual({ jobs: 1, files: 0, failed: 1 });
    expect((await prisma.jobOrder.findUniqueOrThrow({ where: { id: j.id } })).linksNote).toContain("sin lugar en el disco");
    expect(await prisma.jobFile.count()).toBe(0);
  });

  it("D-076: si el archivo resulta más grande que el lugar disponible, corta y no deja nada a medias", async () => {
    const free = await storage.freeBytes();
    const j = await job([DRIVE]);
    // Queda lugar para 1.000 bytes y el archivo (sin tamaño declarado) trae 5.000.
    const r = await processLinkDownloads(prisma, storage, clientWith(async () => opened(Buffer.alloc(5000), "grande.png", false)), { minFreeBytes: free - 1000 });
    expect(r).toEqual({ jobs: 1, files: 0, failed: 1 });
    expect((await prisma.jobOrder.findUniqueOrThrow({ where: { id: j.id } })).linksNote).toContain("sin lugar en el disco");
  });

  it("D-072: cada pedido se intenta una sola vez", async () => {
    await job([DRIVE]);
    let calls = 0;
    const counting = clientWith(async () => (calls++, { ok: false, reason: "error" }));
    await processLinkDownloads(prisma, storage, counting, NO_MIN);
    expect(await processLinkDownloads(prisma, storage, counting, NO_MIN)).toEqual({ jobs: 0, files: 0, failed: 0 });
    expect(calls).toBe(1);
  });

  it("D-072: si el link no es público, la tarjeta le dice al operador qué pedirle al cliente", async () => {
    const j = await job([DRIVE]);
    expect(await processLinkDownloads(prisma, storage, clientWith(async () => ({ ok: false, reason: "private" })), NO_MIN)).toEqual({ jobs: 1, files: 0, failed: 1 });
    await processFileChecks(prisma, storage);
    const after = await prisma.jobOrder.findUniqueOrThrow({ where: { id: j.id } });
    expect(after.linksNote).toContain("Google Drive: el link no es público");
    expect(after.fileCheck).toMatchObject({ verdict: "unknown", hint: after.linksNote });
  });

  it("D-076: un servicio que no se baja solo se avisa; los links del pie de Google no", async () => {
    const j = await job(["https://mega.nz/file/AbCdEfGh#clave", "https://drive.google.com/abuse?id=AbCd"]);
    let called = false;
    await processLinkDownloads(prisma, storage, clientWith(async () => ((called = true), { ok: false, reason: "error" })), NO_MIN);
    expect(called).toBe(false);
    expect((await prisma.jobOrder.findUniqueOrThrow({ where: { id: j.id } })).linksNote).toBe("Hay un link de un servicio que no se baja solo: abrilo desde el mail.");
    const onlyNoise = await job(["https://drive.google.com/drive/blockuser?blockerEmail=a@b.c"]);
    await processLinkDownloads(prisma, storage, clientWith(async () => ({ ok: false, reason: "error" })), NO_MIN);
    expect((await prisma.jobOrder.findUniqueOrThrow({ where: { id: onlyNoise.id } })).linksNote).toBeNull();
  });

  it("D-072: no toca pedidos entregados, cancelados, borrados ni sin links", async () => {
    await job([DRIVE], { status: "DELIVERED" });
    await job([DRIVE], { status: "CANCELLED" });
    await job([DRIVE], { deletedAt: new Date() });
    await job([]);
    expect(await processLinkDownloads(prisma, storage, clientWith(async () => opened(png(10, 10))), NO_MIN)).toEqual({ jobs: 0, files: 0, failed: 0 });
  });

  it("D-076: un link que llegó con '&amp;' del HTML del mail se baja igual", async () => {
    const j = await job(["https://docs.google.com/uc?export=download&amp;id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345&amp;revid=0B1x"]);
    const seen: string[] = [];
    const client = clientWith(async (t) => (seen.push(t.url), opened(png(10, 10))));
    expect(await processLinkDownloads(prisma, storage, client, NO_MIN)).toEqual({ jobs: 1, files: 1, failed: 0 });
    expect(seen).toEqual([DRIVE_DIRECT]);
    expect((await prisma.jobOrder.findUniqueOrThrow({ where: { id: j.id } })).linksNote).toBeNull();
  });
});
