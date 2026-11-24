import type { BotJob } from "./prompt";

/** Un pedido de ejemplo como se escribe en el JSON de la prueba: todo opcional, fechas como texto. */
export type DryRunJob = Partial<Omit<BotJob, "createdAt" | "estimatedReadyAt">> & { createdAt?: string; estimatedReadyAt?: string | null };

/**
 * Arma los pedidos de la prueba del bot (D-096). Se completan solo los datos que faltan y se pasa
 * todo lo demás tal cual: antes se copiaba campo por campo y los que se agregaban después (archivos,
 * links, monto de la seña) se perdían sin aviso, así que la prueba respondía distinto que el worker.
 */
export function dryRunJobs(jobs: DryRunJob[] | undefined, now: Date): BotJob[] {
  return (jobs ?? []).map((j, n) => ({
    label: `VV-${String(n + 1).padStart(6, "0")}`,
    sector: "DTF Textil",
    status: "Archivo recibido",
    description: null,
    quotedAmount: null,
    depositRequired: false,
    depositPaid: false,
    ...j,
    estimatedReadyAt: j.estimatedReadyAt ? new Date(j.estimatedReadyAt) : null,
    createdAt: j.createdAt ? new Date(j.createdAt) : now,
  }));
}
