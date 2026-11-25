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
  it("D-054: crea el cliente pendiente, la orden entra igual al tablero y manda el mail de alta una sola vez", async () => {
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
    expect([customer.firstName, customer.lastName]).toEqual(["Ana", "Gómez"]);
    expect(customer.jobs.map((j) => j.status)).toEqual(["RECEIVED", "RECEIVED"]);
    // Dos mails seguidos: una sola invitación.
    expect(invites).toEqual([{ to: "ana@nuevo.test", sector: "DTF" }]);
  });
});

describe("altas desde el mail (D-054)", () => {
  it("D-054: completa el alta pendiente con la ficha que escribe el cliente en el mail", async () => {
    const raw = await buildMail({
      from: "juanpereyra@nuevo.test",
      to: "dtf@viavinilo.test",
      subject: "DARK2",
      messageId: nextId(),
      text: [
        "Nombre o Número de Cliente: JUAN PEREYRA",
        "Nombre del Archivo: DARK2",
        "Material: DTF TEXTIL",
        "Tamaño:   0,58 CM x 0,35 CM",
        "Teléfono: 387 466-9944",
        "lugar a retirar: cALLE SAN JUAN",
      ].join("\n"),
      attachments: [fakePdf("DARK2.pdf")],
    });
    const r = await ingestMail(deps(), dtf, raw);
    expect(r.result).toBe("PENDING_SIGNUP");
    const c = await prisma.customer.findFirstOrThrow({
      where: { emails: { some: { email: "juanpereyra@nuevo.test" } } },
      include: { phones: true, jobs: true },
    });
    expect(c.status).toBe("PENDING");
    expect([c.firstName, c.lastName, c.searchText]).toEqual(["Juan", "Pereyra", "juan pereyra"]);
    expect(c.phones.map((p) => p.phone)).toEqual(["+5493874669944"]);
    expect(c.internalNotes).toBe("Retira en: Calle San Juan");
    expect(c.jobs[0]!.status).toBe("RECEIVED");
  });

  it("D-054: si dice un número de cliente lo anota para verificar, y el próximo mail con nombre lo completa", async () => {
    const mail = (text: string) =>
      buildMail({ from: "sinnombre@nuevo.test", to: "dtf@viavinilo.test", subject: "x", messageId: nextId(), text, attachments: [fakePdf("a.pdf")] });
    await ingestMail(deps(), dtf, await mail("Nombre o Número de Cliente: 1234"));
    let c = await prisma.customer.findFirstOrThrow({ where: { emails: { some: { email: "sinnombre@nuevo.test" } } } });
    expect(c.firstName).toBeNull();
    expect(c.internalNotes).toBe("Dice ser el cliente N.º 1234");

    await ingestMail(deps(), dtf, await mail("Nombre: Lucía de la Fuente"));
    c = await prisma.customer.findUniqueOrThrow({ where: { id: c.id } });
    expect([c.firstName, c.lastName]).toEqual(["Lucía", "de la Fuente"]);
  });
});

