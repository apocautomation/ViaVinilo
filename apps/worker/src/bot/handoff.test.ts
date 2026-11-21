import { describe, expect, it } from "vitest";
import { fixedHandoff, handoffReply } from "./handoff";

describe("derivación fija a un asesor (D-057)", () => {
  it("D-057: detecta los casos de Runamatic que siempre van a una persona", () => {
    expect(fixedHandoff("Quiero cancelar el pedido")).toBe("Quiere cancelar o cambiar un pedido");
    expect(fixedHandoff("la remera vino fallada")).toBe("Reclamo por una falla");
    expect(fixedHandoff("cuanto sale el metro?")).toBe("Pide precio o presupuesto");
    expect(fixedHandoff("ahí te mandé el comprobante")).toBe("Manda un comprobante de pago");
    expect(fixedHandoff("quiero hablar con un asesor")).toBe("Pide hablar con una persona");
    expect(fixedHandoff("Envian san juan Urgente porfavor, para hoy")).toBe("Pide urgencia o que lo manden a otra sucursal");
    expect(fixedHandoff("ENVIAR A LA SAN JUAN")).toBe("Pide urgencia o que lo manden a otra sucursal");
    expect(fixedHandoff("ya te transferí")).toBe("Manda un comprobante de pago");
    // Pedir el alias para transferir no es mandar un comprobante (D-066).
    expect(fixedHandoff("me pasas el alias para transferir?")).toBeNull();
    expect(fixedHandoff("¿ya está listo mi pedido?")).toBeNull();
    expect(fixedHandoff("¿cómo mando el archivo para DTF?")).toBeNull();
  });

  it("D-057: fuera de horario avisa que responden el próximo día hábil", () => {
    expect(handoffReply(new Date("2026-11-20T18:00:00Z"))).toMatch(/en un rato/); // viernes 15:00
    expect(handoffReply(new Date("2026-11-21T01:00:00Z"))).toMatch(/próximo día hábil/); // viernes 22:00
    expect(handoffReply(new Date("2026-11-22T15:00:00Z"))).toMatch(/próximo día hábil/); // domingo
  });
});
