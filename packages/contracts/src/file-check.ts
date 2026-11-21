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

/**
 * Tamaño real de la primera página de un PDF, en centímetros (D-071). Lo lee del texto del archivo
 * (`/MediaBox [0 0 ancho alto]`, en puntos de 1/72 de pulgada). Devuelve null si el PDF lo guarda
 * comprimido y no se puede leer así.
 */
export function readPdfPageSize(bytes: Uint8Array): { widthCm: number; heightCm: number } | null {
  if (bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) return null; // "%PDF"
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const m = /\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/.exec(text);
  if (!m) return null;
  const [x0, y0, x1, y1] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  const toCm = (pt: number) => Math.round((Math.abs(pt) / 72) * 2.54 * 10) / 10;
  const widthCm = toCm(x1 - x0);
  const heightCm = toCm(y1 - y0);
  return widthCm > 0 && heightCm > 0 && Number.isFinite(widthCm + heightCm) ? { widthCm, heightCm } : null;
}

/** Cuánto puede diferir el tamaño de un PDF de la medida pedida para darlo por bueno. */
const PDF_TOLERANCE = 0.03;

export interface FileCheck {
  /** ok: cumple · review: dudoso, lo mira el operador · error: claramente mal · unknown: no se pudo controlar */
  verdict: "ok" | "review" | "error" | "unknown";
  /** Código de FileErrorReason cuando hay un problema. */
  reasonCode?: "LOW_RESOLUTION";
  /** Explicación para el operador y para el cliente. */
  detail: string;
  effectiveDpi?: number;
  file?: string;
  /** Dato del archivo que le sirve al operador aunque no se haya podido decidir (D-071). */
  hint?: string;
}

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

export function checkFile(input: {
  sectorCode: string;
  sectorName: string;
  filename: string;
  image: ImageInfo | null;
  /** Tamaño de la página, si el archivo es un PDF (D-071). */
  pdf?: { widthCm: number; heightCm: number } | null;
  /**
   * Medidas que escribió el cliente, en centímetros. Solo se controla si hay exactamente una.
   * `assumed`: el cliente no puso la unidad y se supuso ("58x30" → cm). Con una medida supuesta
   * nunca se da el archivo por malo: como mucho se pide revisarlo.
   */
  measures: { widthCm?: number; heightCm?: number; assumed?: boolean }[];
}): FileCheck {
  const { image, filename } = input;
  const pairs = input.measures.filter((m) => m.widthCm && m.heightCm);
  const min = minDpiFor(input.sectorCode);

  if (!image && input.pdf) {
    const size = `${fmt(input.pdf.widthCm)} × ${fmt(input.pdf.heightCm)} cm`;
    const hint = `El PDF mide ${size}.`;
    if (pairs.length !== 1) {
      return { verdict: "unknown", detail: `${hint} ${pairs.length === 0 ? "El cliente no escribió la medida" : "El cliente escribió varias medidas"}: comparalo con lo que pidió.`, hint, file: filename };
    }
    const want = pairs[0] as { widthCm: number; heightCm: number; assumed?: boolean };
    const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(a, b) * PDF_TOLERANCE;
    const matches =
      (near(input.pdf.widthCm, want.widthCm) && near(input.pdf.heightCm, want.heightCm)) || (near(input.pdf.widthCm, want.heightCm) && near(input.pdf.heightCm, want.widthCm));
    const asked = `${fmt(want.widthCm)} × ${fmt(want.heightCm)} cm${want.assumed ? " (el cliente no puso la unidad: se tomó así)" : ""}`;
    return matches
      ? { verdict: "ok", detail: `El PDF mide ${size}, lo pedido.`, hint, file: filename }
      : { verdict: "review", detail: `El PDF mide ${size} y el pedido dice ${asked}. Revisá que sea la medida correcta.`, hint, file: filename };
  }
  if (!image) return { verdict: "unknown", detail: "No es un PNG, JPG ni un PDF legible: no se puede controlar solo.", file: filename };

  // Hasta qué tamaño se puede imprimir bien este archivo: sirve aunque no se sepa la medida pedida.
  const cmAt = (px: number) => (px / min) * 2.54;
  const hint = `Tiene ${image.width} × ${image.height} píxeles: alcanza para imprimir hasta ${fmt(Math.round(cmAt(image.width)))} × ${fmt(Math.round(cmAt(image.height)))} cm a ${min} dpi.`;
  if (pairs.length !== 1) {
    return {
      verdict: "unknown",
      detail: `${pairs.length === 0 ? "El cliente no escribió la medida" : "El cliente escribió varias medidas y no se sabe cuál corresponde al archivo"}. ${hint}`,
      hint,
      file: filename,
    };
  }
  const { widthCm, heightCm, assumed } = pairs[0] as { widthCm: number; heightCm: number; assumed?: boolean };
  const dpi = (px: number, cm: number) => px / (cm / 2.54);
  // El archivo puede venir girado: se toma la orientación que mejor da.
  const straight = Math.min(dpi(image.width, widthCm), dpi(image.height, heightCm));
  const rotated = Math.min(dpi(image.width, heightCm), dpi(image.height, widthCm));
  const effective = Math.round(Math.max(straight, rotated));
  const guess = assumed ? " El cliente no puso la unidad: se tomó la medida en centímetros o metros según el número." : "";
  const facts = `El archivo tiene ${image.width} × ${image.height} píxeles. Para ${fmt(widthCm)} × ${fmt(heightCm)} cm da ${effective} dpi; el mínimo para ${input.sectorName} es ${min}.${guess}`;
  // Con la medida supuesta no se da por malo: lo mira el operador.
  if (effective < min * AUTO_ERROR_FRACTION && !assumed) {
    return { verdict: "error", reasonCode: "LOW_RESOLUTION", detail: `${facts} Va a salir pixelado.`, effectiveDpi: effective, file: filename };
  }
  if (effective < min) {
    return { verdict: "review", reasonCode: "LOW_RESOLUTION", detail: `${facts} Puede salir pixelado: revisalo.`, effectiveDpi: effective, file: filename };
  }
  return { verdict: "ok", detail: `${image.width} × ${image.height} píxeles: ${effective} dpi para ${fmt(widthCm)} × ${fmt(heightCm)} cm.${guess}`, effectiveDpi: effective, file: filename };
}
