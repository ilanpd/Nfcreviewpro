import type { OfferUnavailableReason } from "./availability";

/**
 * Texto do painel do dono quando o Retorno não está disponível (ADR-081).
 * Diferente de `messages.ts` (fala com o CLIENTE, na tela pública) — este
 * fala com o DONO, explicando o que falta e, quando ele pode agir, o que
 * fazer. Puro, testável sem React.
 */
export function ownerAvailabilityMessage(reason: OfferUnavailableReason): string {
  switch (reason) {
    case "KILL_SWITCH":
      return "O Retorno está temporariamente desligado para todas as contas. Isso não depende de nada aqui — assim que for religado, tudo volta a funcionar exatamente como estava.";
    case "NOT_IN_PILOT":
      return "Sua conta ainda não foi liberada para o Retorno. Fale com a gente para participar do piloto.";
    case "PLAN_NOT_ALLOWED":
      return "Sua assinatura não está ativa no momento. Reative para voltar a emitir brindes.";
    case "PAUSED":
      return "O Retorno está pausado. Os brindes já emitidos continuam valendo — ninguém perde o que já ganhou.";
    case "NO_PIN":
      return "Defina o PIN da loja abaixo para ativar o Retorno.";
  }
}
