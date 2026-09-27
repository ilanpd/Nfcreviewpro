/**
 * "A conta do primeiro mês" (seção 5 do plano do Starter): quantos clientes
 * que voltam já cobrem a assinatura, a partir do ticket médio que o dono já
 * configura em Configurações (ROI Mode, Fase 7) — nunca um número novo
 * inventado aqui. "Conta simples de receita, não de lucro, e sem prometer
 * quantos clientes voltam" — o texto da UI é quem carrega essa ressalva, não
 * esta função.
 */
export interface RevenueEstimate {
  /** `false` quando o dono nunca configurou o ticket médio: nenhuma estimativa é mostrada. */
  configured: boolean;
  estimatedCents: number | null;
  redeemed: number;
}

export function estimateReturnRevenue(redeemed: number, avgTicketReais: number | null): RevenueEstimate {
  if (avgTicketReais === null || avgTicketReais <= 0) {
    return { configured: false, estimatedCents: null, redeemed };
  }
  return { configured: true, estimatedCents: Math.round(redeemed * avgTicketReais * 100), redeemed };
}
