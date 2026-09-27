import { describe, expect, it } from "vitest";
import { decideCardExperience, pickPrimaryUrl } from "./experience";

describe("decideCardExperience", () => {
  it("sem Retorno, tudo como antes", () => {
    expect(decideCardExperience({ outcome: "CAMPAIGN", campaignOrigin: "USER", returnAvailable: false })).toEqual({ kind: "CAMPAIGN" });
    expect(decideCardExperience({ outcome: "CAMPAIGN", campaignOrigin: "SYSTEM_DIRECT", returnAvailable: false })).toEqual({ kind: "CAMPAIGN" });
    expect(decideCardExperience({ outcome: "REVIEW_FLOW_FALLBACK", campaignOrigin: null, returnAvailable: false })).toEqual({ kind: "REVIEW_FALLBACK" });
  });

  it("com Retorno e nenhuma campanha: mostra o Retorno", () => {
    expect(decideCardExperience({ outcome: "REVIEW_FLOW_FALLBACK", campaignOrigin: null, returnAvailable: true })).toEqual({ kind: "RETURN" });
  });

  it("com Retorno e o redirecionamento inicial do avulso: o Retorno assume no lugar (conversão ao assinar)", () => {
    expect(decideCardExperience({ outcome: "CAMPAIGN", campaignOrigin: "SYSTEM_DIRECT", returnAvailable: true })).toEqual({ kind: "RETURN" });
  });

  it("uma campanha do próprio dono sempre vence o Retorno", () => {
    expect(decideCardExperience({ outcome: "CAMPAIGN", campaignOrigin: "USER", returnAvailable: true })).toEqual({ kind: "CAMPAIGN" });
  });

  it("origem desconhecida (cache do formato antigo) é tratada como campanha do dono: nunca atropela", () => {
    expect(decideCardExperience({ outcome: "CAMPAIGN", campaignOrigin: null, returnAvailable: true })).toEqual({ kind: "CAMPAIGN" });
  });

  it("uma campanha do sistema do Retorno leva à tela do Retorno", () => {
    expect(decideCardExperience({ outcome: "CAMPAIGN", campaignOrigin: "SYSTEM_RETURN", returnAvailable: true })).toEqual({ kind: "RETURN" });
  });
});

describe("pickPrimaryUrl", () => {
  const google = "https://g.page/r/abc";
  it("a escolha do dono no painel vence", () => {
    expect(pickPrimaryUrl({ offerPrimaryUrl: "https://instagram.com/loja", directCampaignUrl: "https://wa.me/55", googleReviewUrl: google })).toBe(
      "https://instagram.com/loja"
    );
  });
  it("sem escolha no painel, vale o destino da compra do cartão", () => {
    expect(pickPrimaryUrl({ offerPrimaryUrl: null, directCampaignUrl: "https://wa.me/55", googleReviewUrl: google })).toBe("https://wa.me/55");
  });
  it("sem nenhum dos dois, o link de avaliação do Google da empresa", () => {
    expect(pickPrimaryUrl({ offerPrimaryUrl: null, directCampaignUrl: null, googleReviewUrl: google })).toBe(google);
    expect(pickPrimaryUrl({ offerPrimaryUrl: "", directCampaignUrl: "", googleReviewUrl: google })).toBe(google);
  });
});
