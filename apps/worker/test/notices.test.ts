import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NOTICES_SETTING_KEY } from "../src/bot/reply";
import { noticeText, processNotices } from "../src/notices";
import { startTestDb } from "./test-db";

let prisma: PrismaClient;
let stopDb: () => Promise<void>;
let customerId: string;
let sectorId: string;

beforeAll(async () => {
  const db = await startTestDb();
  stopDb = db.stop;
  prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
  sectorId = (await prisma.sector.create({ data: { code: "CALANDRADO", name: "Calandrado", inboxEmail: "calandra@viavinilo.test" } })).id;
  customerId = (
    await prisma.customer.create({
      data: { status: "ACTIVE", firstName: "Ana", lastName: "Gómez", emails: { create: { email: "ana@cliente.test", isPrimary: true } } },
    })
  ).id;
});
beforeEach(async () => {
  await prisma.outboundEmail.deleteMany();
  await prisma.message.deleteMany();
  await prisma.jobEvent.deleteMany();
  await prisma.jobOrder.deleteMany();
  await prisma.appSetting.deleteMany();
});
afterAll(async () => {
  await prisma?.$disconnect();
  await stopDb?.();
});

const jobWith = (status: "QUOTED" | "READY", extra: object = {}) =>
  prisma.jobOrder.create({
    data: {
      customerId,
      sectorId,
      status,
      source: "EMAIL",
      description: "Tela tropical",
      quotedAmount: "84500",
      depositRequired: true,
      ...extra,
      events: { create: { toStatus: status } },
    },
  });

describe("avisos de estado al cliente (D-060)", () => {
  it("D-060: arrancan apagados: no se avisa nada", async () => {
    await jobWith("READY");
    expect(await processNotices(prisma)).toEqual({ sent: 0 });
    expect(await prisma.message.count()).toBe(0);
  });

  it("D-060: prendidos, avisa por el chat y por mail una sola vez, y no manda lo que pasó antes de prenderlos", async () => {
    const old = await jobWith("READY");
    await prisma.jobEvent.updateMany({ where: { jobId: old.id }, data: { createdAt: new Date(Date.now() - 3600_000) } });
    await prisma.appSetting.create({ data: { key: NOTICES_SETTING_KEY, value: { enabled: true, since: new Date(Date.now() - 60_000).toISOString() } } });
    await jobWith("READY");

    expect(await processNotices(prisma)).toEqual({ sent: 1 });
    expect(await processNotices(prisma)).toEqual({ sent: 0 });

    const msg = await prisma.message.findFirstOrThrow();
    expect(msg).toMatchObject({ direction: "OUT", channel: "APP", subject: "Aviso automático" });
    expect(msg.body).toMatch(/listo para retirar en Planta Av\. Chile, Av\. Chile 1822/);
    const mail = await prisma.outboundEmail.findFirstOrThrow();
    expect(mail).toMatchObject({ to: "ana@cliente.test", kind: "status-notice" });
    expect(mail.subject).toMatch(/^Via Vinilo · Tu pedido está listo para retirar · VV-/);
    expect((await prisma.conversation.findFirstOrThrow()).customerUnread).toBe(1);
  });

  it("D-060: si el cliente no quiere mails, solo le llega por el chat", async () => {
    await prisma.customer.update({ where: { id: customerId }, data: { notificationPrefs: { push: true, email: false } } });
    await prisma.appSetting.create({ data: { key: NOTICES_SETTING_KEY, value: { enabled: true, since: new Date(Date.now() - 60_000).toISOString() } } });
    await jobWith("QUOTED");
    expect(await processNotices(prisma)).toEqual({ sent: 1 });
    expect(await prisma.outboundEmail.count()).toBe(0);
    await prisma.customer.update({ where: { id: customerId }, data: { notificationPrefs: { push: true, email: true } } });
  });

  it("D-060: la cotización dice el precio, la seña y cómo pagarla según el sector", () => {
    const q = noticeText(
      "QUOTED",
      { number: 12, description: "Tela", sector: { code: "CALANDRADO", name: "Calandrado" }, quotedAmount: "84500", depositRequired: true, depositAmount: null },
      { firstName: "Ana" },
    );
    expect(q.text).toMatch(/cotizado: \$\s?84\.500,00/);
    expect(q.text).toMatch(/seña del 50%/);
    expect(q.text).toMatch(/Banco Macro/);
    const dtf = noticeText(
      "QUOTED",
      { number: 13, description: null, sector: { code: "DTF", name: "DTF" }, quotedAmount: "1000", depositRequired: false, depositAmount: null },
      { firstName: null },
    );
    expect(dtf.text).toMatch(/Ya entra a producción/);
    expect(noticeText("READY", { number: 13, description: null, sector: { code: "DTF", name: "DTF" }, quotedAmount: null, depositRequired: false, depositAmount: null }, { firstName: null }).text).toMatch(/San Juan 714/);
  });
});
