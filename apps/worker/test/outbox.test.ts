import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hostingerSender, sendOutbox, type OutgoingMail } from "../src/mail/outbox";
import { HostingerMailError } from "../src/mail/sources/hostinger-api";
import { startTestDb } from "./test-db";

let prisma: PrismaClient;
let stopDb: () => Promise<void>;
const noSleep = async () => {};

beforeAll(async () => {
  const db = await startTestDb();
  stopDb = db.stop;
  prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
});
beforeEach(async () => {
  await prisma.outboundEmail.deleteMany();
});
afterAll(async () => {
  await prisma?.$disconnect();
  await stopDb?.();
});

const queue = (to: string) =>
  prisma.outboundEmail.create({
    data: {
      to,
      subject: "Via Vinilo · Tu acceso a la app",
      text: `Creá tu contraseña: https://viavinilo.tech/activar/tok_${to.replace(/\W/g, "")}abcdefghijklmnop`,
      kind: "activation-invite",
    },
  });

describe("cola de mails a clientes (D-049)", () => {
  it("D-049: manda de a pocos por vuelta, en orden, y no deja guardado el link de activación", async () => {
    for (const n of [1, 2, 3]) await queue(`c${n}@cliente.test`);
    const sent: OutgoingMail[] = [];
    const r = await sendOutbox(prisma, async (m) => void sent.push(m), { perRun: 2, sleep: noSleep });
    expect(r).toEqual({ sent: 2, failed: 0 });
    expect(sent.map((m) => m.to)).toEqual(["c1@cliente.test", "c2@cliente.test"]);
    expect(sent[0]!.text).toContain("/activar/tok_");

    const done = await prisma.outboundEmail.findMany({ where: { status: "SENT" } });
    expect(done).toHaveLength(2);
    expect(done.every((m) => !m.text.includes("/activar/") && m.text.includes("[link enviado]"))).toBe(true);
    expect(await prisma.outboundEmail.count({ where: { status: "PENDING" } })).toBe(1);
  });

  it("D-049: si Hostinger frena por cantidad (429) corta la vuelta y reintenta después; a los 5 errores lo da por fallido", async () => {
    for (const n of [1, 2]) await queue(`r${n}@cliente.test`);
    const limited = async () => {
      throw new HostingerMailError("demasiados pedidos", 429);
    };
    expect(await sendOutbox(prisma, limited, { sleep: noSleep })).toEqual({ sent: 0, failed: 1 });
    expect(await prisma.outboundEmail.count({ where: { status: "PENDING", attempts: 0 } })).toBe(1);

    const broken = async () => {
      throw new Error("caído");
    };
    for (let i = 0; i < 5; i++) await sendOutbox(prisma, broken, { perRun: 1, sleep: noSleep });
    const first = await prisma.outboundEmail.findFirstOrThrow({ where: { to: "r1@cliente.test" } });
    expect(first.status).toBe("FAILED");
    expect(first.lastError).toBe("caído");
  });

  it("D-049: con la API de Hostinger manda desde la casilla configurada", async () => {
    const calls: { url: string; body?: unknown }[] = [];
    const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.endsWith("/me")) {
        return new Response(JSON.stringify({ data: { mailboxes: [{ resourceId: "ACsoporte", address: "Soporte@viavinilo.test" }] } }));
      }
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    const send = hostingerSender({ token: "t", baseUrl: "https://api.test/api/v1" }, "soporte@viavinilo.test", fakeFetch);
    await send({ to: "ana@cliente.test", subject: "Hola", text: "Texto" });
    expect(calls.at(-1)).toEqual({
      url: "https://api.test/api/v1/mailboxes/ACsoporte/send",
      body: { to: ["ana@cliente.test"], subject: "Hola", text: "Texto", displayName: "Via Vinilo" },
    });

    const wrong = hostingerSender({ token: "t", baseUrl: "https://api.test/api/v1" }, "otra@viavinilo.test", fakeFetch);
    await expect(wrong({ to: "a@b.test", subject: "x", text: "y" })).rejects.toThrow(/no tiene acceso a otra@viavinilo.test/);
  });
});
