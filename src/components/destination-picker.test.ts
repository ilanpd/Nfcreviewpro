import { describe, expect, it } from "vitest";
import { detectPreset } from "./destination-picker";

/**
 * Auditoria de 28/09/2026 — `meu-cartao-form.tsx` passou a reaproveitar
 * `DestinationPicker` pra EDITAR um destino já existente (antes, um campo de
 * URL crua). Sem `detectPreset`, todo link existente cairia em "Outro link"
 * — a mesma fricção que este componente existe pra eliminar no checkout.
 */
describe("detectPreset", () => {
  it("string vazia cai em 'other' sem handle", () => {
    expect(detectPreset("")).toEqual({ preset: "other", handle: "" });
  });

  it("URL inválida cai em 'other' sem quebrar", () => {
    expect(detectPreset("não é uma url")).toEqual({ preset: "other", handle: "" });
  });

  it.each([
    ["https://instagram.com/bella.vista", "bella.vista"],
    ["https://www.instagram.com/bella.vista/", "bella.vista"],
  ])("detecta Instagram e extrai o handle de %s", (url, handle) => {
    expect(detectPreset(url)).toEqual({ preset: "instagram", handle });
  });

  it("detecta WhatsApp e extrai os dígitos", () => {
    expect(detectPreset("https://wa.me/5511987654321")).toEqual({ preset: "whatsapp", handle: "5511987654321" });
  });

  it.each(["https://g.page/r/bella-vista/review", "https://search.google.com/local/writereview?placeid=x"])(
    "detecta Google sem tentar extrair handle (continua colar o link)",
    (url) => {
      expect(detectPreset(url)).toEqual({ preset: "google", handle: "" });
    }
  );

  it("um link qualquer (cardápio, site próprio) cai em 'other'", () => {
    expect(detectPreset("https://meucardapio.com.br")).toEqual({ preset: "other", handle: "" });
  });
});
