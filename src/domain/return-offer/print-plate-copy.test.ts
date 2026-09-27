import { describe, expect, it } from "vitest";
import { buildPrintPlateCopy } from "./print-plate-copy";

describe("buildPrintPlateCopy", () => {
  it("com o Retorno ativo, a placa promete o brinde de verdade", () => {
    expect(buildPrintPlateCopy({ returnActive: true, offerTitle: "Hidratação grátis", destinationLabel: "Avaliar no Google" })).toEqual({
      headline: "Toque e ganhe",
      subheadline: "Hidratação grátis",
    });
  });

  it("sem o Retorno, a placa mostra o destino real do cartão, nunca 'avalie sua experiência' fixo", () => {
    expect(buildPrintPlateCopy({ returnActive: false, offerTitle: null, destinationLabel: "Ver no Instagram" })).toEqual({
      headline: "Toque aqui",
      subheadline: "Ver no Instagram",
    });
    expect(buildPrintPlateCopy({ returnActive: false, offerTitle: null, destinationLabel: "Avaliar no Google" }).subheadline).toBe(
      "Avaliar no Google"
    );
  });

  it("Retorno marcado como ativo mas sem título (dado inconsistente) cai no destino real, nunca um brinde vazio", () => {
    expect(buildPrintPlateCopy({ returnActive: true, offerTitle: null, destinationLabel: "Falar no WhatsApp" })).toEqual({
      headline: "Toque aqui",
      subheadline: "Falar no WhatsApp",
    });
  });
});
