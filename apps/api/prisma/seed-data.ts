import {
  DEFAULT_SECTOR_SEQUENCES,
  SECTOR_CODES,
  SECTOR_INBOX_LOCAL_PART,
  SECTOR_NAMES,
  type JobStatus,
  type SectorCode,
} from "@viavinilo/contracts";

export interface SectorSeed {
  code: SectorCode;
  name: string;
  inboxEmail: string;
  stages: { status: JobStatus; position: number }[];
}

export interface MachineSeed {
  name: string;
  sectors: SectorCode[];
}

export interface FileErrorReasonSeed {
  code: string;
  label: string;
  sortOrder: number;
}

export function buildSectors(mailDomain: string): SectorSeed[] {
  return SECTOR_CODES.map((code) => ({
    code,
    name: SECTOR_NAMES[code],
    inboxEmail: `${SECTOR_INBOX_LOCAL_PART[code]}@${mailDomain}`.toLowerCase(),
    stages: DEFAULT_SECTOR_SEQUENCES[code].map((status, i) => ({ status, position: i + 1 })),
  }));
}

function numbered(prefix: string, count: number, sectors: SectorCode[]): MachineSeed[] {
  return Array.from({ length: count }, (_, i) => ({ name: `${prefix} ${i + 1}`, sectors }));
}

/**
 * 16 máquinas según SPEC §1: 4 plotters de Sublimación + Calandrado, 7 de Gran Formato y 5 de DTF / DTF UV.
 * TODO(spec): I-10 — nombres reales y a qué sector atiende cada una (Látex, DTF vs DTF UV, calandras).
 */
export const MACHINES: MachineSeed[] = [
  ...numbered("Plotter Sublimación", 4, ["SUBLIMACION", "CALANDRADO"]),
  ...numbered("Gran Formato", 7, ["GRAN_FORMATO", "LATEX"]),
  ...numbered("DTF", 5, ["DTF", "DTF_UV"]),
];

/** Motivos de error del SPEC §4 (FileErrorReason). Editables desde el sistema. */
export const FILE_ERROR_REASONS: FileErrorReasonSeed[] = [
  { code: "LOW_RESOLUTION", label: "Resolución baja" },
  { code: "SIZE_MISMATCH", label: "La medida no coincide con lo pedido" },
  { code: "COLORS", label: "Problema de colores" },
  { code: "FONTS_NOT_OUTLINED", label: "Fuentes no convertidas a curvas" },
  { code: "CORRUPT_FILE", label: "Archivo dañado o no se puede abrir" },
  { code: "MISSING_BLEED", label: "Falta sangrado" },
].map((r, i) => ({ ...r, sortOrder: i + 1 }));
