import type { MetadataRoute } from "next";
import { semantic } from "@viavinilo/ui";

// Ícono de la app: la mascota del logo (D-022).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Via Vinilo",
    short_name: "Via Vinilo",
    description: "Seguí tus trabajos de impresión de Via Vinilo.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: semantic.background,
    theme_color: semantic.primary,
    lang: "es-AR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