describe("reenvíos desde una casilla nuestra (D-057)", () => {
  it("D-057: un reenvío del equipo es del cliente del mail original, no de la casilla de Via Vinilo", async () => {
    const raw = await buildMail({
      from: "dtf@viavinilo.test",
      to: "dtf@viavinilo.test",
      subject: "RV: Pérez Lucía",
      messageId: nextId(),
      text: [
        "________________________________",
        "De: Lucía Pérez <lucia.perez@cliente.test>",
        "Enviado: viernes, 20 de noviembre de 2026 11:28",
        "Para: dtf@viavinilo.test <dtf@viavinilo.test>",
        "Asunto: Pérez Lucía",
        "",
        "Impresión en DTF textil el archivo de EMA",
      ].join("\n"),
      attachments: [fakePdf("EMA.pdf")],
    });
    const r = await ingestMail(deps(), dtf, raw);
    expect(r.result).toBe("PENDING_SIGNUP");
    expect(await prisma.customerEmail.count({ where: { email: "dtf@viavinilo.test" } })).toBe(0);
    const c = await prisma.customer.findFirstOrThrow({
      where: { emails: { some: { email: "lucia.perez@cliente.test" } } },
      include: { jobs: true, conversation: { include: { messages: true } } },
    });
    expect([c.firstName, c.lastName]).toEqual(["Lucía", "Pérez"]);
    expect(c.jobs).toHaveLength(1);
    // En el hilo queda que lo mandó la casilla del equipo.
    expect(c.conversation?.messages[0]?.fromEmail).toBe("dtf@viavinilo.test");
  });

  it("D-057: un mail del equipo sin remitente original no crea cliente ni pedido, pero queda en Conversaciones", async () => {
    const raw = await buildMail({
      from: "dtf@viavinilo.test",
      to: "dtf@viavinilo.test",
      subject: "prueba",
      messageId: nextId(),
      text: "archivo de prueba",
      attachments: [fakePdf("x.pdf")],
    });
    const r = await ingestMail(deps(), dtf, raw);
    expect(r.result).toBe("ERROR");
    expect(await prisma.customerEmail.count({ where: { email: "dtf@viavinilo.test" } })).toBe(0);
    expect(await prisma.conversation.count({ where: { contactEmail: "dtf@viavinilo.test" } })).toBe(1);
  });
});

describe("comando /reset por mail (D-061)", () => {
  it("D-061: '/reset' por mail borra la memoria del bot, responde en el mismo hilo y no crea pedido", async () => {
    const before = await prisma.jobOrder.count();
    const raw = await buildMail({ from: "juan@remeras.test", to: "dtf@viavinilo.test", subject: "prueba", messageId: nextId(), text: "/reset\n\nSaludos" });
    const r = await ingestMail(deps(), dtf, raw, { uid: 77 });
    expect(r.result).toBe("COMMAND");
    expect(await prisma.jobOrder.count()).toBe(before);
    const out = await prisma.outboundEmail.findFirstOrThrow({ where: { kind: "bot-reset" } });
    expect(out).toMatchObject({ to: "juan@remeras.test", text: "Memoria borrada correctamente.", fromAddress: "dtf@viavinilo.test", inReplyToUid: 77, subject: "Re: prueba" });
    const conv = await prisma.conversation.findFirstOrThrow({ where: { customer: { emails: { some: { email: "juan@remeras.test" } } } } });
    expect(conv.botResetAt).not.toBeNull();
  });
});

