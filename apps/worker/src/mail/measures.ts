/**
 * Extrae las medidas que el cliente escribe en el cuerpo del mail (texto libre, SPEC E1.1).
 * No interpreta todo: guarda lo que encuentra para que el operador (y más adelante la revisión
 * automática, I-09) lo compare con el archivo.
 */
export interface DeclaredMeasure {
  raw: string;
  /** Ancho y alto en centímetros, si se pudo deducir la unidad. */
  widthCm?: number;
  heightCm?: number;
  /** Largo suelto ("3 metros"), en centímetros. */
  lengthCm?: number;
}

const UNIT = String.raw`(cm|mm|mts?|metros?|m)\b`;
const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const PAIR = new RegExp(String.raw`${NUM}\s*(?:${UNIT})?\s*[x×X*]\s*${NUM}\s*(?:${UNIT})?`, "gi");
const SINGLE = new RegExp(String.raw`${NUM}\s*${UNIT}`, "gi");

function toCm(value: string, unit: string | undefined): number | undefined {
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n) || !unit) return undefined;
  const u = unit.toLowerCase();
  if (u === "cm") return round(n);
  if (u === "mm") return round(n / 10);
  return round(n * 100); // m, mt, mts, metro, metros
}

const round = (n: number) => Math.round(n * 100) / 100;

export function extractMeasures(text: string): DeclaredMeasure[] {
  const found: DeclaredMeasure[] = [];
  const used: [number, number][] = [];

  for (const m of text.matchAll(PAIR)) {
    const [raw, a, unitA, b, unitB] = m;
    // Si solo una de las dos medidas tiene unidad, se asume la misma para ambas ("1,20 x 0,80 m").
    const unit = unitA ?? unitB;
    found.push({ raw: raw.trim(), widthCm: toCm(a!, unitA ?? unit), heightCm: toCm(b!, unitB ?? unit) });
    used.push([m.index!, m.index! + raw.length]);
  }

  for (const m of text.matchAll(SINGLE)) {
    const start = m.index!;
    if (used.some(([s, e]) => start >= s && start < e)) continue;
    found.push({ raw: m[0].trim(), lengthCm: toCm(m[1]!, m[2]) });
  }

  // La misma medida repetida en el asunto y en el cuerpo se guarda una sola vez.
  const seen = new Set<string>();
  return found.filter((m) => {
    const key =
      m.widthCm !== undefined || m.heightCm !== undefined || m.lengthCm !== undefined
        ? `${m.widthCm}|${m.heightCm}|${m.lengthCm}`
        : m.raw.toLowerCase().replace(/\s+/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
