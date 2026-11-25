/** Número de orden visible para el cliente, por ejemplo VV-000123 (R-JOB-1). */
const PREFIX = "VV-";
const DIGITS = 6;
const PATTERN = /^VV-(\d{6,})$/;

export function formatJobNumber(n: number): string {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`Número de orden inválido: ${n}`);
  }
  return PREFIX + String(n).padStart(DIGITS, "0");
}

export function parseJobNumber(value: string): number | null {
  const match = PATTERN.exec(value.trim().toUpperCase());
  if (!match?.[1]) return null;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

/**
 * Código del trabajo en el ERP (D-109): el código de la opción de impresión adelante del número, para
 * ver de un vistazo el material ("SET-000002" es una Jersey Set). Es el mismo número que el VV-: el
 * cliente sigue viendo VV-000002 (app, bot y mails). Sin opción elegida, es el VV-.
 */
export function formatJobCode(n: number, variantCode?: string | null): string {
  return variantCode ? `${variantCode}-${formatJobNumber(n).slice(PREFIX.length)}` : formatJobNumber(n);
}

/** "SET-000002" o "set-2" → { code: "SET", number: 2 } (D-109). El VV- lo lee parseJobNumber. */
export function parseJobCode(value: string): { code: string; number: number } | null {
  const match = /^([A-Z][A-Z0-9]{1,9})-0*(\d{1,9})$/.exec(value.trim().toUpperCase());
  if (!match?.[1] || !match[2]) return null;
  const n = Number(match[2]);
  return Number.isSafeInteger(n) && n >= 1 ? { code: match[1], number: n } : null;
}
