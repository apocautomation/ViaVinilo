/**
 * Tokens de color compartidos por el backoffice (apps/web) y la app de clientes (apps/pwa).
 * Escalas generadas desde los colores del logo (D-019, D-021). Para regenerar:
 * `node packages/ui/scripts/generate-palette.mjs`.
 */
import { palette } from "./palette";

export { palette, SOURCE_COLORS } from "./palette";

/** Colores exactos del logo. Para marca, isotipo y piezas gráficas; no para texto sobre blanco. */
export const logo = {
  cyan: "#00AEEF",
  navy: "#090F38",
} as const;

/** Colores semánticos. Los nombres siguen `color/<rol>`. Cada par texto/fondo pasa WCAG AA (ver tokens.test.ts). */
export const semantic = {
  background: palette.neutral[50],
  surface: "#FFFFFF",
  surfaceSubtle: palette.brand[50],
  border: palette.neutral[200],
  text: palette.neutral[900],
  textMuted: palette.neutral[600],

  /** Botones y acciones principales, con texto blanco. */
  primary: palette.brand[600],
  primaryHover: palette.brand[700],
  onPrimary: "#FFFFFF",
  /** Links y texto destacado sobre fondo claro. */
  link: palette.brand[700],

  /** Barra lateral y encabezado del ERP, con el marino del isotipo. */
  chrome: logo.navy,
  onChrome: "#FFFFFF",
  chromeMuted: palette.navy[300],

  accent: palette.accent[600],
  onAccent: "#FFFFFF",

  success: palette.success[700],
  successBg: palette.success[100],
  warning: palette.warning[700],
  warningBg: palette.warning[100],
  danger: palette.danger[600],
  dangerBg: palette.danger[100],
} as const;

/** Pares de texto sobre fondo que la UI usa; el test exige contraste AA (4,5:1). */
export const CONTRAST_PAIRS: { name: string; fg: string; bg: string }[] = [
  { name: "texto sobre fondo", fg: semantic.text, bg: semantic.background },
  { name: "texto secundario sobre fondo", fg: semantic.textMuted, bg: semantic.background },
  { name: "texto secundario sobre superficie", fg: semantic.textMuted, bg: semantic.surface },
  { name: "botón principal", fg: semantic.onPrimary, bg: semantic.primary },
  { name: "botón principal hover", fg: semantic.onPrimary, bg: semantic.primaryHover },
  { name: "link sobre superficie", fg: semantic.link, bg: semantic.surface },
  { name: "link sobre superficie sutil", fg: semantic.link, bg: semantic.surfaceSubtle },
  { name: "texto en barra del ERP", fg: semantic.onChrome, bg: semantic.chrome },
  { name: "texto secundario en barra del ERP", fg: semantic.chromeMuted, bg: semantic.chrome },
  { name: "acento", fg: semantic.onAccent, bg: semantic.accent },
  { name: "éxito", fg: semantic.success, bg: semantic.successBg },
  { name: "aviso", fg: semantic.warning, bg: semantic.warningBg },
  { name: "error", fg: semantic.danger, bg: semantic.dangerBg },
  { name: "error sobre superficie", fg: semantic.danger, bg: semantic.surface },
];

/** Variables CSS para inyectar en el layout raíz de cada app. */
export function cssVariables(): string {
  const lines: string[] = [];
  for (const [color, scale] of Object.entries(palette)) {
    for (const [stop, hex] of Object.entries(scale)) lines.push(`--color-${color}-${stop}: ${hex};`);
  }
  for (const [k, v] of Object.entries(logo)) lines.push(`--color-logo-${k}: ${v};`);
  for (const [k, v] of Object.entries(semantic)) {
    lines.push(`--color-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${v};`);
  }
  return `:root{${lines.join("")}}`;
}
