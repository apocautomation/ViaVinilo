import { describe, expect, it } from "vitest";
import { toVoseo } from "./voseo";

describe("el bot habla de vos (D-060)", () => {
  it("D-060: pasa a vos las formas de tú que se le escapan al modelo", () => {
    expect(toVoseo("¡Hola Juan! ¿Tienes algún pedido pendiente?")).toBe("¡Hola Juan! ¿Tenés algún pedido pendiente?");
    expect(toVoseo("Puedes mandarlo y asegúrate de que sea PNG. Te ayudo contigo")).toBe("Podés mandarlo y asegurate de que sea PNG. Te ayudo con vos");
    expect(toVoseo("¿tú tienes el archivo?")).toBe("¿vos tenés el archivo?");
  });

  it("D-060: no toca palabras parecidas ni lo que ya está de vos", () => {
    expect(toVoseo("Tus consultas las respondemos. Tenés que mandar el archivo.")).toBe("Tus consultas las respondemos. Tenés que mandar el archivo.");
    expect(toVoseo("Las tiendas abren")).toBe("Las tiendas abren");
  });
});
