import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES } from "@viavinilo/contracts";
import { fileSizeError, progressPercent, sectorCodeFor } from "./upload";

describe("subida de archivos de la app (D-062, D-087)", () => {
  const extra = [{ code: "TPU", name: "TPU" }];

  it("un servicio de la Ayuda entra en su tablero", () => {
    expect(sectorCodeFor("dtf-textil", extra)).toBe("DTF");
  });

  it("D-064: un tablero creado desde el ERP entra con su código", () => {
    expect(sectorCodeFor("sector:TPU", extra)).toBe("TPU");
  });

  it("sin servicio elegido no hay tablero", () => {
    expect(sectorCodeFor(null, extra)).toBeUndefined();
    expect(sectorCodeFor("sector:NO_EXISTE", extra)).toBeUndefined();
  });

  it("un archivo de más de 150 MB no se sube", () => {
    expect(fileSizeError({ size: MAX_UPLOAD_BYTES + 1 })).toBe("El archivo es muy grande: el máximo es 150 MB.");
    expect(fileSizeError({ size: MAX_UPLOAD_BYTES })).toBeNull();
  });

  it("el avance se muestra en porcentaje entero", () => {
    expect(progressPercent(0.333)).toBe(33);
    expect(progressPercent(1)).toBe(100);
  });
});
