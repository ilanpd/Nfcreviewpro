import type { RedeemFailure } from "./lifecycle";

/**
 * Textos e códigos HTTP das recusas do resgate (ADR-079). Um lugar só, usado
 * pela rota e pela tela do atendente, para o motivo nunca ser contado de duas
 * formas. Falam com o atendente, em frases curtas e sem culpa.
 */
export type RedeemFailureReason = "UNAVAILABLE" | "NOT_FOUND" | "WRONG_PIN" | "TOO_MANY_ATTEMPTS" | RedeemFailure;

const MESSAGE: Record<RedeemFailureReason, string> = {
  NOT_FOUND: "Código não encontrado. Confira as letras e os números.",
  WRONG_PIN: "PIN incorreto.",
  TOO_MANY_ATTEMPTS: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  ALREADY_REDEEMED: "Este brinde já foi resgatado.",
  EXPIRED: "Este brinde venceu.",
  NOT_YET_AVAILABLE: "Este brinde ainda não foi liberado. Ele vale a partir de amanhã.",
  VOIDED: "Este brinde foi cancelado.",
  UNAVAILABLE: "O resgate está indisponível no momento. Tente de novo em instantes.",
};

const STATUS: Record<RedeemFailureReason, number> = {
  NOT_FOUND: 404,
  WRONG_PIN: 401,
  TOO_MANY_ATTEMPTS: 429,
  ALREADY_REDEEMED: 409,
  EXPIRED: 409,
  NOT_YET_AVAILABLE: 409,
  VOIDED: 409,
  UNAVAILABLE: 503,
};

export function redeemFailureMessage(reason: RedeemFailureReason): string {
  return MESSAGE[reason];
}

export function redeemFailureStatus(reason: RedeemFailureReason): number {
  return STATUS[reason];
}
