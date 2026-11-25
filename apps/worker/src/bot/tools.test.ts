import { describe, expect, it } from "vitest";
import type { BotJob } from "./prompt";
import { buildToolKit } from "./tools";

const job = (over: Partial<BotJob>): BotJob => ({
  label: "VV-000050",
  sector: "DTF Textil",
  status: "Archivo recibido",
  description: null,
  quotedAmount: null,
  depositRequired: false,
  depositPaid: false,
  estimatedReadyAt: null,
  createdAt: new Date(),
  ...over,
});

describe("herramientas del bot (D-097)", () => {
  it("D-097: ver_mis_pedidos devuelve los pedidos reales con archivos, problema, precio y seña", () => {
    const kit = buildToolKit({
      noticesOn: false,
      jobs: [
        job({ files: ["logo.png"], fileCheck: "ok" }),
        job({ label: "VV-000051", status: "Archivo con error", files: [], fileIssue: "Resolución baja" }),
        job({ label: "VV-000052", status: "Cotizado", quotedAmount: "45000", depositRequired: true, depositAmount: "20000", files: ["lona.pdf"] }),
      ],
    });
    const all = JSON.parse(kit.run("ver_mis_pedidos", {})) as { pedidos_en_curso: Record<string, unknown>[]; total_en_curso: number };
    expect(all.total_en_curso).toBe(3);
    expect(all.pedidos_en_curso[0]).toMatchObject({ pedido: "VV-000050", archivos: ["logo.png"], control_del_archivo: "dio bien" });
    expect(all.pedidos_en_curso[1]).toMatchObject({ pedido: "VV-000051", archivos: "ninguno", problema_del_archivo: "Resolución baja" });
    expect(all.pedidos_en_curso[2]).toMatchObject({ precio: "45000", sena: "pendiente (20000)" });
    const one = JSON.parse(kit.run("ver_mis_pedidos", { numero: 51 })) as { pedido: { resumen: string } };
    expect(one.pedido.resumen).toContain("el archivo tiene un problema: Resolución baja");
    const nope = JSON.parse(kit.run("ver_mis_pedidos", { numero: "99" })) as { error: string };
    expect(nope.error).toContain("No hay un pedido número 99");
    expect(kit.used).toEqual(["ver_mis_pedidos", "ver_mis_pedidos", "ver_mis_pedidos"]);
  });

  it("D-097: info_servicio, sucursales, pagos y preguntas frecuentes salen de la Ayuda; derivar marca la derivación", () => {
    const kit = buildToolKit({ noticesOn: false, jobs: [] });
    expect(JSON.parse(kit.run("info_servicio", { servicio: "remeras" }))).toMatchObject({ servicio: "DTF Textil", casilla: "dtf@viavinilo.com" });
    expect(JSON.parse(kit.run("info_servicio", { servicio: "algo raro" }))).toHaveProperty("error");
    expect(kit.run("sucursales_y_horarios", {})).toContain("San Juan 714");
    expect(kit.run("datos_de_pago", { servicio: "lona" })).toContain("VIAPRINT.MACRO");
    expect(kit.run("preguntas_frecuentes", {})).toContain("espejo");
    expect(kit.handoff).toBeNull();
    kit.run("derivar_a_asesor", { motivo: "Pide factura A" });
    expect(kit.handoff).toEqual({ reason: "Pide factura A" });
  });
});
