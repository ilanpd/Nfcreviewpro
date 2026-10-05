import { BOARD_COLUMNS, COLUMN_ENTRY_STEP, type BoardColumn, type ChecklistStepKey } from "./board";
import type { StoreOrderChecklistLike } from "./checklist";

/**
 * Etapas do pedido — as regras puras por trás do controle de etapa do painel
 * (avançar uma ou várias, desfazer um passo de produção, e o que uma placa do
 * estoque já cumpre sozinha). Nada aqui toca banco: recebe o pedido e devolve o
 * que fazer, para a tela, a API e os testes concordarem.
 */

const ORDER: BoardColumn[] = BOARD_COLUMNS.map((c) => c.key);

/** Campo de data de cada passo de produção — nunca montado por manipulação de texto. */
export const STEP_FIELD = {
  STOCK_CONFIRMED: "stockConfirmedAt",
  PRINTED: "printedAt",
  NFC_WRITTEN: "nfcWrittenAt",
  QC_PASSED: "qcPassedAt",
  PACKAGED: "packagedAt",
  SHIPPED: "shippedAt",
  DELIVERED: "deliveredAt",
} as const satisfies Record<ChecklistStepKey, keyof StoreOrderChecklistLike>;

export type StepField = (typeof STEP_FIELD)[ChecklistStepKey];

export function columnLabel(column: BoardColumn): string {
  return BOARD_COLUMNS.find((c) => c.key === column)?.label ?? column;
}

export function nextColumn(column: BoardColumn): BoardColumn | null {
  return ORDER[ORDER.indexOf(column) + 1] ?? null;
}

export function previousColumn(column: BoardColumn): BoardColumn | null {
  const i = ORDER.indexOf(column);
  return i > 0 ? ORDER[i - 1] : null;
}

/** As etapas que o pedido atravessa de `from` (exclusive) até `to` (inclusive), em ordem. */
export function columnsThrough(from: BoardColumn, to: BoardColumn): BoardColumn[] {
  const start = ORDER.indexOf(from);
  const end = ORDER.indexOf(to);
  return end > start ? ORDER.slice(start + 1, end + 1) : [];
}

/**
 * Os passos, em ordem, que levam o pedido de `from` até `to` (inclusive). Vazio
 * quando `to` não está à frente — voltar nunca passa por aqui (ver `planUndo`).
 */
export function stepsToReach(from: BoardColumn, to: BoardColumn): ChecklistStepKey[] {
  const start = ORDER.indexOf(from);
  const end = ORDER.indexOf(to);
  if (end <= start) return [];
  return ORDER.slice(start + 1, end + 1).flatMap((column) => {
    const step = COLUMN_ENTRY_STEP[column];
    return step ? [step] : [];
  });
}

export type UndoPlan =
  | { ok: true; from: BoardColumn; to: BoardColumn; field: StepField }
  | { ok: false; reason: string };

/**
 * Desfazer o último passo de PRODUÇÃO (separação até embalagem). Pedido já
 * enviado ou entregue não volta: o cliente já recebeu o e-mail de envio, e um
 * "desfazer" que mentisse sobre isso seria pior do que não ter o botão.
 */
export function planUndo(order: StoreOrderChecklistLike & { currentColumn: BoardColumn }): UndoPlan {
  const column = order.currentColumn;
  // A razão mais específica primeiro: um pedido enviado ou entregue também não está mais "só pago".
  if (column === "EXPEDICAO" || column === "ENTREGUE") {
    return { ok: false, reason: "O pedido já foi enviado ao cliente, que recebeu o e-mail de envio. Registre uma nota em vez de desfazer." };
  }
  if (order.status !== "PAID") {
    return { ok: false, reason: "Só dá para desfazer etapas de produção de um pedido pago e ainda não enviado." };
  }
  const previous = previousColumn(column);
  const step = COLUMN_ENTRY_STEP[column];
  if (!previous || !step) return { ok: false, reason: "O pedido ainda está na primeira etapa: não há o que desfazer." };
  return { ok: true, from: column, to: previous, field: STEP_FIELD[step] };
}

/** Passos de produção que uma placa conferida do estoque já cumpriu antes de ser vendida. */
export const PLATE_COVERED_STEPS: ChecklistStepKey[] = ["STOCK_CONFIRMED", "PRINTED", "NFC_WRITTEN", "QC_PASSED"];

/** O pedido está coberto quando TODOS os cartões dele têm uma placa conferida. */
export function orderCoveredByPlates(cardIds: string[], plates: { cardId: string | null; status: string }[]): boolean {
  if (cardIds.length === 0) return false;
  const verified = new Set(plates.filter((p) => p.status === "VERIFIED" && p.cardId).map((p) => p.cardId));
  return cardIds.every((id) => verified.has(id));
}

/** Dos passos cobertos pelas placas, os que o pedido ainda não registrou. */
export function pendingPlateSteps(order: StoreOrderChecklistLike): ChecklistStepKey[] {
  return PLATE_COVERED_STEPS.filter((step) => !order[STEP_FIELD[step]]);
}

/**
 * Embalar ou enviar sem ter a placa de cada cartão é o erro silencioso que vira
 * reclamação: o painel avisa e pede confirmação (não bloqueia — o dono pode ter
 * um motivo).
 */
export function warnsMissingPlates(target: BoardColumn, cardsTotal: number, cardsWithPlate: number): boolean {
  if (cardsTotal === 0 || cardsWithPlate >= cardsTotal) return false;
  return ORDER.indexOf(target) >= ORDER.indexOf("EMBALAGEM");
}

/** Progresso para a barra de etapas: posição da coluna atual entre as 8. */
export function stageProgress(column: BoardColumn): { index: number; total: number } {
  return { index: ORDER.indexOf(column), total: ORDER.length };
}
