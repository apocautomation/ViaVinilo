import { describe, expect, it } from "vitest";
import { asksToCancel, jobDescription, ownText } from "./intent";
import { isBounce } from "./parse";

const quoted = `Te lo vuelvo a enviar.

El jue, 19 nov 2026 a las 20:42, Calandra (<calandra@viavinilo.test>)
escribió:

> La tela tropical tiene hasta 1,45 m de ancho. Tu archivo excede esas medidas.
> ¿Podés enviarlo corregido?`;

describe("intención del mail (D-111)", () => {
  it("D-111: separa lo que escribió el cliente de lo citado", () => {
    expect(ownText(quoted)).toBe("Te lo vuelvo a enviar.");
    expect(ownText("Va el archivo\n\nOn Thu, Nov 19, 2026 at 8:42 PM X <x@y.test> wrote:\n> hola")).toBe("Va el archivo");
    expect(ownText("Hola\n-----Mensaje original-----\nDe: ventas")).toBe("Hola");
    expect(ownText("Solo texto, sin cita")).toBe("Solo texto, sin cita");
  });

  it("D-111: pide cancelar si lo escribe el cliente, en el asunto o en el texto", () => {
    expect(asksToCancel({ subject: "CANCELAR PEDIDO DE LAS 15:43 POR ERROR", text: "Hay un error, cancelar ese pedido. Vuelvo a enviar el archivo." })).toBe(true);
    expect(asksToCancel({ subject: "pedido", text: "Por favor anulen el pedido de ayer" })).toBe(true);
    expect(asksToCancel({ subject: "pedido", text: "Cancelen el VV-000123, me equivoqué de tela" })).toBe(true);
    expect(asksToCancel({ subject: "Remeras", text: "Eliminen ese pedido, lo armo de nuevo" })).toBe(true);
    expect(asksToCancel({ subject: "dtf 0,58x1mt", text: "Va el archivo\nCANCELAR EL ANTERIOR" })).toBe(true);
  });

  it("D-111: no es cancelar el asunto de un mail anterior, 'cancelado' ni pagar el saldo", () => {
    // El caso real: contesta un mail del taller titulado "PEDIDO CANCELADO" con el archivo corregido.
    expect(asksToCancel({ subject: "Re: PEDIDO CANCELADO", text: quoted })).toBe(false);
    expect(asksToCancel({ subject: "Remeras", text: "El pedido anterior quedó cancelado, va este nuevo" })).toBe(false);
    expect(asksToCancel({ subject: "Lona 3x1", text: "Cancelo el saldo cuando lo retiro" })).toBe(false);
    expect(asksToCancel({ subject: "Lona 3x1", text: "Te paso el archivo para imprimir" })).toBe(false);
    expect(asksToCancel({ subject: "Re: hola", text: "Va de nuevo\n\n> cancelar el anterior" })).toBe(false);
  });

  it("D-111: en una respuesta va primero lo que escribió el cliente; en un reenvío, el asunto sin el prefijo", () => {
    expect(jobDescription("Re: PEDIDO CANCELADO", quoted)).toBe("Te lo vuelvo a enviar. (en respuesta a «PEDIDO CANCELADO»)");
    expect(jobDescription("RE: Remeras 58 x 100", "> solo cita")).toBe("Remeras 58 x 100");
    // Saludos, emojis, líneas de guiones o links no sirven: queda el asunto.
    expect(jobDescription("Re: respuesta automática", "👍")).toBe("respuesta automática");
    expect(jobDescription("Re: Juana dtfuv", "Estimado\n\nVa de nuevo")).toBe("Va de nuevo (en respuesta a «Juana dtfuv»)");
    expect(jobDescription("RV: Juana", "________________\nDe: alguien")).toBe("Juana");
    expect(jobDescription("Fwd: DTF 58x100", "DTF UV\nva el archivo")).toBe("DTF 58x100");
    expect(jobDescription("Lona front 3 x 1", "Va el archivo")).toBe("Lona front 3 x 1");
    expect(jobDescription(null, "Va el archivo")).toBeNull();
  });

  it("D-112: reconoce los avisos de 'no entregado'; un cliente que escribe 'undeliverable' no es un rebote", () => {
    expect(isBounce("Sin entregar: RESPUESTA", null)).toBe(true);
    expect(isBounce("Undeliverable: DTF 58x100", "postmaster@servidor.test")).toBe(true);
    expect(isBounce("Mail delivery failed: returning message to sender", "mailer-daemon@hostinger.test")).toBe(true);
    expect(isBounce("RE: dtf textil", null)).toBe(false);
    expect(isBounce("Undeliverable pero va el archivo", "cliente@remeras.test")).toBe(false);
    expect(isBounce("cualquier asunto", "cliente@remeras.test", true)).toBe(true);
  });
});
