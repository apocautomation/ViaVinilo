import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cssVariables, semantic } from "@viavinilo/ui";

export const metadata: Metadata = {
  title: "Via Vinilo",
  description: "Seguí tus trabajos de impresión de Via Vinilo.",
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: semantic.primary,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR">
      <head>
        <style>{cssVariables()}</style>
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "var(--color-background)",
          color: "var(--color-text)",
        }}
      >
        {children}
      </body>
    </html>
  );
}
