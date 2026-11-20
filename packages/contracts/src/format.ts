/**
 * Formatos argentinos para campos de texto (D-055): se aplican mientras se escribe y al mostrar.
 * Lo que se guarda en la base sigue igual: CUIT y DNI solo dígitos, montos con punto decimal.
 */

const digits = (s: string) => s.replace(/\D/g, "");

/** CUIT con guiones mientras se escribe: "20123" → "20-123", "20123456789" → "20-12345678-9". */
export function maskCuit(input: string): string {
  const d = digits(input).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/** DNI con puntos de miles: "30111222" → "30.111.222". */
export function maskDni(input: string): string {
  return digits(input)
    .slice(0, 9)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Monto en pesos mientras se escribe: puntos de miles y coma decimal (hasta 2 decimales).
 * "18500,5" → "18.500,5"; "1234567" → "1.234.567". Una coma o un punto al final se toman como
 * el separador decimal que el usuario está por escribir.
 */
export function maskAmount(input: string): string {
  let s = input.replace(/[^\d.,]/g, "");
  // Los puntos los pone la máscara; un punto recién tipeado al final (teclado numérico) es la coma.
  if (!s.includes(",") && s.endsWith(".")) s = `${s.slice(0, -1)},`;
  const comma = s.indexOf(",");
  const intPart = digits(comma >= 0 ? s.slice(0, comma) : s).replace(/^0+(?=\d)/, "");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (comma < 0) return grouped;
  return `${grouped || "0"},${digits(s.slice(comma + 1)).slice(0, 2)}`;
}

/**
 * Convierte lo que se escribió ("18.500,50", "18500,5", "18500.50", 18500.5) al formato de la base
 * ("18500.50"). Devuelve null si no es un monto.
 */
export function parseAmount(input: string | number): string | null {
  if (typeof input === "number") return Number.isFinite(input) ? input.toFixed(2) : null;
  const s = input.trim().replace(/\s|\$/g, "");
  if (!s) return null;
  let normalized: string;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) normalized = s.replace(/\./g, "");
  else normalized = s;
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(normalized)) return null;
  return Number(normalized).toFixed(2);
}
