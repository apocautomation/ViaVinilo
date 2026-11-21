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
    expect(fixedFlow("¿dónde queda la sucursal para retirar DTF y qué horario tiene?", ctx)).toMatch(/^Sucursal Centro · San Juan 714/);
    expect(fixedFlow("¿qué horario tienen para lonas?", ctx)).toMatch(/^Planta Av\. Chile · Av\. Chile 1822/);
    expect(fixedFlow("donde retiro lo de dtf?", ctx)).toMatch(/^Sucursal Centro/);
  });

  it("D-066: la dirección se responde ordenada, una sucursal por bloque", () => {
    const r = fixedFlow("Me podes decir la dirección?", ctx)!;
    expect(r.split("\n\n")).toHaveLength(4);
    expect(r).toMatch(/^Tenemos dos sucursales:/);
    expect(r).toContain("Sucursal Centro · San Juan 714, Salta\nDTF Textil y DTF UV\nLunes a viernes de 08:30 a 19:30 · Sábados de 08:30 a 13:00\nMapa: https://maps.google.com/?q=San+Juan+714,+Salta");
  });

  it("D-066: sábados y 'hasta qué hora hoy' se responden con lo que se preguntó", () => {
    expect(fixedFlow("abren los sabados?", ctx)).toBe("Sí, los sábados a la mañana: Planta Av. Chile de 08:00 a 12:00 y Sucursal Centro de 08:30 a 13:00.");
    // Sábado 21/11/2026 a las 10:00 de Salta.
    expect(fixedFlow("hasta que hora atienden hoy?", { ...ctx, now: new Date("2026-11-21T13:00:00Z") })).toBe("Hoy atendemos: Planta Av. Chile de 08:00 a 12:00 y Sucursal Centro de 08:30 a 13:00.");
    expect(fixedFlow("hasta que hora atienden hoy?", { ...ctx, now: new Date("2026-11-22T13:00:00Z") })).toMatch(/^Hoy domingo está cerrado/);
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

describe("tableros creados desde el ERP (D-064)", () => {
  const boards = [{ name: "TPU", email: "tpu@viavinilo.com" }, { name: "Bordado", email: null }];

  it("D-064: si el cliente nombra un tablero nuevo, el bot lo manda ahí", () => {
    const r = fixedFlow("necesito 3 metros de TPU", { ...ctx, boards })!;
    expect(r).toContain("tpu@viavinilo.com");
    expect(r).toContain("(TPU)");
    expect(fixedFlow("quiero hacer un bordado", { ...ctx, boards })).toMatch(/clip 📎 de este chat \(Bordado\)/);
  });

  it("D-064: un tablero nuevo no confunde palabras parecidas", () => {
    expect(fixedFlow("necesito imprimir una lona", { ...ctx, boards })).toContain("granformato@viavinilo.com");
  });
});

describe("respuestas que la IA contestaba mal (D-066)", () => {
  it("D-066: 'gracias' y 'ok' cierran la charla, no piden el material", () => {
    expect(fixedFlow("gracias!", ctx)).toBe("¡De nada! Cualquier cosa, escribime por acá.");
    expect(fixedFlow("ok", ctx)).toBe("¡Dale! Cualquier cosa, escribime por acá.");
    expect(fixedFlow("muchas gracias, saludos", ctx)).toMatch(/De nada/);
  });

  it("D-066: pedir el alias da los datos de pago del servicio; sin servicio, los dos", () => {
    const dtf = fixedFlow("me pasas el alias para transferir lo de dtf?", ctx)!;
    expect(dtf).toContain("Mercado Pago");
    expect(dtf).not.toContain("Banco Macro");
    const all = fixedFlow("como pago la seña?", ctx)!;
    expect(all).toContain("Banco Macro");
    expect(all).toContain("Mercado Pago");
    expect(all).toContain("Mandá el comprobante por este chat");
  });

  it("D-066: no inventa envíos, diseño ni WhatsApp", () => {
    expect(fixedFlow("hacen envios?", ctx)).toMatch(/se retiran en la sucursal/);
    expect(fixedFlow("hacen diseños?", ctx)).toMatch(/^No\. Somos mayoristas/);
    expect(fixedFlow("tienen whatsapp?", ctx)).toMatch(/por este chat de la app/);
    expect(fixedFlow("venden vinilo?", ctx)).toContain("viavinilo2.mitiendanube.com");
    expect(fixedFlow("puede retirar un cadete?", ctx)).toMatch(/tiene que entrar al local/);
    expect(fixedFlow("el archivo va en espejo?", ctx)).toMatch(/^No, salvo el vinilo termotransferible/);
  });

  it("D-066: lista los servicios, con los tableros nuevos", () => {
    expect(fixedFlow("que servicios tienen?", { ...ctx, boards: [{ name: "TPU", email: null }] })).toMatch(/^Hacemos: DTF Textil, DTF UV, .*TPU\./);
  });

  it("D-066: tiempos y formato", () => {
    expect(fixedFlow("cuanto tardan?", ctx)).toMatch(/^Entre 24 y 48 horas hábiles/);
    expect(fixedFlow("como tengo que mandar el archivo para dtf?", ctx)).toMatch(/^DTF Textil: PNG con fondo transparente/);
  });
});
