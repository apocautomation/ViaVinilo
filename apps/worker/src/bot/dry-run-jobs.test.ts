import { describe, expect, it } from "vitest";
import { dryRunJobs } from "./dry-run-jobs";
import { fixedFlow } from "./flows";

const now = new Date("2026-11-24T15:00:00-03:00");

describe("prueba del bot sin tocar la base (D-096)", () => {
  it("D-096: pasa todos los datos del pedido de ejemplo, también archivos, links y monto de la seña", () => {
    const [job] = dryRunJobs(
      [
        {
          label: "VV-000052",
          status: "Cotizado",
          quotedAmount: "45000",
          depositRequired: true,
          depositAmount: "20000",
          files: ["lona.pdf"],
          hasLinks: true,
          fileIssue: "x",
          fileCheck: "review",
          estimatedReadyAt: "2026-11-27T17:30:00-03:00",
        },
      ],
      now,
    );
    expect(job).toMatchObject({ label: "VV-000052", depositAmount: "20000", files: ["lona.pdf"], hasLinks: true, fileIssue: "x", fileCheck: "review" });
    expect(job!.estimatedReadyAt?.toISOString()).toBe("2026-11-27T20:30:00.000Z");
    expect(job!.createdAt).toBe(now);
  });

  it("D-096: completa lo que falta con valores neutros y sin inventar archivos", () => {
    const [job] = dryRunJobs([{}], now);
    expect(job).toMatchObject({ label: "VV-000001", sector: "DTF Textil", status: "Archivo recibido", depositRequired: false, estimatedReadyAt: null });
    // Si el ejemplo no dice qué archivos tiene, no se afirma nada (igual que el bot con el dato ausente).
    expect(job!.files).toBeUndefined();
  });

  it("D-096: con los datos completos la prueba responde lo mismo que el worker", () => {
    const sinArchivo = dryRunJobs([{ label: "VV-000052", description: "Lona 3 x 1 m", files: [] }], now);
    const ctx = { firstName: null, alreadyTalking: true, noticesOn: false };
    expect(fixedFlow("llegó mi archivo?", { ...ctx, jobs: sinArchivo })).toContain("tengo el pedido, pero todavía no tengo ningún archivo");
    const conSena = dryRunJobs([{ label: "VV-000053", status: "Cotizado", quotedAmount: "45000", depositRequired: true, depositAmount: "20000" }], now);
    expect(fixedFlow("ya está listo mi pedido?", { ...ctx, jobs: conSena })).toMatch(/falta la seña de \$\s?20\.000,00/);
  });
});
