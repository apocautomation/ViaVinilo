import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient, type Sector } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ingestMail, type IngestNotifier } from "../src/mail/ingest";
import { pollImapSector, type ImapMailbox } from "../src/mail/sources/imap";
import { pollMailHog } from "../src/mail/sources/mailhog";
import { LocalDiskStorage } from "../src/storage";
import { buildMail, fakePdf } from "./mail-fixtures";
import { startTestDb } from "./test-db";

let prisma: PrismaClient;
let stopDb: () => Promise<void>;
let storageDir: string;
let dtf: Sector;
let granFormato: Sector;
const invites: { to: string; sector: string }[] = [];

const notifier: IngestNotifier = {
  async sendSignupInvite({ to, sector }) {
    invites.push({ to, sector: sector.code });
  },
};
const deps = () => ({ prisma, storage: new LocalDiskStorage(storageDir), notifier });

let seq = 0;
const nextId = () => `<mail-${++seq}@cliente.test>`;

beforeAll(async () => {
  const db = await startTestDb();
  stopDb = db.stop;
  prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
  storageDir = mkdtempSync(join(tmpdir(), "viavinilo-storage-"));

  dtf = await prisma.sector.create({ data: { code: "DTF", name: "DTF", inboxEmail: "dtf@viavinilo.test" } });
  granFormato = await prisma.sector.create({
    data: { code: "GRAN_FORMATO", name: "Gran Formato", inboxEmail: "granformato@viavinilo.test" },
  });
  await prisma.customer.create({
    data: {
      status: "ACTIVE",
      firstName: "Juan",
      lastName: "Pérez",
      dni: "30123456",
      emails: { create: [{ email: "juan@remeras.test", isPrimary: true }, { email: "compras@remeras.test" }] },
    },
  });
  await prisma.customer.create({
    data: { status: "BLOCKED", firstName: "Malo", emails: { create: { email: "bloqueado@cliente.test" } } },
  });
});

afterAll(async () => {
  await prisma?.$disconnect();
  await stopDb?.();
  rmSync(storageDir, { recursive: true, force: true });
});

beforeEach(() => {
  invites.length = 0;
});

