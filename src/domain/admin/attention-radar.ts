import type { InsightCardEntry } from "@nfc-os/ui";

/**
 * Fase 19.2 — Radar de Atenção do Centro de Operações. Função pura: recebe
 * dado já buscado (nunca busca sozinha), aplica regras simples e explicáveis
 * (Explainability First — cada insight linka direto pra tela que resolve) e
 * devolve só o que é genuinamente real. Zero Fake Demo: sem nenhuma
 * condição atendida, a lista vem vazia — nunca um insight de exemplo.
 */

const STUCK_PRODUCTION_DAYS = 3;
const NEGATIVE_REVIEW_THRESHOLD = 3;

export interface AttentionRadarInput {
  stuckOrders: { id: string; customerName: string; daysStuck: number }[];
  lowStock: { blankChipStock: number; lowStockThreshold: number } | null;
  disputedOrders: { id: string; customerName: string; disputeStatus: string | null }[];
  negativeReviewCompanies: { companyId: string; companyName: string; count: number }[];
  /** Fase 20 — chamados de `/dashboard/suporte` sem resposta há tempo
   * demais; quem já filtrou "mais velho que o limiar" é o chamador
   * (`services/admin-overview.service.ts`), esta função só formata. */
  stuckSupportRequests: { id: string; companyId: string; companyName: string; subject: string }[];
}

export function buildAttentionRadar(input: AttentionRadarInput): InsightCardEntry[] {
  const insights: InsightCardEntry[] = [];

  for (const order of input.stuckOrders) {
    if (order.daysStuck < STUCK_PRODUCTION_DAYS) continue;
    insights.push({
      id: `stuck:${order.id}`,
      severity: order.daysStuck >= 7 ? "attention" : "neutral",
      message: `Produção parada há ${order.daysStuck} dias — pedido de ${order.customerName}`,
    });
  }

  if (input.lowStock && input.lowStock.blankChipStock < input.lowStock.lowStockThreshold) {
    insights.push({
      id: "low-stock",
      severity: "attention",
      message: `Estoque de chips NFC abaixo do mínimo — restam ${input.lowStock.blankChipStock} unidades`,
    });
  }

  for (const order of input.disputedOrders) {
    insights.push({
      id: `dispute:${order.id}`,
      severity: "attention",
      message: `Pagamento contestado no Stripe — pedido de ${order.customerName} (${order.disputeStatus})`,
    });
  }

  for (const company of input.negativeReviewCompanies) {
    if (company.count < NEGATIVE_REVIEW_THRESHOLD) continue;
    insights.push({
      id: `reviews:${company.companyId}`,
      severity: "attention",
      message: `${company.companyName} recebeu ${company.count} avaliações de 1-2 estrelas nos últimos 7 dias`,
    });
  }

  for (const request of input.stuckSupportRequests) {
    insights.push({
      id: `support:${request.companyId}:${request.id}`,
      severity: "attention",
      message: `${request.companyName} está esperando resposta no chamado "${request.subject}"`,
    });
  }

  return insights;
}
