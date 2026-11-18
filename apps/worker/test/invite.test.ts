import type { AddressInfo } from "node:net";
import type { Sector } from "@prisma/client";
import { simpleParser } from "mailparser";
import { SMTPServer } from "smtp-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSmtpNotifier } from "../src/mail/invite";

const received: Buffer[] = [];
let server: SMTPServer;
let port: number;

beforeAll(async () => {
  server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onData(stream, _session, callback) {
      const chunks: Buffer[] = [];
      stream.on("data", (c: Buffer) => chunks.push(c));
      stream.on("end", () => {
        received.push(Buffer.concat(chunks));
        callback();
      });
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("mail con el link de alta (D-014)", () => {
  it("se envía por SMTP con Reply-To a la casilla del sector y el link de alta", async () => {
    const notifier = createSmtpNotifier({
      url: `smtp://127.0.0.1:${port}`,
      from: "Via Vinilo <no-responder@viavinilo.test>",
      signupUrl: "https://app.viavinilo.test/alta",
    });
    const sector = { code: "GRAN_FORMATO", inboxEmail: "granformato@viavinilo.test" } as Sector;

    await notifier.sendSignupInvite({ to: "ana@nuevo.test", sector, subject: "Lona 2x1" });

    expect(received).toHaveLength(1);
    const mail = await simpleParser(received[0]!);
    expect(mail.to && "text" in mail.to ? mail.to.text : "").toBe("ana@nuevo.test");
    // Las respuestas tienen que volver al sector, no rebotar a DTF (actualización §2.2).
    expect(mail.replyTo?.text).toBe("granformato@viavinilo.test");
    expect(mail.headers.get("auto-submitted")).toBe("auto-generated");
    expect(mail.subject).toBe("Via Vinilo · Completá tu alta para imprimir");
    expect(mail.text).toContain("https://app.viavinilo.test/alta");
    expect(mail.text).toContain('("Lona 2x1")');
    expect(mail.text).toContain("Tu trabajo quedó guardado");
  });
});
