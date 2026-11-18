import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("contraseñas del personal", () => {
  it("el hash no guarda la contraseña y la verifica", async () => {
    const hash = await hashPassword("una-clave-larga-1");
    expect(hash).not.toContain("una-clave-larga-1");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("una-clave-larga-1", hash)).toBe(true);
    expect(await verifyPassword("otra-clave-larga-1", hash)).toBe(false);
  });

  it("dos hashes de la misma contraseña son distintos (salt aleatorio)", async () => {
    expect(await hashPassword("misma-clave-123")).not.toBe(await hashPassword("misma-clave-123"));
  });

  it("un hash con formato inválido no verifica", async () => {
    expect(await verifyPassword("x", "texto-plano")).toBe(false);
  });
});
