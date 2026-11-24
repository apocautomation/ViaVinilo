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

/**
 * Fecha y hora escritas a mano en el ERP, siempre como día/mes/año y en 24 h (D-079): el selector del
 * navegador las mostraba como mes/día y AM/PM según el idioma de la PC. Devuelve el instante con la
 * hora de Salta (UTC-3), o null si no es una fecha real. Sin hora, se toma el cierre del día (18:00).
 */
export function parseSaltaDateTime(date: string, time = ""): string | null {
  const d = /^\s*(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?\s*$/.exec(date);
  if (!d) return null;
  const t = time.trim() ? /^\s*(\d{1,2})(?::|\.|h)?(\d{2})?\s*$/.exec(time) : ["", "18", "00"];
  if (!t) return null;
  const day = Number(d[1]);
  const month = Number(d[2]);
  // Sin año: el año en curso en Salta.
  const year = d[3] ? (d[3].length === 2 ? 2000 + Number(d[3]) : Number(d[3])) : new Date(Date.now() - 3 * 3600_000).getUTCFullYear();
  const hour = Number(t[1]);
  const minute = Number(t[2] ?? "0");
  if (hour > 23 || minute > 59) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${year}-${p(month)}-${p(day)}T${p(hour)}:${p(minute)}:00-03:00`;
}
