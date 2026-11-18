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
