/**
 * O que o cartão mostra quando é tocado (ADR-079). O Retorno entra no lugar do
 * comportamento anterior só quando está de pé, e nunca atropela o que o dono
 * montou: uma campanha criada por ele (Pro) sempre vence.
 *
 * - Sem Retorno: tudo como antes (campanha, ou o fallback de avaliação).
 * - Com Retorno e nenhuma campanha: tela do Retorno.
 * - Com Retorno e o redirecionamento inicial do cartão avulso (campanha do
 *   sistema): tela do Retorno, com o destino da compra como botão principal.
 *   É a conversão no lugar ao assinar o Starter: nada é recriado e nada que o
 *   dono escolheu se perde. Desligar o Retorno devolve o redirecionamento direto.
 * - Com Retorno e uma campanha do próprio dono: a campanha.
 */
export type CampaignOriginValue = "USER" | "SYSTEM_DIRECT" | "SYSTEM_RETURN";

export type CardExperience = { kind: "RETURN" } | { kind: "CAMPAIGN" } | { kind: "REVIEW_FALLBACK" };

export function decideCardExperience(input: {
  outcome: "REVIEW_FLOW_FALLBACK" | "CAMPAIGN";
  campaignOrigin: CampaignOriginValue | null;
  returnAvailable: boolean;
}): CardExperience {
  if (!input.returnAvailable) {
    return input.outcome === "CAMPAIGN" ? { kind: "CAMPAIGN" } : { kind: "REVIEW_FALLBACK" };
  }
  if (input.outcome === "REVIEW_FLOW_FALLBACK") return { kind: "RETURN" };
  return input.campaignOrigin === "USER" || input.campaignOrigin === null ? { kind: "CAMPAIGN" } : { kind: "RETURN" };
}

/**
 * O botão principal da tela do Retorno: a escolha explícita do dono no painel;
 * senão o destino que ele escolheu ao comprar o cartão (o redirecionamento
 * inicial); senão o link de avaliação do Google da empresa. O mesmo para todo
 * cliente, sempre.
 */
export function pickPrimaryUrl(input: {
  offerPrimaryUrl: string | null;
  directCampaignUrl: string | null;
  googleReviewUrl: string;
}): string {
  return input.offerPrimaryUrl || input.directCampaignUrl || input.googleReviewUrl;
}