describe("mails que no son pedidos", () => {
  it("D-111: pedir cancelar sin archivo no crea pedido y va a Conversaciones para una persona", async () => {
    const raw = await buildMail({
      from: "cancela@cliente.test",
      to: "dtf@viavinilo.test",
      subject: "CANCELAR PEDIDO DE LAS 15:43 POR ERROR",
      text: "Hay un error en el pedido que hice a las 15:43, cancelar ese pedido. Vuelvo a enviar el archivo corregido.",
      messageId: nextId(),
    });
    const out = await ingestMail(deps(), dtf, raw);
    expect(out.result).toBe("CANCEL_REQUEST");
    expect(await prisma.jobOrder.count({ where: { sourceMessageId: out.messageId } })).toBe(0);
    expect(await prisma.mailIngestLog.findFirstOrThrow({ where: { messageId: out.messageId } })).toMatchObject({ result: "CANCEL_REQUEST" });
    const conv = await prisma.conversation.findFirstOrThrow({ where: { contactEmail: "cancela@cliente.test" }, include: { messages: true } });
    expect(conv).toMatchObject({ needsHuman: true, needsHumanReason: "Pide por mail cancelar un pedido" });
    expect(conv.messages[0]).toMatchObject({ subject: "CANCELAR PEDIDO DE LAS 15:43 POR ERROR" });
  });

  it("D-111: pedir cancelar con un archivo crea el pedido igual ('cancelen el anterior, va este'), avisado en la tarjeta y en Conversaciones", async () => {
    const raw = await buildMail({
      from: "cancela2@cliente.test",
      to: "dtf@viavinilo.test",
      subject: "dtf 0,58x1mt",
      text: "Va el archivo\nCANCELAR EL ANTERIOR",
      messageId: nextId(),
      attachments: [fakePdf("nuevo.pdf")],
    });
    const out = await ingestMail(deps(), dtf, raw);
    expect(["CREATED", "PENDING_SIGNUP"]).toContain(out.result);
    const job = await prisma.jobOrder.findFirstOrThrow({ where: { sourceMessageId: out.messageId } });
    expect(job.description).toBe("Pide cancelar un pedido · dtf 0,58x1mt");
    const conv = await prisma.conversation.findFirstOrThrow({ where: { customerId: job.customerId } });
    expect(conv).toMatchObject({ needsHuman: true, needsHumanReason: "Pide por mail cancelar un pedido" });
  });

  it("D-111: contestar con el archivo corregido un mail titulado 'PEDIDO CANCELADO' crea el pedido, con lo que escribió el cliente", async () => {
    const raw = await buildMail({
      from: "reenvia@cliente.test",
      to: "dtf@viavinilo.test",
      subject: "Re: PEDIDO CANCELADO",
      text: "Te lo vuelvo a enviar.\n\nEl jue, 19 nov 2026 a las 20:42, DTF (<dtf@viavinilo.test>)\nescribió:\n\n> Tu archivo excede el ancho. ¿Podés enviarlo corregido?",
      messageId: nextId(),
      attachments: [fakePdf("corregido.pdf")],
    });
    const out = await ingestMail(deps(), dtf, raw);
    expect(["CREATED", "PENDING_SIGNUP"]).toContain(out.result);
    const job = await prisma.jobOrder.findFirstOrThrow({ where: { sourceMessageId: out.messageId } });
    expect(job.description).toBe("Te lo vuelvo a enviar. (en respuesta a «PEDIDO CANCELADO»)");
  });

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

  it("D-112: un aviso de 'Sin entregar' sin remitente es un rebote, no un error", async () => {
    const raw = await buildMail({
      to: "dtf@viavinilo.test",
      subject: "Sin entregar: RE: dtf textil",
      text: "No se pudo entregar el mensaje a los destinatarios.",
      messageId: nextId(),
      attachments: [fakePdf("original.pdf")],
    });
    const out = await ingestMail(deps(), dtf, raw);
    expect(out.result).toBe("SKIPPED_AUTO_REPLY");
    expect(await prisma.mailIngestLog.findFirstOrThrow({ where: { messageId: out.messageId } })).toMatchObject({ result: "SKIPPED_AUTO_REPLY", error: null });
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
  it("D-043: API de Hostinger: arranca desde ahora, lee solo los nuevos (con paginado) y nunca marca leído", async () => {
    const inbox: { uid: number; source: Buffer }[] = [];
    const add = async (uid: number) =>
      inbox.push({
        uid,
        source: await buildMail({
          from: "juan@remeras.test",
          to: "dtf@viavinilo.test",
          subject: `API ${uid}`,
          messageId: `<api-${uid}@cliente.test>`,
          attachments: [fakePdf(`api-${uid}.pdf`)],
        }),
      });
    const calls: string[] = [];
    // Simula la API real (probada el 20/11): "n:*" devuelve al menos el último mail aunque sea viejo.
    const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      calls.push(`${method} ${url.pathname}`);
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer token-de-prueba");
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
      if (url.pathname.endsWith("/me")) {
        return json({ data: { mailboxes: [{ resourceId: "ACdtf", address: "DTF@viavinilo.test" }] } });
      }
      const source = /\/messages\/(\d+)\/source$/.exec(url.pathname);
      if (source) return new Response(inbox.find((m) => m.uid === Number(source[1]))!.source);
      if (url.pathname.endsWith("/messages/search")) {
        const from = Number(String(JSON.parse(String(init?.body)).uid).split(":")[0]);
        const all = inbox.filter((m) => m.uid >= from);
        const matched = all.length ? all : inbox.slice(-1);
        const per = Number(url.searchParams.get("perPage"));
        const page = Number(url.searchParams.get("page"));
        return json({
          data: matched.slice((page - 1) * per, page * per).map((m) => ({ uid: m.uid })),
          pagination: { page, totalPages: Math.ceil(matched.length / per) },
        });
      }
      if (url.pathname.endsWith("/messages")) {
        return json({ data: inbox.slice(-1).map((m) => ({ uid: m.uid })), pagination: { page: 1, totalPages: 1 } });
      }
      throw new Error(`ruta inesperada ${method} ${url.pathname}`);
    }) as typeof fetch;

    const { hostingerMailboxIds, openHostingerMailbox } = await import("../src/mail/sources/hostinger-api");
    const config = { token: "token-de-prueba", baseUrl: "https://api.test/api/v1" };
    const ids = await hostingerMailboxIds(config, fakeFetch);
    expect(ids.get("dtf@viavinilo.test")).toBe("ACdtf");

    const open = () => openHostingerMailbox(config, "ACdtf", fakeFetch);
    const ingest = (raw: Buffer) => ingestMail(deps(), dtf, raw);

    // Historial de la casilla: no se importa.
    for (const uid of [10, 11, 12]) await add(uid);
    expect((await pollImapSector(prisma, dtf, open, ingest)).processed).toBe(0);
    // Sin mails nuevos la búsqueda igual devuelve el último: no se procesa de nuevo.
    expect((await pollImapSector(prisma, dtf, open, ingest)).processed).toBe(0);

    // 120 mails nuevos: más de una página de la API (100 por página).
    for (let uid = 13; uid < 133; uid++) await add(uid);
    expect((await pollImapSector(prisma, dtf, open, ingest)).processed).toBe(120);
    expect((await pollImapSector(prisma, dtf, open, ingest)).processed).toBe(0);

    const state = await prisma.mailboxState.findUniqueOrThrow({ where: { sectorId: dtf.id } });
    expect(state.lastUid).toBe(132);
    expect(await prisma.jobOrder.count({ where: { sourceMessageId: { startsWith: "<api-" } } })).toBe(120);
    // Solo lee: nunca cambia marcas (leído, respondido) ni mueve mails.
    expect(calls.some((c) => c.startsWith("PATCH") || c.includes("/flags") || c.includes("/move"))).toBe(false);
  });

  it("D-043: con MAIL_SOURCE=hostinger-api el token es obligatorio", async () => {
    const { loadConfig } = await import("../src/config");
    expect(() => loadConfig({ MAIL_SOURCE: "hostinger-api" })).toThrow(/HOSTINGER_MAIL_API_TOKEN/);
    expect(loadConfig({ MAIL_SOURCE: "hostinger-api", HOSTINGER_MAIL_API_TOKEN: "x" }).hostinger).toMatchObject({
      token: "x",
      baseUrl: "https://api.mail.hostinger.com/api/v1",
    });
  });

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

describe("todo mail queda en Conversaciones (D-045)", () => {
  const thread = (where: { customerId?: string; contactEmail?: string }) =>
    prisma.conversation.findFirstOrThrow({ where, include: { messages: { orderBy: { createdAt: "asc" } } } });

  it("D-045: un pedido con archivo crea la orden y queda en el hilo del cliente con la orden y el UID", async () => {
    const raw = await buildMail({
      from: "juan@remeras.test",
      to: "dtf@viavinilo.test",
      subject: "Conv 1",
      messageId: "<conv-1@cliente.test>",
      text: "Va el archivo",
      attachments: [fakePdf("conv-1.pdf")],
    });
    const out = await ingestMail(deps(), dtf, raw, { uid: 501 });
    const juan = await prisma.customerEmail.findUniqueOrThrow({ where: { email: "juan@remeras.test" } });
    const conv = await thread({ customerId: juan.customerId });
    const msg = conv.messages.find((m) => m.externalKey === "DTF:<conv-1@cliente.test>")!;
    expect(msg).toMatchObject({ direction: "IN", channel: "MAIL", jobId: out.jobId, mailUid: 501, subject: "Conv 1" });
    expect(msg.attachments).toEqual(["conv-1.pdf"]);
    expect(conv.staffUnread).toBeGreaterThanOrEqual(1);
  });

  it("D-045: un mail sin adjunto no crea orden pero no se pierde; leído dos veces no se repite", async () => {
    const raw = await buildMail({
      from: "juan@remeras.test",
      to: "dtf@viavinilo.test",
      subject: "Consulta sin archivo",
      messageId: "<conv-2@cliente.test>",
      text: "¿Cuánto sale el metro?",
    });
    expect((await ingestMail(deps(), dtf, raw)).result).toBe("SKIPPED_NO_FILES");
    await ingestMail(deps(), dtf, raw);
    expect(await prisma.message.count({ where: { externalKey: "DTF:<conv-2@cliente.test>" } })).toBe(1);
    const msg = await prisma.message.findFirstOrThrow({ where: { externalKey: "DTF:<conv-2@cliente.test>" } });
    expect(msg.jobId).toBeNull();
    expect(msg.body).toContain("¿Cuánto sale el metro?");
  });

  it("D-045: alguien que no es cliente y escribe sin archivo queda en un hilo por su email; si después se da de alta, el hilo pasa a ser suyo", async () => {
    const raw = await buildMail({
      from: "Nueva Gráfica <nueva@grafica.test>",
      to: "granformato@viavinilo.test",
      subject: "Hola",
      messageId: "<conv-3@grafica.test>",
      text: "Quiero ser cliente",
    });
    await ingestMail(deps(), granFormato, raw);
    expect(await prisma.customerEmail.count({ where: { email: "nueva@grafica.test" } })).toBe(0);
    const byEmail = await thread({ contactEmail: "nueva@grafica.test" });
    expect(byEmail.contactName).toBe("Nueva Gráfica");

    // Ahora manda un trabajo: se crea el cliente pendiente (D-014) y el hilo pasa a ser del cliente.
    await ingestMail(
      deps(),
      granFormato,
      await buildMail({
        from: "nueva@grafica.test",
        to: "granformato@viavinilo.test",
        subject: "Lona",
        messageId: "<conv-4@grafica.test>",
        attachments: [fakePdf("lona.pdf")],
      }),
    );
    const merged = await prisma.conversation.findUniqueOrThrow({ where: { id: byEmail.id }, include: { messages: true } });
    expect(merged.customerId).not.toBeNull();
    expect(merged.contactEmail).toBeNull();
    expect(merged.messages).toHaveLength(2);
  });

  it("D-045: los mails de un cliente bloqueado igual quedan en su hilo para que el asesor los vea", async () => {
    const out = await ingestMail(
      deps(),
      dtf,
      await buildMail({
        from: "bloqueado@cliente.test",
        to: "dtf@viavinilo.test",
        subject: "Otro pedido",
        messageId: "<conv-5@cliente.test>",
        attachments: [fakePdf("x.pdf")],
      }),
    );
    expect(out.result).toBe("REJECTED_BLOCKED");
    expect(await prisma.message.count({ where: { externalKey: "DTF:<conv-5@cliente.test>" } })).toBe(1);
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

describe("material elegido en el mail (D-095)", () => {
  it("D-095: si el mail nombra un material del tablero, el pedido nace con ese material; si nombra varios o ninguno, sin material", async () => {
    const gli = await prisma.sectorVariant.create({ data: { sectorId: dtf.id, code: "W-GLI", name: "Glitter" } });
    await prisma.sectorVariant.create({ data: { sectorId: dtf.id, code: "W-REF", name: "Reflectivo" } });
    const send = async (subject: string, text: string) => {
      const id = nextId();
      const raw = await buildMail({ from: "juan@remeras.test", to: "dtf@viavinilo.test", subject, text, messageId: id, attachments: [fakePdf(`v-${id.replace(/\W/g, "")}.pdf`)] });
      const out = await ingestMail(deps(), dtf, raw);
      return (await prisma.jobOrder.findUniqueOrThrow({ where: { id: out.jobId! } })).variantId;
    };
    expect(await send("Remeras glitter", "58 x 100 cm")).toBe(gli.id);
    expect(await send("Remeras", "glitter o reflectivo, lo que tengan")).toBeNull();
    expect(await send("Remeras", "58 x 100 cm")).toBeNull();
  });
});

describe("sub-servicios sin casilla (D-092)", () => {
  let eco: Sector;
  let latex: Sector;
  let tpu: Sector;
  beforeAll(async () => {
    eco = await prisma.sector.create({ data: { code: "ECOSOLVENTE", name: "Ecosolvente", parentId: granFormato.id } });
    latex = await prisma.sector.create({ data: { code: "LATEX", name: "Látex", parentId: granFormato.id } });
    await prisma.sector.create({ data: { code: "CORTES", name: "Cortes", parentId: granFormato.id } });
    tpu = await prisma.sector.create({ data: { code: "TPU", name: "TPU" } });
  });
  const send = async (to: Sector, inbox: string, subject: string, text: string, messageId = nextId()) => {
    const raw = await buildMail({ from: "juan@remeras.test", to: inbox, subject, text, messageId, attachments: [fakePdf(`a-${messageId.replace(/\W/g, "")}.pdf`)] });
    return ingestMail(deps(), to, raw);
  };
  const sectorOf = async (jobId: string | undefined) => (await prisma.jobOrder.findUniqueOrThrow({ where: { id: jobId! } })).sectorId;

  it("D-092: un mail a la casilla de Gran Formato que nombra un sub-servicio entra directo en ese sub-servicio", async () => {
    const a = await send(granFormato, "granformato@viavinilo.test", "Lona en ECOSOLVENTE 3x1", "Hola, va la lona de 300 x 100 cm.");
    expect(await sectorOf(a.jobId)).toBe(eco.id);
    const b = await send(granFormato, "granformato@viavinilo.test", "Vinilo", "Es para látex, 60 x 200 cm");
    expect(await sectorOf(b.jobId)).toBe(latex.id);
  });

  it("D-092: si no nombra ninguno, nombra varios o solo dice 'con corte', queda en Gran Formato para que lo clasifique una persona", async () => {
    const ninguno = await send(granFormato, "granformato@viavinilo.test", "Cartel 2x1", "Va el archivo del cartel.");
    expect(await sectorOf(ninguno.jobId)).toBe(granFormato.id);
    const varios = await send(granFormato, "granformato@viavinilo.test", "Cotización", "¿Conviene látex o ecosolvente para esta lona?");
    expect(await sectorOf(varios.jobId)).toBe(granFormato.id);
    const conCorte = await send(granFormato, "granformato@viavinilo.test", "Vinilo ecosolvente con corte", "Vinilo ecosolvente con corte al ras, 50 x 50 cm");
    expect(await sectorOf(conCorte.jobId)).toBe(eco.id);
  });

  it("D-092: TPU no tiene casilla: un mail a DTF que dice TPU entra al tablero TPU, y uno común sigue en DTF", async () => {
    const a = await send(dtf, "dtf@viavinilo.test", "Parches TPU", "Necesito 20 parches en TPU de 8 x 8 cm");
    expect(await sectorOf(a.jobId)).toBe(tpu.id);
    const b = await send(dtf, "dtf@viavinilo.test", "Remeras", "DTF textil 58 x 100 cm");
    expect(await sectorOf(b.jobId)).toBe(dtf.id);
    // Gran Formato no manda nada a TPU aunque el mail lo nombre.
    const c = await send(granFormato, "granformato@viavinilo.test", "Consulta", "¿hacen tpu?");
    expect(await sectorOf(c.jobId)).toBe(granFormato.id);
  });

  it("D-092: el mismo mail leído dos veces no duplica el pedido aunque haya quedado en un sub-servicio", async () => {
    const id = nextId();
    const first = await send(granFormato, "granformato@viavinilo.test", "Ecosolvente 2x1", "lona", id);
    const again = await send(granFormato, "granformato@viavinilo.test", "Ecosolvente 2x1", "lona", id);
    expect(first.result).toBe("CREATED");
    expect(again).toMatchObject({ result: "DUPLICATE", jobId: first.jobId });
  });
});

