import { MAX_UPLOAD_BYTES, type SectorRef } from "@viavinilo/contracts";
import { SECTOR_OF } from "./services";

/**
 * Tablero donde entra un trabajo según el servicio elegido: los servicios de la Ayuda tienen su
 * tablero fijo (D-062) y los tableros creados desde el ERP se eligen como `sector:CODIGO` (D-064).
 */
export function sectorCodeFor(serviceId: string | null, extra: readonly SectorRef[]): string | undefined {
  if (!serviceId) return undefined;
  return extra.find((x) => `sector:${x.code}` === serviceId)?.code ?? SECTOR_OF[serviceId];
}

/** El aviso si el archivo supera el máximo de la API (150 MB), o null si se puede subir. */
export function fileSizeError(file: { size: number }): string | null {
  return file.size > MAX_UPLOAD_BYTES ? "El archivo es muy grande: el máximo es 150 MB." : null;
}

export const progressPercent = (fraction: number) => Math.round(fraction * 100);
