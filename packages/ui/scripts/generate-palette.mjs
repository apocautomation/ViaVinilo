// Genera src/palette.ts a partir de los colores del logo de Via Vinilo (D-019, D-021).
// Uso: node packages/ui/scripts/generate-palette.mjs
//
// Escala estilo Tailwind (50–950) en OKLCH: se conserva el matiz de cada color fuente,
// la luminosidad sigue una escala fija y la saturación baja hacia los extremos para que
// los tonos claros sirvan como fondo. Si un tono queda fuera de sRGB, se reduce la
// saturación hasta que entre (gamut mapping por croma).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Colores fuente. brand y navy salen del logo (vectores del PDF); el resto es de soporte. */
const SOURCES = {
  brand: "#00AEEF", // cian del logotipo
  navy: "#090F38", // azul marino del isotipo
  neutral: "#64748B", // gris frío, se desatura más abajo
  accent: "#EC008C", // magenta de las gotas de tinta de la mascota
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#DC2626",
};

/** Saturación relativa por color (1 = la del color fuente). */
const CHROMA_FACTOR = { neutral: 0.35 };

const STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const LIGHTNESS = { 50: 0.975, 100: 0.94, 200: 0.885, 300: 0.81, 400: 0.72, 500: 0.63, 600: 0.54, 700: 0.46, 800: 0.39, 900: 0.31, 950: 0.23 };
const TAPER = { 50: 0.12, 100: 0.25, 200: 0.45, 300: 0.7, 400: 0.92, 500: 1, 600: 1, 700: 0.92, 800: 0.82, 900: 0.7, 950: 0.6 };

// ── Conversión sRGB ↔ OKLab (Björn Ottosson) ──
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

function rgbToOklch([r, g, b]) {
  [r, g, b] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), H: Math.atan2(B, A) };
}

function oklchToLinearRgb({ L, C, H }) {
  const A = C * Math.cos(H);
  const B = C * Math.sin(H);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

function oklchToHex(lch) {
  let { C } = lch;
  let rgb = oklchToLinearRgb({ ...lch, C });
  while (!inGamut(rgb) && C > 0) {
    C = Math.max(0, C - 0.002);
    rgb = oklchToLinearRgb({ ...lch, C });
  }
  return (
    "#" +
    rgb
      .map((c) => Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, c))))) * 255))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

const palette = {};
for (const [name, hex] of Object.entries(SOURCES)) {
  const src = rgbToOklch(hexToRgb(hex));
  const factor = CHROMA_FACTOR[name] ?? 1;
  palette[name] = {};
  for (const stop of STOPS) {
    palette[name][stop] = oklchToHex({ L: LIGHTNESS[stop], C: src.C * factor * TAPER[stop], H: src.H });
  }
}

const header = `// ARCHIVO GENERADO por packages/ui/scripts/generate-palette.mjs — no editar a mano.
// Fuente: colores del logo de Via Vinilo (D-019, D-021 en docs/DESARROLLO.md).
`;
const body =
  `export const SOURCE_COLORS = ${JSON.stringify(SOURCES, null, 2)} as const;\n\n` +
  `export const palette = ${JSON.stringify(palette, null, 2)} as const;\n`;

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "palette.ts");
writeFileSync(out, header + "\n" + body.replace(/"(\d+)":/g, "$1:"));
console.log(`Escrito ${out}`);
for (const [name, scale] of Object.entries(palette)) {
  console.log(name.padEnd(8), Object.entries(scale).map(([k, v]) => `${k}:${v}`).join(" "));
}
