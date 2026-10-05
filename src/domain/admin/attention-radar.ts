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
// Limiares operacionais do estoque de placas (ADR-092) — só decidem quando o
// radar avisa o dono, nunca algo que o cliente veja. Ajustáveis num lugar só.
const PLATE_BATCH_AT_SUPPLIER_DAYS = 10;
const PLATE_BATCH_AWAITING_CHECK_DAYS = 2;

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
  /**
   * Achado de auditoria de potencial de venda (29/09/2026): sem
   * `RESEND_API_KEY`, `/contato` (o único canal de pré-venda por escrito)
   * mostra "Mensagem enviada!" pro visitante, mas nada chega — a mensagem só
   * é logada. Isso já era sabido como pendência técnica, mas nunca aparecia
   * em lugar nenhum que o Admin olha; ficava fácil esquecer que está
   * silenciosamente quebrado. `undefined` (não passado) nunca gera alerta —
   * só `false` explícito, pra este campo continuar opcional em quem ainda
   * não o calcula.
   */
  emailProviderConfigured?: boolean;
  /**
   * Estoque de placas (ADR-092). `plateStock` já vem filtrado de quem o
   * chamador considera sem cobertura (nem o que está a caminho completa o
   * mínimo). `plateBatches` são lotes parados: na gráfica sem recebimento, ou
   * recebidos com placas ainda por conferir. Opcionais — `undefined` nunca gera
   * alerta.
   */
  plateStock?: { modelId: string; modelName: string; inStock: number; minStock: number; incoming: number }[];
  plateBatches?: { id: string; code: string; kind: "AT_SUPPLIER" | "AWAITING_CHECK"; days: number; pending?: number }[];
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
    const stock = input.lowStock.blankChipStock;
    insights.push({
      id: "low-stock",
      severity: "attention",
      // Estoque negativo = pedidos pagos que ainda não têm chip: "restam -48" não diz nada a ninguém.
      message: stock < 0 ? `Faltam ${-stock} chips NFC em branco para cobrir os pedidos já pagos` : `Estoque de chips NFC abaixo do mínimo — restam ${stock} unidades`,
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

  for (const model of input.plateStock ?? []) {
    const incoming = model.incoming > 0 ? `, ${model.incoming} a caminho` : "";
    insights.push({
      id: `plate-stock:${model.modelId}`,
      severity: "attention",
      message: `Estoque de placas "${model.modelName}" abaixo do mínimo — ${model.inStock} conferida${model.inStock === 1 ? "" : "s"} (mínimo ${model.minStock})${incoming}`,
    });
  }

  for (const batch of input.plateBatches ?? []) {
    if (batch.kind === "AT_SUPPLIER" && batch.days >= PLATE_BATCH_AT_SUPPLIER_DAYS) {
      insights.push({
        id: `plate-batch:${batch.id}`,
        severity: "attention",
        message: `Lote ${batch.code} está na gráfica há ${batch.days} dias sem ser marcado como recebido`,
      });
    }
    if (batch.kind === "AWAITING_CHECK" && batch.days >= PLATE_BATCH_AWAITING_CHECK_DAYS && (batch.pending ?? 0) > 0) {
      const pending = batch.pending ?? 0;
      insights.push({
        id: `plate-batch:${batch.id}`,
        severity: "neutral",
        message: `Lote ${batch.code} foi recebido há ${batch.days} dias e ainda tem ${pending} placa${pending === 1 ? "" : "s"} sem conferir`,
      });
    }
  }

  if (input.emailProviderConfigured === false) {
    insights.push({
      id: "email-provider",
      severity: "attention",
      message:
        "Nenhum provedor de e-mail configurado (RESEND_API_KEY ausente) — /contato mostra \"mensagem enviada\" pro visitante, mas nada é entregue de verdade",
    });
  }

  return insights;
}
