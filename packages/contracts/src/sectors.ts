import { z } from "zod";

/** Sistemas de impresión de Via Vinilo (SPEC §1). Coincide con el enum `SectorCode` de Prisma. */
export const SECTOR_CODES = ["DTF", "DTF_UV", "GRAN_FORMATO", "LATEX", "CALANDRADO", "SUBLIMACION"] as const;

export const sectorCodeSchema = z.enum(SECTOR_CODES);
export type SectorCode = z.infer<typeof sectorCodeSchema>;

export const SECTOR_NAMES: Record<SectorCode, string> = {
  DTF: "DTF",
  DTF_UV: "DTF UV",
  GRAN_FORMATO: "Gran Formato",
  LATEX: "Látex",
  CALANDRADO: "Calandrado",
  SUBLIMACION: "Sublimación",
};

/** Parte local de la casilla de mail de cada sector (SPEC E1.1). El dominio va por entorno. */
export const SECTOR_INBOX_LOCAL_PART: Record<SectorCode, string> = {
  DTF: "dtf",
  DTF_UV: "dtfuv",
  GRAN_FORMATO: "granformato",
  LATEX: "latex",
  CALANDRADO: "calandra",
  SUBLIMACION: "sublimacion",
};
