import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cssVariables } from "@viavinilo/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "Via Vinilo · Gestión",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR">
      <head>
        <style>{cssVariables()}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
