import type { StoreOrderStatus } from "@/generated/prisma/client";

/**
 * Motor de Ativação (Fase 18) — traduz a esteira real de produção (os
 * timestamps granulares do StoreOrder) numa lista de passos e numa frase
 * única de "onde está agora", em português simples. Uma função pura,
 * reutilizada tanto pela página de acompanhamento sem login
 * (/loja/sucesso) quanto pelo banner dentro do Dashboard — as duas
 * superfícies nunca podem divergir sobre o que "estágio atual" significa.
 */
export interface StoreOrderChecklistLike {
  status: StoreOrderStatus;
  provisionedAt: Date | null;
  stockConfirmedAt: Date | null;
  printedAt: Date | null;
  nfcWrittenAt: Date | null;
  qcPassedAt: Date | null;
  packagedAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  trackingCode: string | null;
  carrier: string | null;
}

export interface OrderChecklistStep {
  key: string;
  label: string;
  done: boolean;
  at: Date | null;
}

export function buildOrderChecklist(order: StoreOrderChecklistLike): OrderChecklistStep[] {
  const paid = order.status !== "PENDING_PAYMENT" && order.status !== "CANCELED";
  return [
    { key: "PAID", label: "Pagamento confirmado", done: paid, at: null },
    { key: "STOCK", label: "Estoque confirmado", done: !!order.stockConfirmedAt, at: order.stockConfirmedAt },
    { key: "PROVISIONED", label: "Cartões criados", done: !!order.provisionedAt, at: order.provisionedAt },
    { key: "PRINTED", label: "Impresso", done: !!order.printedAt, at: order.printedAt },
    { key: "WRITTEN", label: "Gravado no chip", done: !!order.nfcWrittenAt, at: order.nfcWrittenAt },
    { key: "QC", label: "Testado", done: !!order.qcPassedAt, at: order.qcPassedAt },
    { key: "PACKAGED", label: "Embalado", done: !!order.packagedAt, at: order.packagedAt },
    { key: "SHIPPED", label: "Enviado", done: !!order.shippedAt, at: order.shippedAt },
    { key: "DELIVERED", label: "Entregue", done: !!order.deliveredAt, at: order.deliveredAt },
  ];
}

export function currentStageLabel(order: StoreOrderChecklistLike): string {
  if (order.status === "CANCELED") return "Pedido cancelado";
  if (order.deliveredAt) return "Entregue";
  if (order.shippedAt) {
    if (order.trackingCode) {
      return order.carrier ? `A caminho pela ${order.carrier} — rastreio ${order.trackingCode}` : `A caminho — rastreio ${order.trackingCode}`;
    }
    return "A caminho";
  }
  if (order.packagedAt) return "Embalado, aguardando envio";
  if (order.qcPassedAt) return "Testado, embalando";
  if (order.nfcWrittenAt) return "Gravado no chip, testando";
  if (order.printedAt) return "Impresso, gravando o chip";
  if (order.provisionedAt) return "Cartões criados, imprimindo";
  if (order.stockConfirmedAt) return "Estoque confirmado, preparando produção";
  if (order.status === "PAID") return "Pagamento confirmado, preparando produção";
  return "Aguardando confirmação do pagamento";
}

/** Um pedido "em andamento" é qualquer um que ainda não chegou num estado
 * final (Entregue ou Cancelado) — é isso que decide se o banner do
 * Dashboard (ou a checklist da página de acompanhamento) tem algo a
 * mostrar. */
export function isOrderInProgress(status: StoreOrderStatus): boolean {
  return status !== "DELIVERED" && status !== "CANCELED";
}

/** Auditoria do Fluxo de Vendas (12/09/2026) — vocabulário de disputa é o
 * do próprio Stripe (ver webhook), nunca reinventado aqui. "won" é o único
 * desfecho que não precisa mais de atenção do dono — todo o resto (em
 * aberto ou perdido) continua valendo um alerta visível no Admin. */
export function isDisputeActive(disputeStatus: string | null): boolean {
  return !!disputeStatus && disputeStatus !== "won";
}

/** Transformação do Painel Admin (13/09/2026) — um único mapa de
 * label/tom por `StoreOrderStatus`, compartilhado pelo Kanban, pela Sheet
 * de detalhe e pela Tabela — antes cada tela reinventava seu próprio
 * subconjunto, arriscando divergir (ex.: "Reembolsado" com uma cor num
 * lugar e outra em outro). */
export const STATUS_LABEL: Record<StoreOrderStatus, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
  REFUNDED: "Reembolsado",
};

export const STATUS_TONE: Record<StoreOrderStatus, "success" | "warning" | "danger" | "info" | "neutral"> = {
  PENDING_PAYMENT: "neutral",
  PAID: "info",
  SHIPPED: "warning",
  DELIVERED: "success",
  CANCELED: "danger",
  REFUNDED: "danger",
};
