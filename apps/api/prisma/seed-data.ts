import {
  DEFAULT_SECTOR_SEQUENCES,
  SECTOR_CODES,
  SECTOR_INBOX_LOCAL_PART,
  SECTOR_NAMES,
  SECTOR_PARENT,
  DEFAULT_SECTOR_VARIANTS,
  type JobStatus,
  type SectorCode,
} from "@viavinilo/contracts";

export interface SectorSeed {
  code: SectorCode;
  name: string;
  /** Los sub-servicios y TPU nacen sin casilla (D-082). */
  inboxEmail: string | null;
  /** Tablero del que es sub-servicio (D-082). */
  parent: SectorCode | null;
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
    inboxEmail: SECTOR_INBOX_LOCAL_PART[code] ? `${SECTOR_INBOX_LOCAL_PART[code]}@${mailDomain}`.toLowerCase() : null,
    parent: SECTOR_PARENT[code] ?? null,
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
  ...numbered("Gran Formato", 7, ["GRAN_FORMATO", "LATEX", "ECOSOLVENTE", "UV_ROLLO", "UV_RIGIDOS", "CORTES"]),
  ...numbered("DTF", 5, ["DTF", "DTF_UV", "TPU"]),
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

/** Materiales u opciones de impresión por tablero (D-095). */
export const SECTOR_VARIANTS = Object.entries(DEFAULT_SECTOR_VARIANTS).flatMap(([sector, list]) =>
  (list ?? []).map((v, i) => ({ sector: sector as SectorCode, code: v.code, name: v.name, sortOrder: i + 1 })),
);
