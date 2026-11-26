import { describe, expect, it } from "vitest";
import type { ConversationMessage, ConversationThread } from "@viavinilo/contracts";
import {
  addFiles,
  ago,
  authorLabel,
  bubbleKind,
  channelHint,
  customerBadge,
  defaultChannel,
  emptyListText,
  initials,
  listQuery,
  mailTooBig,
  nameOf,
} from "./inbox";

const customer = { id: "c1", customerNumber: 42, firstName: null, lastName: null, businessName: null, status: "ACTIVE" as const };

function msg(over: Partial<ConversationMessage>): ConversationMessage {
  return {
    id: "m",
    direction: "IN",
    channel: "APP",
    subject: null,
    body: "",
    attachments: null,
    jobId: null,
    fromEmail: null,
    createdAt: "2026-11-26T12:00:00Z",
    sector: null,
    author: null,
    fromBot: false,
    ...over,
  };
}

function thread(over: Partial<ConversationThread>): ConversationThread {
  return {
    id: "t",
    botEnabled: false,
    needsHuman: false,
    needsHumanReason: null,
    customer: { ...customer, emails: [], phones: [], internalNotes: null, appPasswordSetAt: null },
    contactEmail: null,
    contactName: null,
    messages: [],
    jobs: [],
    ...over,
  };
}

describe("nombre e iniciales del hilo", () => {
  it("usa nombre y apellido, después la razón social y por último el número", () => {
    expect(nameOf({ customer: { ...customer, firstName: "Ana", lastName: "Paz" }, contactName: null, contactEmail: null })).toBe("Ana Paz");
    expect(nameOf({ customer: { ...customer, businessName: "Gráfica Sur" }, contactName: null, contactEmail: null })).toBe("Gráfica Sur");
    expect(nameOf({ customer, contactName: null, contactEmail: null })).toBe("Cliente N.º 42");
  });
  it("sin cliente usa el contacto del mail", () => {
    expect(nameOf({ customer: null, contactName: null, contactEmail: "a@b.com" })).toBe("a@b.com");
    expect(nameOf({ customer: null, contactName: null, contactEmail: null })).toBe("Sin nombre");
  });
  it("las iniciales saltean palabras cortas", () => {
    expect(initials("Ana de la Paz")).toBe("AP");
    expect(initials("Gráfica Sur Norte")).toBe("GS");
    expect(initials("a@b")).toBe("A");
    expect(initials("de la")).toBe("?");
  });
});

describe("ago (D-059)", () => {
  const now = new Date("2026-11-26T15:00:00");
  it("dice recién, minutos u horas del mismo día", () => {
    expect(ago(new Date("2026-11-26T14:59:40").toISOString(), now)).toBe("recién");
    expect(ago(new Date("2026-11-26T14:55:00").toISOString(), now)).toBe("hace 5 min");
    expect(ago(new Date("2026-11-26T13:00:00").toISOString(), now)).toBe("hace 2 h");
  });
  it("ayer y fechas anteriores", () => {
    expect(ago(new Date("2026-11-25T10:00:00").toISOString(), now)).toBe("ayer");
    expect(ago(new Date("2026-11-20T10:00:00").toISOString(), now)).toBe("20/11");
  });
});

describe("listado", () => {
  it("arma la consulta con filtro y búsqueda", () => {
    expect(listQuery("ALL", "")).toBe("filter=ALL&pageSize=50");
    expect(listQuery("UNREAD", "ana")).toBe("filter=UNREAD&pageSize=50&search=ana");
  });
  it("el texto de lista vacía depende del filtro", () => {
    expect(emptyListText("ALL", "")).toBe("Todavía no hay conversaciones.");
    expect(emptyListText("APP", "")).toBe("No hay conversaciones con ese filtro.");
    expect(emptyListText("ALL", "x")).toBe("No hay conversaciones con ese filtro.");
  });
});

describe("respuesta del asesor", () => {
  it("por defecto responde por la app si el cliente está activo y no escribió por mail", () => {
    expect(defaultChannel(thread({ messages: [msg({ channel: "APP" })] }))).toBe("APP");
    expect(defaultChannel(thread({ messages: [msg({ channel: "MAIL" })] }))).toBe("MAIL");
    expect(defaultChannel(thread({ customer: null }))).toBe("MAIL");
  });
  it("el aviso dice por dónde sale", () => {
    expect(channelHint("APP", undefined)).toBe("Lo ve en la pestaña Chat de la app.");
    expect(channelHint("MAIL", msg({ sector: { name: "DTF" } }))).toBe("Sale desde la casilla de DTF, en el mismo hilo de su mail.");
    expect(channelHint("MAIL", msg({}))).toBe("Sale desde la casilla de Via Vinilo, en el mismo hilo de su mail.");
    expect(channelHint("MAIL", undefined)).toBe("Sale desde la casilla de soporte.");
  });
  it("por mail entran hasta 20 MB de adjuntos", () => {
    const big = { size: 21 * 1024 * 1024 } as File;
    expect(mailTooBig("MAIL", [big])).toBe(true);
    expect(mailTooBig("APP", [big])).toBe(false);
  });
  it("se suman archivos hasta el máximo por mensaje", () => {
    const f = (name: string) => ({ name }) as File;
    expect(addFiles([f("a"), f("b"), f("c")], [f("d"), f("e"), f("f")]).map((x) => x.name)).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("burbujas", () => {
  it("clase según quién escribió", () => {
    expect(bubbleKind(msg({ fromBot: true }))).toBe("ai");
    expect(bubbleKind(msg({ fromStaff: true }))).toBe("staff");
    expect(bubbleKind(msg({ direction: "IN" }))).toBe("in");
    expect(bubbleKind(msg({ direction: "OUT" }))).toBe("out");
  });
  it("autor del mensaje", () => {
    expect(authorLabel(msg({ direction: "OUT", fromBot: true }))).toBe("Bot");
    expect(authorLabel(msg({ direction: "OUT", author: { name: "Vero" } }))).toBe("Vero");
    expect(authorLabel(msg({ direction: "OUT" }))).toBe("Via Vinilo");
    expect(authorLabel(msg({ fromStaff: true, fromEmail: "x@viavinilo.com" }))).toBe("Reenvío del equipo · x@viavinilo.com");
    expect(authorLabel(msg({ channel: "MAIL", fromEmail: "c@d.com" }))).toBe("c@d.com");
    expect(authorLabel(msg({ channel: "MAIL" }))).toBe("Mail");
    expect(authorLabel(msg({}))).toBe("App");
  });
});

describe("estado del cliente", () => {
  it("tono y texto del badge", () => {
    expect(customerBadge("ACTIVE")).toEqual({ tone: "ok", label: "Activo" });
    expect(customerBadge("PENDING")).toEqual({ tone: "warn", label: "Alta pendiente" });
    expect(customerBadge("BLOCKED")).toEqual({ tone: "bad", label: "Bloqueado" });
  });
});
