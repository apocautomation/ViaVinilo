import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cssVariables } from "@viavinilo/ui";

export const metadata: Metadata = {
  title: "Via Vinilo · Gestión",
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
