import type { StoreOrderChecklistLike } from "./checklist";

/**
 * Motor de Ativação (Fase 18), expandido para 8 etapas na Fase 19.3 — o
 * Centro de Operações do Admin não olha o `status` de 5 valores (esse é o
 * resumo que o cliente vê); ele deriva a coluna do quadro a partir do
 * último timestamp de produção preenchido. Um pedido nunca precisa de um
 * campo "coluna atual" próprio — é sempre calculável a partir da
 * checklist, a mesma fonte de verdade da página de acompanhamento do
 * cliente. "Separação" reaproveita `stockConfirmedAt` (mesma ação:
 * confirmar que o material físico está disponível) — só "Impressão"
 * (`printedAt`) é campo novo; "Embalagem" e "Expedição" viram etapas
 * distintas (antes uma única coluna "Enviado" fazia as duas juntas).
 */
export type BoardColumn =
  | "PAGO"
  | "SEPARACAO"
  | "IMPRESSAO"
  | "PROGRAMACAO_NFC"
  | "QUALIDADE"
  | "EMBALAGEM"
  | "EXPEDICAO"
  | "ENTREGUE";

export const BOARD_COLUMNS: { key: BoardColumn; label: string }[] = [
  { key: "PAGO", label: "Pago" },
  { key: "SEPARACAO", label: "Separação" },
  { key: "IMPRESSAO", label: "Impressão" },
  { key: "PROGRAMACAO_NFC", label: "Programação NFC" },
  { key: "QUALIDADE", label: "Qualidade" },
  { key: "EMBALAGEM", label: "Embalagem" },
  { key: "EXPEDICAO", label: "Expedição" },
  { key: "ENTREGUE", label: "Entregue" },
];

export function deriveBoardColumn(order: StoreOrderChecklistLike): BoardColumn {
  if (order.deliveredAt) return "ENTREGUE";
  if (order.shippedAt) return "EXPEDICAO";
  if (order.packagedAt) return "EMBALAGEM";
  if (order.qcPassedAt) return "QUALIDADE";
  if (order.nfcWrittenAt) return "PROGRAMACAO_NFC";
  if (order.printedAt) return "IMPRESSAO";
  if (order.stockConfirmedAt) return "SEPARACAO";
  return "PAGO";
}

export type ChecklistStepKey = "STOCK_CONFIRMED" | "PRINTED" | "NFC_WRITTEN" | "QC_PASSED" | "PACKAGED" | "SHIPPED" | "DELIVERED";

/** A ação que completa a etapa anterior quando um pedido é solto NESTA
 * coluna — nunca definida para PAGO (não existe uma etapa anterior a
 * completar para chegar nela). "EXPEDICAO" exige rastreio/transportadora
 * (ver `confirmShipment` em `orders-board.tsx`), único passo que abre um
 * diálogo em vez de aplicar direto. */
export const COLUMN_ENTRY_STEP: Partial<Record<BoardColumn, ChecklistStepKey>> = {
  SEPARACAO: "STOCK_CONFIRMED",
  IMPRESSAO: "PRINTED",
  PROGRAMACAO_NFC: "NFC_WRITTEN",
  QUALIDADE: "QC_PASSED",
  EMBALAGEM: "PACKAGED",
  EXPEDICAO: "SHIPPED",
  ENTREGUE: "DELIVERED",
};

const COLUMN_ORDER: BoardColumn[] = BOARD_COLUMNS.map((c) => c.key);

/** Só avançar uma etapa por vez — arrastar direto de "Pago" para "Entregue"
 * pularia passos reais de produção que nunca aconteceram. */
export function isForwardAdjacent(from: BoardColumn, to: BoardColumn): boolean {
  return COLUMN_ORDER.indexOf(to) === COLUMN_ORDER.indexOf(from) + 1;
}

interface StoreOrderStageLike extends StoreOrderChecklistLike {
  createdAt: Date | string;
}

/**
 * Painel Admin — quando o pedido entrou na coluna atual, não quando foi
 * criado. Com volume real, "há quanto tempo está PARADO nesta etapa" é o
 * dado que separa um pedido normal de um esquecido — nunca visível antes
 * porque o card só mostrava nome/quantidade/valor.
 */
export function stageEnteredAt(order: StoreOrderStageLike): Date | string {
  return (
    order.deliveredAt ??
    order.shippedAt ??
    order.packagedAt ??
    order.qcPassedAt ??
    order.nfcWrittenAt ??
    order.printedAt ??
    order.stockConfirmedAt ??
    order.createdAt
  );
}

/** Aceita string ou Date de propósito — datas de Server Component viram
 * prop de Client Component atravessando serialização RSC, e nem toda
 * versão preserva a instância de `Date` (já vimos string chegar aqui e
 * quebrar a página inteira com `.getTime is not a function`). */
export function daysSince(date: Date | string): number {
  const ms = date instanceof Date ? date.getTime() : new Date(date).getTime();
  return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
}
