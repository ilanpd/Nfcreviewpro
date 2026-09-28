import type { InsightCardEntry } from "@nfc-os/ui";
import type { CardUrlKind } from "@/domain/card-url/classify";

/**
 * Fase 19.2 — Radar de Atenção do Centro de Operações. Função pura: recebe
 * dado já buscado (nunca busca sozinha), aplica regras simples e explicáveis
 * (Explainability First — cada insight linka direto pra tela que resolve) e
 * devolve só o que é genuinamente real. Zero Fake Demo: sem nenhuma
 * condição atendida, a lista vem vazia — nunca um insight de exemplo.
 */

const STUCK_PRODUCTION_DAYS = 3;
const UNRESOLVED_FEEDBACK_THRESHOLD = 3;

export interface AttentionRadarInput {
  stuckOrders: { id: string; customerName: string; daysStuck: number }[];
  lowStock: { blankChipStock: number; lowStockThreshold: number } | null;
  disputedOrders: { id: string; customerName: string; disputeStatus: string | null }[];
  /**
   * "Falar com a gente" (`PrivateFeedback`) sem resposta do dono — auditoria
   * de 28/09/2026: até aqui isto media `RatingEvent` com 1-2 estrelas, um
   * sinal que zerou para sempre desde a ADR-080 (a tela pública deixou de
   * pedir nota; nenhuma avaliação nova é gravada). Mensagem sem resposta é o
   * sinal real equivalente disponível hoje — não classifica sentimento (o
   * texto é livre), mas aponta exatamente o que o Admin pode agir: uma
   * empresa deixando clientes sem retorno.
   */
  unresolvedFeedbackCompanies: { companyId: string; companyName: string; count: number }[];
  /** Fase 20 — chamados de `/dashboard/suporte` sem resposta há tempo
   * demais; quem já filtrou "mais velho que o limiar" é o chamador
   * (`services/admin-overview.service.ts`), esta função só formata. */
  stuckSupportRequests: { id: string; companyId: string; companyName: string; subject: string }[];
  /** ADR-076 — endereço que vai no chip/QR. `pendingOrders` são os pedidos
   * pagos que ainda vão virar chip; sem nenhum, um endereço provisório não
   * está prejudicando ninguém e o alerta não aparece. */
  cardUrl?: { kind: CardUrlKind; host: string; blocked: boolean; pendingOrders: number } | null;
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

  for (const company of input.unresolvedFeedbackCompanies) {
    if (company.count < UNRESOLVED_FEEDBACK_THRESHOLD) continue;
    insights.push({
      id: `feedback:${company.companyId}`,
      severity: "attention",
      message: `${company.companyName} tem ${company.count} mensagens de clientes sem resposta nos últimos 7 dias`,
    });
  }

  for (const request of input.stuckSupportRequests) {
    insights.push({
      id: `support:${request.companyId}:${request.id}`,
      severity: "attention",
      message: `${request.companyName} está esperando resposta no chamado "${request.subject}"`,
    });
  }

  const cardUrl = input.cardUrl;
  if (cardUrl && cardUrl.kind !== "final" && cardUrl.pendingOrders > 0) {
    const orders = cardUrl.pendingOrders === 1 ? "1 pedido em produção" : `${cardUrl.pendingOrders} pedidos em produção`;
    insights.push({
      id: "card-url",
      severity: "attention",
      message: cardUrl.blocked
        ? `Endereço do cartão ainda não é o definitivo (${cardUrl.host || "inválido"}) — a gravação de chips está bloqueada e há ${orders}`
        : `Endereço do cartão ainda não é o definitivo (${cardUrl.host || "inválido"}) e há ${orders} — não grave chips antes de definir o domínio`,
    });
  }

  return insights;
}
