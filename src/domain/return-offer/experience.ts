import type { OfferAvailability } from "./availability";

/**
 * O que o cartão mostra quando é tocado (ADR-079/080). O Retorno entra no lugar
 * do comportamento anterior só quando está de pé, e nunca atropela o que o
 * dono montou: uma campanha criada por ele (Pro) sempre vence.
 *
 * - Retorno de pé e nenhuma campanha do dono: tela do Retorno.
 * - Retorno de pé e o redirecionamento inicial do cartão avulso (campanha do
 *   sistema): tela do Retorno, com o destino da compra como botão principal.
 *   É a conversão no lugar ao assinar o Starter: nada é recriado e nada que o
 *   dono escolheu se perde. Desligar o Retorno devolve o redirecionamento direto.
 * - Retorno pausado ou sem PIN (o dono está no piloto e assina): só os botões,
 *   porque "Falar com a gente" continua sendo parte do plano.
 * - Qualquer outro motivo (interruptor geral, fora do piloto, sem assinatura):
 *   como antes do Retorno. Campanha existente segue; sem campanha, só os botões
 *   (a pergunta de estrelas saiu, ADR-080).
 */
export type CampaignOriginValue = "USER" | "SYSTEM_DIRECT" | "SYSTEM_RETURN";

export type CardExperience = { kind: "RETURN" } | { kind: "CAMPAIGN" } | { kind: "BUTTONS" };

export function decideCardExperience(input: {
  outcome: "REVIEW_FLOW_FALLBACK" | "CAMPAIGN";
  campaignOrigin: CampaignOriginValue | null;
  availability: OfferAvailability;
}): CardExperience {
  const ownerCampaign = input.outcome === "CAMPAIGN" && (input.campaignOrigin === "USER" || input.campaignOrigin === null);
  if (ownerCampaign) return { kind: "CAMPAIGN" };

  if (input.availability.available) return { kind: "RETURN" };

  const reason = input.availability.reason;
  if (reason === "PAUSED" || reason === "NO_PIN") return { kind: "BUTTONS" };

  return input.outcome === "CAMPAIGN" ? { kind: "CAMPAIGN" } : { kind: "BUTTONS" };
}

/**
 * O botão principal da tela: a escolha explícita do dono no painel; senão o
 * destino que ele escolheu ao comprar o cartão (o redirecionamento inicial);
 * senão o link de avaliação do Google da empresa. O mesmo para todo cliente,
 * sempre.
 */
export function pickPrimaryUrl(input: {
  offerPrimaryUrl: string | null;
  directCampaignUrl: string | null;
  googleReviewUrl: string;
}): string {
  return input.offerPrimaryUrl || input.directCampaignUrl || input.googleReviewUrl;
}

/** O domínio é exatamente `domain` ou um subdomínio dele (nunca só um sufixo de texto). */
function hostIs(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** O texto do botão principal, pelo destino. Nunca depende do cliente. */
export function primaryButtonLabel(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Continuar";
  }
  const host = parsed.hostname.toLowerCase();
  // "Avaliar" só quando o link é de fato de avaliação (g.page/r/... ou a página de
  // escrever avaliação); qualquer outro endereço do Google é só "ver".
  if (hostIs(host, "g.page")) return "Avaliar no Google";
  if (hostIs(host, "google.com") || hostIs(host, "goo.gl")) {
    return /review/i.test(parsed.pathname + parsed.search) ? "Avaliar no Google" : "Ver no Google";
  }
  if (hostIs(host, "instagram.com")) return "Ver no Instagram";
  if (hostIs(host, "wa.me") || hostIs(host, "whatsapp.com")) return "Falar no WhatsApp";
  if (hostIs(host, "tiktok.com")) return "Ver no TikTok";
  if (hostIs(host, "facebook.com") || hostIs(host, "fb.me")) return "Ver no Facebook";
  return "Continuar";
}
