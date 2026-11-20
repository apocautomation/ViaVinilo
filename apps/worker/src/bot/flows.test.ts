import { describe, expect, it } from "vitest";
import { fixedFlow } from "./flows";

const ctx = { firstName: "Juan", alreadyTalking: false, noticesOn: false, jobs: [] };

describe("flujos fijos del bot (D-060)", () => {
  it("D-060: saluda una sola vez por conversación", () => {
    expect(fixedFlow("hola", ctx)).toBe("¡Hola Juan! Soy el asistente de Via Vinilo. ¿En qué te ayudo?");
    expect(fixedFlow("Hola!", { ...ctx, alreadyTalking: true })).toBe("¿En qué te ayudo?");
  });

  it("D-060: un trabajo nuevo pide el archivo a la casilla correcta, con las medidas tal cual, sin decir que ya llegó", () => {
    const r = fixedFlow("Si claro te paso imprimir dos lonas front medida 5.10 ×1.10 solvente 8 onzas", { ...ctx, alreadyTalking: true })!;
    expect(r).toContain("granformato@viavinilo.com");
    expect(r).toContain("te pasamos el precio");
    expect(r).not.toMatch(/recib(ido|imos tu archivo)|listo/i);
    expect(fixedFlow("quiero imprimir 20 remeras", ctx)).toContain("dtf@viavinilo.com");
    expect(fixedFlow("necesito 3 metros de tela tropical", ctx)).toContain("calandra@viavinilo.com");
    expect(fixedFlow("quiero imprimir algo", ctx)).toMatch(/de qué material/);
  });

  it("D-060: '¿está listo?' se responde con los pedidos reales; sin pedidos no promete nada", () => {
    expect(fixedFlow("¿cuándo va a estar listo lo que te pedí?", ctx)).toMatch(/Todavía no veo pedidos tuyos/);
    const jobs = [{ label: "VV-000012", sector: "Calandrado", status: "Cotizado", description: "Tela", quotedAmount: "1", depositRequired: true, depositPaid: false, estimatedReadyAt: null, createdAt: new Date() }];
    expect(fixedFlow("ya está listo mi pedido?", { ...ctx, jobs })).toBe("Tu pedido: VV-000012 (Calandrado, Tela): Cotizado.");
    expect(fixedFlow("ya está listo mi pedido?", { ...ctx, jobs, noticesOn: true })).toMatch(/te llega un aviso/);
  });

  it("D-060: lo demás lo responde la IA", () => {
    expect(fixedFlow("¿qué diferencia hay entre DTF y sublimación?", ctx)).toBeNull();
  });
});

describe("preguntas frecuentes con datos del sistema (D-060)", () => {
  it("D-060: sucursal y horario según el servicio (DTF en San Juan, el resto en Av. Chile)", () => {
    expect(fixedFlow("¿dónde queda la sucursal para retirar DTF y qué horario tiene?", ctx)).toMatch(/^Sucursal Centro, San Juan 714/);
    expect(fixedFlow("¿qué horario tienen para lonas?", ctx)).toMatch(/^Planta Av\. Chile/);
    expect(fixedFlow("¿dónde están?", ctx)!.split("\n")).toHaveLength(2);
  });

  it("D-060: formato del archivo según el servicio, sin mezclar servicios", () => {
    const r = fixedFlow("¿puedo mandar el archivo en PDF para calandra?", ctx)!;
    expect(r).toMatch(/^Calandra \(telas\): PDF/);
    expect(r).toContain("calandra@viavinilo.com");
    expect(r).not.toMatch(/sublimaci/i);
    expect(fixedFlow("¿qué formato va?", ctx)).toMatch(/Para qué servicio es/);
  });

  it("D-060: tiempos de entrega sin prometer avisos si están apagados", () => {
    expect(fixedFlow("¿cuánto tarda más o menos un trabajo?", ctx)).not.toMatch(/aviso/);
    expect(fixedFlow("¿cuánto tarda?", { ...ctx, noticesOn: true })).toMatch(/te llega un aviso/);
  });
});

describe("casos de la prueba con mensajes reales (D-061)", () => {
  it("D-061: gana el servicio que nombra el cliente sobre el material", () => {
    expect(fixedFlow("adjunto png para impresión en vinilo dtf textil, 1 unidad de 0,58 x 0,50", ctx)).toContain("dtf@viavinilo.com");
    expect(fixedFlow("solvente base blanca con corte 100x60", ctx)).toContain("granformato@viavinilo.com");
  });

  it("D-061: 'lo retiro en la sucursal' en un pedido no es una pregunta de horarios", () => {
    const r = fixedFlow('Adjunto archivos calandra, tela tropical 6 paños de 4,00 x 1,40. Lo retiro en sucursal "San Juan"', ctx)!;
    expect(r).toContain("calandra@viavinilo.com");
    expect(fixedFlow("Tamaño = 58 x 50 1 U para retirar en la sucursal de la calle San Juan", ctx)).toMatch(/de qué material/);
  });

  it("D-061: si avisa que manda un archivo, le pide el material para darle la casilla", () => {
    expect(fixedFlow("Buenas ahi va en png", ctx)).toMatch(/de qué material/);
    expect(fixedFlow("Diseño sin título.png", ctx)).toMatch(/de qué material/);
  });
});
