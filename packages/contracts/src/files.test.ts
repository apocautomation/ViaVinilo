import { describe, expect, it } from "vitest";
import { attachmentsOf, formatBytes, isAllowedFile, safeFileName } from "./files";

describe("archivos en Conversaciones (D-062)", () => {
  it("D-062: acepta archivos de impresión y rechaza el resto", () => {
    expect(isAllowedFile("Lona front 5.10x1.10.PDF")).toBe(true);
    expect(isAllowedFile("remera.png")).toBe(true);
    expect(isAllowedFile("virus.exe")).toBe(false);
    expect(isAllowedFile("sin-extension")).toBe(false);
  });

  it("D-062: guarda el archivo con un nombre seguro y legible", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("C:\\fotos\\Diseño final (1).png")).toBe("Diseño final (1).png");
    expect(safeFileName("a<b>c?.pdf")).toBe("a_b_c_.pdf");
  });

  it("D-062: lee los adjuntos viejos (solo nombre) y los nuevos (con clave)", () => {
    expect(attachmentsOf(["a.pdf", { name: "b.png", key: "k", size: 3 }, 7, null])).toEqual([{ name: "a.pdf" }, { name: "b.png", key: "k", size: 3 }]);
    expect(formatBytes(12_400_000)).toBe("11,8 MB");
  });
});
