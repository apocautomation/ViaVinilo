import { describe, expect, it } from "vitest";
import { dropNoticePromises, fixMailboxes } from "./guard";

describe("controles sobre la respuesta del bot (D-060)", () => {
  it("D-060: corrige casillas mal escritas por el modelo", () => {
    expect(fixMailboxes("Mandalo a látex@viavinilo.com")).toBe("Mandalo a latex@viavinilo.com");
    expect(fixMailboxes("Escribí a GRANFORMATO@viavinilo.com")).toBe("Escribí a granformato@viavinilo.com");
  });

  it("D-060: con los avisos apagados no promete avisar", () => {
    expect(dropNoticePromises("Entre 24 y 48 horas hábiles. Te avisamos por la app cuando está listo.")).toBe("Entre 24 y 48 horas hábiles.");
    expect(dropNoticePromises("Te avisamos.")).toBe("Te avisamos.");
  });
});
