import { describe, expect, it } from "vitest";
import { decideCardExperience, pickPrimaryUrl, primaryButtonLabel } from "./experience";
import type { OfferAvailability, OfferUnavailableReason } from "./availability";

const on: OfferAvailability = { available: true };
const off = (reason: OfferUnavailableReason): OfferAvailability => ({ available: false, reason });

describe("decideCardExperience: campanha do dono", () => {
  it("uma campanha do próprio dono sempre vence, com o Retorno de pé ou não", () => {
    for (const availability of [on, off("PAUSED"), off("PLAN_NOT_ALLOWED"), off("KILL_SWITCH")]) {
      expect(decideCardExperience({ outcome: "CAMPAIGN", campaignOrigin: "USER", availability })).toEqual({ kind: "CAMPAIGN" });
    }
  });

  it("origem desconhecida (cache do formato antigo) é tratada como campanha do dono: nunca atropela", () => {
    expect(decideCardExperience({ outcome: "CAMPAIGN", campaignOrigin: null, availability: on })).toEqual({ kind: "CAMPAIGN" });
  });
});

describe("decideCardExperience: com o Retorno de pé", () => {
  it("sem campanha: tela do Retorno", () => {
    expect(decideCardExperience({ outcome: "REVIEW_FLOW_FALLBACK", campaignOrigin: null, availability: on })).toEqual({ kind: "RETURN" });
  });
  it("com o redirecionamento inicial do avulso: o Retorno assume no lugar (conversão ao assinar)", () => {
    expect(decideCardExperience({ outcome: "CAMPAIGN", campaignOrigin: "SYSTEM_DIRECT", availability: on })).toEqual({ kind: "RETURN" });
  });
  it("com a campanha do sistema do Retorno: tela do Retorno", () => {
    expect(decideCardExperience({ outcome: "CAMPAIGN", campaignOrigin: "SYSTEM_RETURN", availability: on })).toEqual({ kind: "RETURN" });
  });
});

describe("decideCardExperience: Retorno pausado ou sem PIN (estado 14)", () => {
  it.each<OfferUnavailableReason>(["PAUSED", "NO_PIN"])("%s: só os botões, mesmo com o redirecionamento inicial", (reason) => {
    expect(decideCardExperience({ outcome: "CAMPAIGN", campaignOrigin: "SYSTEM_DIRECT", availability: off(reason) })).toEqual({ kind: "BUTTONS" });
    expect(decideCardExperience({ outcome: "REVIEW_FLOW_FALLBACK", campaignOrigin: null, availability: off(reason) })).toEqual({ kind: "BUTTONS" });
  });
});

describe("decideCardExperience: sem Retorno, como antes (estado 15 e interruptor geral)", () => {
  it.each<OfferUnavailableReason>(["KILL_SWITCH", "NOT_IN_PILOT", "PLAN_NOT_ALLOWED"])(
    "%s: o redirecionamento direto continua, e sem campanha aparecem só os botões",
    (reason) => {
      expect(decideCardExperience({ outcome: "CAMPAIGN", campaignOrigin: "SYSTEM_DIRECT", availability: off(reason) })).toEqual({ kind: "CAMPAIGN" });
      expect(decideCardExperience({ outcome: "REVIEW_FLOW_FALLBACK", campaignOrigin: null, availability: off(reason) })).toEqual({ kind: "BUTTONS" });
    }
  );
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

describe("primaryButtonLabel", () => {
  it.each([
    ["https://g.page/r/bella-vista/review", "Avaliar no Google"],
    ["https://search.google.com/local/writereview?placeid=abc", "Avaliar no Google"],
    ["https://maps.app.goo.gl/xyz", "Ver no Google"],
    ["https://www.google.com/maps/place/Bella+Vista", "Ver no Google"],
    ["https://www.instagram.com/loja", "Ver no Instagram"],
    ["https://wa.me/5511999999999", "Falar no WhatsApp"],
    ["https://www.tiktok.com/@loja", "Ver no TikTok"],
    ["https://www.facebook.com/loja", "Ver no Facebook"],
    ["https://cardapio.exemplo.com.br/mesa-1", "Continuar"],
    ["não é url", "Continuar"],
  ])("%s → %s", (url, label) => {
    expect(primaryButtonLabel(url)).toBe(label);
  });

  it("um domínio que só termina com o texto de outro não é confundido", () => {
    expect(primaryButtonLabel("https://naoinstagram.com/x")).toBe("Continuar");
    expect(primaryButtonLabel("https://google.com.evil.com/x")).toBe("Continuar");
  });
});
