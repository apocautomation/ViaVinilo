import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// SWC emite los metadatos de los decoradores que necesita la inyección de dependencias de NestJS.
export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    include: ["src/**/*.test.ts", "prisma/**/*.test.ts", "test/**/*.test.ts"],
    // Los tests de punta a punta comparten un Postgres en memoria por archivo.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
