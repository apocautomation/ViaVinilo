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

  it("D-101: pone la tilde al voseo que el modelo escribe sin tilde, y pasa el usted del asesor a vos", () => {
    expect(toVoseo("Podes retirarlo de lunes a viernes. Si queres, tenes el alias.")).toBe("Podés retirarlo de lunes a viernes. Si querés, tenés el alias.");
    expect(toVoseo("Un asesor del equipo le responde por este mismo chat.")).toBe("Un asesor del equipo te responde por este mismo chat.");
    expect(toVoseo("Si querés, le avisamos.")).toBe("Si querés, te avisamos.");
    // No toca palabras que son otra cosa.
    expect(toVoseo("Estas son las sucursales. Las pagas del mes.")).toBe("Estas son las sucursales. Las pagas del mes.");
    expect(toVoseo("A Juan le responde Ana.")).toBe("A Juan le responde Ana.");
  });
});
