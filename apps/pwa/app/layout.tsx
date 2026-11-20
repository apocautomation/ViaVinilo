import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { cssVariables, semantic } from "@viavinilo/ui";
import "./globals.css";
import { InstallBanner } from "./install";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Via Vinilo",
  description: "Seguí tus trabajos de impresión de Via Vinilo.",
  // D-058: la mascota en la pestaña (el ícono explícito anula el app/icon de Next).
  icons: { icon: [{ url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" }], apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: semantic.primary,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR" className={inter.variable}>
      <head>
        <style>{cssVariables()}</style>
      </head>
      <body>
        {children}
        <InstallBanner />
      </body>
    </html>
  );
}
