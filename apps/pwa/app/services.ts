import type { SectorCode } from "@viavinilo/contracts";

/** Servicio de la Ayuda → tablero donde entra el pedido (D-062). */
export const SECTOR_OF: Record<string, SectorCode> = {
  "dtf-textil": "DTF",
  "dtf-uv": "DTF_UV",
  sublimacion: "SUBLIMACION",
  calandra: "CALANDRADO",
  // D-082: cada sub-servicio de Gran Formato entra con su nombre (se ven juntos en ese tablero).
  "uv-rigidos": "UV_RIGIDOS",
  ecosolvente: "ECOSOLVENTE",
  "uv-rollo": "UV_ROLLO",
  corte: "CORTES",
  latex: "LATEX",
};
