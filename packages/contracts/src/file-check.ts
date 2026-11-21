/**
 * Control automático del archivo (D-047, D-065). Sin IA: se leen los píxeles del archivo y se
 * comparan con la medida que pidió el cliente. Lo que importa es la resolución efectiva (píxeles por
 * pulgada al tamaño de impresión), no el "dpi" que dice el archivo.
 */

export interface ImageInfo {
  format: "png" | "jpeg";
  width: number;
  height: number;
  /** Solo PNG: tiene canal de transparencia. */
  hasAlpha?: boolean;
}

/** Lee ancho y alto de un PNG o JPG desde sus primeros bytes. Devuelve null si no es una imagen legible. */
export function readImageInfo(bytes: Uint8Array): ImageInfo | null {
  const u32 = (o: number) => ((bytes[o]! << 24) | (bytes[o + 1]! << 16) | (bytes[o + 2]! << 8) | bytes[o + 3]!) >>> 0;
  const u16 = (o: number) => (bytes[o]! << 8) | bytes[o + 1]!;
  // PNG: firma de 8 bytes y después el bloque IHDR con ancho, alto y tipo de color.
  if (bytes.length >= 26 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const colorType = bytes[25]!;
    return { format: "png", width: u32(16), height: u32(20), hasAlpha: colorType === 4 || colorType === 6 };
  }
  // JPG: se recorren los bloques hasta el de tamaño (SOF).
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let o = 2;
    while (o + 9 < bytes.length) {
      if (bytes[o] !== 0xff) return null;
      const marker = bytes[o + 1]!;
      if (marker === 0xff) {
        o++;
        continue;
      }
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { format: "jpeg", height: u16(o + 5), width: u16(o + 7) };
      o += 2 + u16(o + 2);
    }
  }
  return null;
}

/** Resolución mínima por tablero (D-047): 250 dpi en DTF y DTF UV; 100 en el resto. */
export function minDpiFor(sectorCode: string): number {
  return sectorCode === "DTF" || sectorCode === "DTF_UV" ? 250 : 100;
}

/**
 * Qué tan por debajo del mínimo hace falta estar para que el pedido pase solo a "Archivo con error".
 * Entre este límite y el mínimo, solo se sugiere y confirma el operador.
 * TODO(spec): I-24 — confirmar el límite con Ezequiel y Verónica.
 */
export const AUTO_ERROR_FRACTION = 0.5;

export interface FileCheck {
  /** ok: cumple · review: dudoso, lo mira el operador · error: claramente mal · unknown: no se pudo controlar */
  verdict: "ok" | "review" | "error" | "unknown";
  /** Código de FileErrorReason cuando hay un problema. */
  reasonCode?: "LOW_RESOLUTION";
  /** Explicación para el operador y para el cliente. */
  detail: string;
  effectiveDpi?: number;
  file?: string;
}

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

export function checkFile(input: {
  sectorCode: string;
  sectorName: string;
  filename: string;
  image: ImageInfo | null;
  /** Medidas que escribió el cliente, en centímetros. Solo se controla si hay exactamente una. */
  measures: { widthCm?: number; heightCm?: number }[];
}): FileCheck {
  const { image, filename } = input;
  if (!image) return { verdict: "unknown", detail: "No es un PNG o JPG: no se puede controlar la resolución.", file: filename };
  const pairs = input.measures.filter((m) => m.widthCm && m.heightCm);
  if (pairs.length !== 1) {
    return {
      verdict: "unknown",
      detail: pairs.length === 0 ? "El cliente no escribió la medida con unidad (cm o m): no se puede controlar la resolución." : "El cliente escribió varias medidas: no se sabe cuál corresponde al archivo.",
      file: filename,
    };
  }
  const { widthCm, heightCm } = pairs[0] as { widthCm: number; heightCm: number };
  const dpi = (px: number, cm: number) => px / (cm / 2.54);
  // El archivo puede venir girado: se toma la orientación que mejor da.
  const straight = Math.min(dpi(image.width, widthCm), dpi(image.height, heightCm));
  const rotated = Math.min(dpi(image.width, heightCm), dpi(image.height, widthCm));
  const effective = Math.round(Math.max(straight, rotated));
  const min = minDpiFor(input.sectorCode);
  const facts = `El archivo tiene ${image.width} × ${image.height} píxeles. Para ${fmt(widthCm)} × ${fmt(heightCm)} cm da ${effective} dpi; el mínimo para ${input.sectorName} es ${min}.`;
  if (effective < min * AUTO_ERROR_FRACTION) {
    return { verdict: "error", reasonCode: "LOW_RESOLUTION", detail: `${facts} Va a salir pixelado.`, effectiveDpi: effective, file: filename };
  }
  if (effective < min) {
    return { verdict: "review", reasonCode: "LOW_RESOLUTION", detail: `${facts} Puede salir pixelado: revisalo.`, effectiveDpi: effective, file: filename };
  }
  return { verdict: "ok", detail: `${image.width} × ${image.height} píxeles: ${effective} dpi para ${fmt(widthCm)} × ${fmt(heightCm)} cm.`, effectiveDpi: effective, file: filename };
}