describe("ingesta de un mail (SPEC E1.1)", () => {
  it("un mail de un cliente activo crea la orden en 'Archivo recibido' con cliente, sector y archivos", async () => {
    const raw = await buildMail({
      from: "Juan Pérez <Juan@Remeras.test>",
      to: "dtf@viavinilo.test",
      subject: "Pedido remeras 30x40cm",
      text: "Hola, van 3 diseños de 30 x 40 cm. Gracias!",
      messageId: nextId(),
      attachments: [fakePdf("frente.pdf"), fakePdf("espalda.pdf"), fakePdf("manga.pdf")],
    });

    const out = await ingestMail(deps(), dtf, raw);
    expect(out.result).toBe("CREATED");

    const job = await prisma.jobOrder.findUniqueOrThrow({
      where: { id: out.jobId },
      include: { customer: true, files: true, events: true },
    });
    expect(job).toMatchObject({ status: "RECEIVED", source: "EMAIL", sectorId: dtf.id });
    expect(job.customer.firstName).toBe("Juan");
    // Un mail con varios adjuntos crea UNA orden con varios archivos.
    expect(job.files.map((f) => f.filename).sort()).toEqual(["espalda.pdf", "frente.pdf", "manga.pdf"]);
    for (const f of job.files) {
      expect(readFileSync(join(storageDir, f.storageKey)).length).toBe(1024);
      expect(f.checksum).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(job.requestedSpecs).toMatchObject({ measures: [{ raw: "30x40cm", widthCm: 30, heightCm: 40 }] });
    expect(job.events).toHaveLength(1);
    expect(job.events[0]).toMatchObject({ fromStatus: null, toStatus: "RECEIVED", userId: null });

    const state = await prisma.mailboxState.findUniqueOrThrow({ where: { sectorId: dtf.id } });
    expect(state.lastMessageAt).not.toBeNull();
  });

  it("identifica al cliente por cualquiera de sus emails", async () => {
    const raw = await buildMail({
      from: "compras@remeras.test",
      to: "dtf@viavinilo.test",
      subject: "Otro pedido",
      messageId: nextId(),
      attachments: [fakePdf("logo.pdf")],
    });
    const out = await ingestMail(deps(), dtf, raw);
    const job = await prisma.jobOrder.findUniqueOrThrow({ where: { id: out.jobId }, include: { customer: true } });
    expect(job.customer.dni).toBe("30123456");
  });

  it("el mismo mail procesado dos veces (reenvío o relectura) no duplica la orden", async () => {
    const raw = await buildMail({
      from: "juan@remeras.test",
      to: "dtf@viavinilo.test",
      subject: "Repetido",
      messageId: nextId(),
      attachments: [fakePdf("a.pdf")],
    });
    const first = await ingestMail(deps(), dtf, raw);
    const second = await ingestMail(deps(), dtf, raw);
    expect(first.result).toBe("CREATED");
    expect(second).toMatchObject({ result: "DUPLICATE", jobId: first.jobId });
    expect(await prisma.jobOrder.count({ where: { sourceMessageId: first.messageId } })).toBe(1);
  });

  it("el mismo mail con copia a dos casillas crea una orden en cada sector", async () => {
    const raw = await buildMail({
      from: "juan@remeras.test",
      to: ["dtf@viavinilo.test", "granformato@viavinilo.test"],
      subject: "Para dos sectores",
      messageId: nextId(),
      attachments: [fakePdf("b.pdf")],
    });
    const a = await ingestMail(deps(), dtf, raw);
    const b = await ingestMail(deps(), granFormato, raw);
    expect(a.result).toBe("CREATED");
    expect(b.result).toBe("CREATED");
    expect(a.jobId).not.toBe(b.jobId);
  });

  it("un mail sin Message-ID se deduplica igual (por el contenido)", async () => {
    const raw = await buildMail({
      from: "juan@remeras.test",
      to: "dtf@viavinilo.test",
      subject: "Sin Message-ID",
      attachments: [fakePdf("c.pdf")],
    });
    const withoutId = Buffer.from(raw.toString("utf8").replace(/^Message-ID:.*\r\n/im, ""), "utf8");
    expect(withoutId.toString()).not.toMatch(/^Message-ID:/im);
    const first = await ingestMail(deps(), dtf, withoutId);
    const second = await ingestMail(deps(), dtf, withoutId);
    expect(first.messageId).toMatch(/^<sha256-/);
    expect(second.result).toBe("DUPLICATE");
  });

  it("guarda los links de WeTransfer o Drive aunque no haya adjuntos", async () => {
    const raw = await buildMail({
      from: "juan@remeras.test",
      to: "granformato@viavinilo.test",
      subject: "Lona 3 metros",
      text: "El archivo pesa mucho: https://we.tl/t-XyZ987 . Son 3 metros de lona.",
      messageId: nextId(),
    });
    const out = await ingestMail(deps(), granFormato, raw);
    expect(out.result).toBe("CREATED");
    const job = await prisma.jobOrder.findUniqueOrThrow({ where: { id: out.jobId }, include: { files: true } });
    expect(job.externalLinks).toEqual(["https://we.tl/t-XyZ987"]);
    expect(job.files).toHaveLength(0);
  });

  it("no toma como trabajo el logo incrustado en la firma del mail", async () => {
    const raw = await buildMail({
      from: "juan@remeras.test",
      to: "dtf@viavinilo.test",
      subject: "Con firma",
      html: '<p>Va el diseño</p><img src="cid:firma@logo">',
      messageId: nextId(),
      attachments: [
        fakePdf("diseno.pdf"),
        { filename: "logo-firma.png", content: Buffer.alloc(2000, 1), contentType: "image/png", cid: "firma@logo" },
      ],
    });
    const out = await ingestMail(deps(), dtf, raw);
    const files = await prisma.jobFile.findMany({ where: { jobId: out.jobId } });
    expect(files.map((f) => f.filename)).toEqual(["diseno.pdf"]);
  });
});

describe("remitentes sin alta (D-014)", () => {
  it("crea el cliente pendiente, la orden en 'Alta pendiente' y manda el link de alta una sola vez", async () => {
    const mail = (subject: string) =>
      buildMail({
        from: "Ana Gómez <ana@nuevo.test>",
        to: "dtf@viavinilo.test",
        subject,
        messageId: nextId(),
        attachments: [fakePdf(`${subject}.pdf`)],
      });

    const first = await ingestMail(deps(), dtf, await mail("primero"));
    const second = await ingestMail(deps(), dtf, await mail("segundo"));

    expect(first.result).toBe("PENDING_SIGNUP");
    expect(second.result).toBe("PENDING_SIGNUP");
    const customer = await prisma.customer.findFirstOrThrow({
      where: { emails: { some: { email: "ana@nuevo.test" } } },
      include: { jobs: true },
    });
    expect(customer.status).toBe("PENDING");
    expect(customer.internalNotes).toBe("Nombre en el mail: Ana Gómez");
    expect(customer.jobs.map((j) => j.status)).toEqual(["PENDING_SIGNUP", "PENDING_SIGNUP"]);
    // Dos mails seguidos: una sola invitación.
    expect(invites).toEqual([{ to: "ana@nuevo.test", sector: "DTF" }]);
  });
});

describe("mails que no son pedidos", () => {
  it("I-15: un mail sin adjuntos ni links no crea orden y queda en el log", async () => {
    const raw = await buildMail({
      from: "juan@remeras.test",
      to: "dtf@viavinilo.test",
      subject: "hola",
      text: "Hola, ¿a qué hora cierran?",
      messageId: nextId(),
    });
    const out = await ingestMail(deps(), dtf, raw);
    expect(out.result).toBe("SKIPPED_NO_FILES");
    expect(await prisma.jobOrder.count({ where: { sourceMessageId: out.messageId } })).toBe(0);
    const log = await prisma.mailIngestLog.findFirstOrThrow({ where: { messageId: out.messageId } });
    expect(log).toMatchObject({ result: "SKIPPED_NO_FILES", fromEmail: "juan@remeras.test", subject: "hola" });
  });

  it("ignora respuestas automáticas y rebotes", async () => {
    const raw = await buildMail({
      from: "juan@remeras.test",
      to: "dtf@viavinilo.test",
      subject: "Fuera de la oficina",
      messageId: nextId(),
      headers: { "Auto-Submitted": "auto-replied" },
      attachments: [fakePdf("x.pdf")],
    });
    expect((await ingestMail(deps(), dtf, raw)).result).toBe("SKIPPED_AUTO_REPLY");
  });

  it("I-14: un cliente bloqueado no genera orden", async () => {
    const raw = await buildMail({
      from: "bloqueado@cliente.test",
      to: "dtf@viavinilo.test",
      subject: "Pedido",
      messageId: nextId(),
      attachments: [fakePdf("y.pdf")],
    });
    expect((await ingestMail(deps(), dtf, raw)).result).toBe("REJECTED_BLOCKED");
  });

  it("un mail ilegible queda como ERROR en el log y no frena la lectura", async () => {
    const out = await ingestMail(deps(), dtf, Buffer.from([0xff, 0xfe, 0x00]));
    expect(["ERROR", "SKIPPED_NO_FILES"]).toContain(out.result);
  });
});

describe("lectura de casillas", () => {
  it("IMAP: la primera vez arranca desde ahora, después lee solo los nuevos y avanza el UID", async () => {
    const inbox: { uid: number; source: Buffer }[] = [];
    const add = async (uid: number) =>
      inbox.push({
        uid,
        source: await buildMail({
          from: "juan@remeras.test",
          to: "granformato@viavinilo.test",
          subject: `IMAP ${uid}`,
          messageId: `<imap-${uid}@cliente.test>`,
          attachments: [fakePdf(`imap-${uid}.pdf`)],
        }),
      });
    const open = async (): Promise<ImapMailbox> => ({
      uidValidity: 7n,
      uidNext: (inbox.at(-1)?.uid ?? 0) + 1,
      async *fetchAfter(after: number) {
        for (const m of inbox) if (m.uid > after) yield m;
      },
      close: async () => {},
    });
    const ingest = (raw: Buffer) => ingestMail(deps(), granFormato, raw);

    // Historial viejo de la casilla: no se importa.
    await add(1);
    await add(2);
    expect((await pollImapSector(prisma, granFormato, open, ingest)).processed).toBe(0);

    await add(3);
    await add(4);
    expect((await pollImapSector(prisma, granFormato, open, ingest)).processed).toBe(2);
    expect((await pollImapSector(prisma, granFormato, open, ingest)).processed).toBe(0);

    const state = await prisma.mailboxState.findUniqueOrThrow({ where: { sectorId: granFormato.id } });
    expect(state).toMatchObject({ lastUid: 4, uidValidity: 7n });
    const subjects = await prisma.jobOrder.findMany({
      where: { sourceMessageId: { startsWith: "<imap-" } },
      select: { description: true },
      orderBy: { number: "asc" },
    });
    expect(subjects.map((s) => s.description)).toEqual(["IMAP 3", "IMAP 4"]);
  });

  it("MailHog: ingiere en el sector de cada destinatario y borra el mail leído", async () => {
    const raw = await buildMail({
      from: "juan@remeras.test",
      to: "DTF@viavinilo.test",
      subject: "Desde MailHog",
      messageId: nextId(),
      attachments: [fakePdf("mh.pdf")],
    });
    const deleted: string[] = [];
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        deleted.push(url);
        return new Response(null, { status: 200 });
      }
      return Response.json({
        items: [
          { ID: "m2", Raw: { From: "x@y.test", To: ["otra@casilla.test"], Data: raw.toString("utf8") } },
          { ID: "m1", Raw: { From: "juan@remeras.test", To: ["DTF@viavinilo.test"], Data: raw.toString("utf8") } },
        ],
      });
    }) as typeof fetch;

    const r = await pollMailHog("http://mailhog", [dtf, granFormato], (s, data) => ingestMail(deps(), s, data), fakeFetch);
    expect(r).toEqual({ processed: 1, ignored: 1 });
    expect(deleted).toEqual(["http://mailhog/api/v1/messages/m1", "http://mailhog/api/v1/messages/m2"]);
    const job = await prisma.jobOrder.findFirstOrThrow({ where: { description: "Desde MailHog" } });
    expect(job.sectorId).toBe(dtf.id);
  });
});

