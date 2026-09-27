/**
 * O Retorno está disponível para esta empresa agora? Uma função só, usada pela
 * tela do toque, pelo painel e pelo serviço, para ninguém decidir por conta
 * própria (ADR-078). A ordem dos motivos é a ordem de quem manda: primeiro o
 * interruptor geral, depois o piloto, depois o plano, depois a configuração do dono.
 */
export type OfferUnavailableReason =
  | "KILL_SWITCH" // interruptor geral desligado pelo Admin
  | "NOT_IN_PILOT" // empresa ainda não liberada pelo Admin
  | "PLAN_NOT_ALLOWED" // sem assinatura que inclua o Retorno
  | "PAUSED" // o dono pausou
  | "NO_PIN"; // sem PIN não há como resgatar

export type OfferAvailability = { available: true } | { available: false; reason: OfferUnavailableReason };

export function offerAvailability(input: {
  globalEnabled: boolean;
  pilotEnabled: boolean;
  tierAllowsReturn: boolean;
  offerActive: boolean;
  hasPin: boolean;
}): OfferAvailability {
  if (!input.globalEnabled) return { available: false, reason: "KILL_SWITCH" };
  if (!input.pilotEnabled) return { available: false, reason: "NOT_IN_PILOT" };
  if (!input.tierAllowsReturn) return { available: false, reason: "PLAN_NOT_ALLOWED" };
  if (!input.offerActive) return { available: false, reason: "PAUSED" };
  if (!input.hasPin) return { available: false, reason: "NO_PIN" };
  return { available: true };
}
