import { PrismaClient } from "@prisma/client";
import { isPushEndpoint, pushPayloadFor, type PushPayload } from "@viavinilo/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { processPush, type PushTarget } from "../src/push";
import { startTestDb } from "./test-db";

let prisma: PrismaClient;
let stopDb: () => Promise<void>;
let customerId: string;
let conversationId: string;

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123";
const sentTo: { endpoint: string; payload: PushPayload }[] = [];
const sender = (result: "ok" | "gone" = "ok") => async (target: PushTarget, payload: PushPayload) => {
  sentTo.push({ endpoint: target.endpoint, payload });
  return result;
};
const out = (body: string, extra: object = {}) => prisma.message.create({ data: { conversationId, direction: "OUT", channel: "APP", body, ...extra } });

beforeAll(async () => {
  const db = await startTestDb();
  stopDb = db.stop;
  prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
  customerId = (await prisma.customer.create({ data: { status: "ACTIVE", firstName: "Ana" } })).id;
  conversationId = (await prisma.conversation.create({ data: { customerId } })).id;
});
beforeEach(async () => {
  sentTo.length = 0;
  await prisma.message.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.customer.update({ where: { id: customerId }, data: { notificationPrefs: { push: true, email: true }, status: "ACTIVE" } });
  await prisma.pushSubscription.create({ data: { customerId, endpoint: ENDPOINT, p256dh: "clave-publica-del-navegador", auth: "secreto-auth" } });
});
afterAll(async () => {
  await prisma?.$disconnect();
  await stopDb?.();
});

describe("notificaciones push de la app (D-068)", () => {
  it("D-068: la respuesta del equipo en el chat le llega al celular una sola vez", async () => {
    await out("Hola Ana, ya te paso el precio.");
    expect(await processPush(prisma, sender())).toEqual({ sent: 1, failed: 0, removed: 0 });
    expect(sentTo[0]).toEqual({ endpoint: ENDPOINT, payload: { title: "Via Vinilo · mensaje nuevo", body: "Hola Ana, ya te paso el precio.", url: "/chat" } });
    expect(await processPush(prisma, sender())).toEqual({ sent: 0, failed: 0, removed: 0 });
    expect(sentTo).toHaveLength(1);
  });

  it("D-068: el aviso automático de un pedido se titula distinto y el texto largo se corta", async () => {
    await out(`Tu pedido VV-000418 está listo para retirar. ${"Detalle ".repeat(40)}`, { subject: "Aviso automático" });
    await processPush(prisma, sender());
    expect(sentTo[0]!.payload.title).toBe("Via Vinilo · novedades de tu pedido");
    expect(sentTo[0]!.payload.body.length).toBeLessThanOrEqual(160);
    expect(sentTo[0]!.payload.body.endsWith("…")).toBe(true);
  });

  it("D-068: no notifica lo que escribe el cliente, los mails ni los mensajes viejos", async () => {
    await prisma.message.create({ data: { conversationId, direction: "IN", channel: "APP", body: "Hola" } });
    await out("Respuesta por mail", { channel: "MAIL" });
    await out("Mensaje de hace dos horas", { createdAt: new Date(Date.now() - 2 * 3_600_000) });
    expect((await processPush(prisma, sender())).sent).toBe(0);
    expect(sentTo).toHaveLength(0);
  });

  it("D-068: si el cliente apagó las notificaciones o está bloqueado, no se manda", async () => {
    await prisma.customer.update({ where: { id: customerId }, data: { notificationPrefs: { push: false, email: true } } });
    await out("Uno");
    expect((await processPush(prisma, sender())).sent).toBe(0);
    await prisma.customer.update({ where: { id: customerId }, data: { notificationPrefs: { push: true, email: true }, status: "BLOCKED" } });
    await out("Dos");
    expect((await processPush(prisma, sender())).sent).toBe(0);
  });

  it("D-068: si el celular ya no acepta avisos, la suscripción se da de baja sola", async () => {
    await out("Hola");
    expect(await processPush(prisma, sender("gone"))).toEqual({ sent: 0, failed: 0, removed: 1 });
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it("D-068: un envío que falla no frena al resto ni se repite", async () => {
    await prisma.pushSubscription.create({ data: { customerId, endpoint: "https://updates.push.services.mozilla.com/wpush/v2/xyz", p256dh: "otra-clave-publica", auth: "otro-auth" } });
    await out("Hola");
    const flaky = async (target: PushTarget) => {
      if (target.endpoint === ENDPOINT) throw new Error("timeout");
      return "ok" as const;
    };
    expect(await processPush(prisma, flaky)).toEqual({ sent: 1, failed: 1, removed: 0 });
    expect(await processPush(prisma, flaky)).toEqual({ sent: 0, failed: 0, removed: 0 });
  });

  it("D-068: solo se aceptan direcciones de los servicios de push de los navegadores", () => {
    expect(isPushEndpoint(ENDPOINT)).toBe(true);
    expect(isPushEndpoint("https://web.push.apple.com/QGk")).toBe(true);
    expect(isPushEndpoint("https://wns2-by3p.notify.windows.com/w/?token=abc")).toBe(true);
    expect(isPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(isPushEndpoint("https://postgres:5432/")).toBe(false);
    expect(isPushEndpoint("https://fcm.googleapis.com.atacante.com/x")).toBe(false);
    expect(isPushEndpoint("https://usuario@fcm.googleapis.com/x")).toBe(false);
    expect(isPushEndpoint("https://169.254.169.254/latest")).toBe(false);
  });

  it("D-068: un mensaje con solo un archivo avisa que hay un archivo", () => {
    expect(pushPayloadFor({ subject: null, body: "", attachments: 1 }).body).toBe("Te mandamos un archivo.");
  });
});