describe("criterio de aceptación de la E1 (SPEC §5)", () => {
  it("400 mails con varios adjuntos y 100 reenvíos: 400 órdenes, ninguna duplicada ni perdida", async () => {
    const before = await prisma.jobOrder.count();
    const raws: Buffer[] = [];
    for (let i = 0; i < 400; i++) {
      raws.push(
        await buildMail({
          from: "juan@remeras.test",
          to: "dtf@viavinilo.test",
          subject: `Carga ${i}`,
          messageId: `<carga-${i}@cliente.test>`,
          attachments: [fakePdf(`c${i}-1.pdf`, 256), fakePdf(`c${i}-2.pdf`, 256)],
        }),
      );
    }
    const resends = raws.filter((_, i) => i % 4 === 0);
    const results = [];
    for (const raw of [...raws, ...resends]) results.push((await ingestMail(deps(), dtf, raw)).result);

    expect(results.filter((r) => r === "CREATED")).toHaveLength(400);
    expect(results.filter((r) => r === "DUPLICATE")).toHaveLength(100);
    expect((await prisma.jobOrder.count()) - before).toBe(400);
    expect(await prisma.jobFile.count({ where: { job: { sourceMessageId: { startsWith: "<carga-" } } } })).toBe(800);
  }, 300_000);
});
