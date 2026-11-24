import { describe, expect, it } from "vitest";
import { appUploadSchema } from "./files";
import { defaultPickupBranch, detectPickupBranch } from "./pickup";

describe("sucursal de retiro (D-083)", () => {
  it("D-083: lee del mail dónde quiere retirar el cliente", () => {
    expect(detectPickupBranch("Hola, 58 x 100 cm. Retiro en la San Juan, gracias")).toBe("san-juan");
    expect(detectPickupBranch("lo paso a buscar por la Chile mañana")).toBe("chile");
    expect(detectPickupBranch("RETIRO EN SUCURSAL CENTRO")).toBe("san-juan");
    expect(detectPickupBranch("Retiramos en Av. Chile")).toBe("chile");
  });

  it("D-083: la dirección de una firma no alcanza, y si nombra las dos sucursales no se adivina", () => {
    expect(detectPickupBranch("Saludos. Via Vinilo, Av. Chile 1822, Salta")).toBeNull();
    expect(detectPickupBranch("58 x 100 cm, 2 copias")).toBeNull();
    expect(detectPickupBranch("Retiro en la San Juan o si no retiro en la Chile")).toBeNull();
  });

  it("D-083: sin elección, cada servicio se retira donde se produce", () => {
    expect(defaultPickupBranch("DTF")).toBe("san-juan");
    expect(defaultPickupBranch("TPU")).toBe("san-juan");
    expect(defaultPickupBranch("LATEX")).toBe("chile");
    expect(defaultPickupBranch("SUBLIMACION")).toBe("chile");
  });

  it("D-083: la app manda la sucursal elegida; una app vieja que no la manda sigue andando", () => {
    expect(appUploadSchema.parse({ sector: "DTF", pickupBranch: "chile" }).pickupBranch).toBe("chile");
    expect(appUploadSchema.parse({ sector: "DTF" }).pickupBranch).toBeUndefined();
    expect(appUploadSchema.safeParse({ sector: "DTF", pickupBranch: "tucuman" }).success).toBe(false);
  });
});
