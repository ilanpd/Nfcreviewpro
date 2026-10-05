/**
 * Estoque de placas (ADR-092) — estado de uma placa. O banco guarda só o ciclo
 * FÍSICO (`PlateStatus`); o que o dono enxerga ("Em estoque", "Atribuída…") é
 * derivado aqui de status + dono, para existir uma única fonte de verdade e
 * nunca dois campos que possam discordar.
 */

export type PlateStatusValue = "GENERATED" | "IN_PRODUCTION" | "VERIFIED" | "DEFECTIVE" | "VOIDED";

export type PlateStage = "GENERATED" | "IN_PRODUCTION" | "IN_STOCK" | "ASSIGNED" | "DEFECTIVE" | "VOIDED";

export type PlateTone = "neutral" | "info" | "success" | "brand" | "danger" | "muted";

export interface PlateChecks {
  nfcChecked: boolean;
  qrChecked: boolean;
  serialChecked: boolean;
}

export function derivePlateStage(plate: { status: PlateStatusValue; cardId: string | null }): PlateStage {
  switch (plate.status) {
    case "DEFECTIVE":
      return "DEFECTIVE";
    case "VOIDED":
      return "VOIDED";
    case "VERIFIED":
      return plate.cardId ? "ASSIGNED" : "IN_STOCK";
    case "IN_PRODUCTION":
      return "IN_PRODUCTION";
    case "GENERATED":
      return "GENERATED";
  }
}

export const STAGE_LABEL: Record<PlateStage, string> = {
  GENERATED: "Gerada",
  IN_PRODUCTION: "Em produção",
  IN_STOCK: "Em estoque",
  ASSIGNED: "Com cliente",
  DEFECTIVE: "Defeituosa",
  VOIDED: "Anulada",
};

export const STAGE_TONE: Record<PlateStage, PlateTone> = {
  GENERATED: "muted",
  IN_PRODUCTION: "info",
  IN_STOCK: "success",
  ASSIGNED: "brand",
  DEFECTIVE: "danger",
  VOIDED: "muted",
};

export const STAGE_ORDER: PlateStage[] = ["GENERATED", "IN_PRODUCTION", "IN_STOCK", "ASSIGNED", "DEFECTIVE", "VOIDED"];

export function allChecked(checks: PlateChecks): boolean {
  return checks.nfcChecked && checks.qrChecked && checks.serialChecked;
}

/**
 * Status depois de mexer na conferência. As três checagens marcadas =
 * conferida; desmarcar qualquer uma de uma placa já conferida volta para "em
 * produção" (ela deixa de ser confiável). Placa defeituosa/anulada não muda
 * por aqui — precisa ser restaurada de propósito.
 */
export function statusAfterChecks(current: PlateStatusValue, checks: PlateChecks): PlateStatusValue {
  if (current === "DEFECTIVE" || current === "VOIDED") return current;
  if (allChecked(checks)) return "VERIFIED";
  return "IN_PRODUCTION";
}

/** Uma placa só pode ser entregue a um cliente depois de conferida. */
export function canAssign(plate: { status: PlateStatusValue; cardId: string | null }): boolean {
  return plate.status === "VERIFIED" && plate.cardId === null;
}

/** Defeituosa/anulada só se a placa estiver sem dono — com dono, é uma troca. */
export function canRetire(plate: { status: PlateStatusValue; cardId: string | null }): boolean {
  return plate.cardId === null && plate.status !== "DEFECTIVE" && plate.status !== "VOIDED";
}

export function canRestore(plate: { status: PlateStatusValue }): boolean {
  return plate.status === "DEFECTIVE" || plate.status === "VOIDED";
}

export type PlateEventType =
  | "GENERATED"
  | "BATCH_SENT"
  | "BATCH_RECEIVED"
  | "CHECKED"
  | "VERIFIED"
  | "UNVERIFIED"
  | "ASSIGNED"
  | "UNASSIGNED"
  | "REPLACED"
  | "DEFECTIVE"
  | "VOIDED"
  | "RESTORED";

export const EVENT_LABEL: Record<PlateEventType, string> = {
  GENERATED: "Placa gerada",
  BATCH_SENT: "Lote enviado à gráfica",
  BATCH_RECEIVED: "Lote recebido",
  CHECKED: "Conferência atualizada",
  VERIFIED: "Conferida e em estoque",
  UNVERIFIED: "Conferência desfeita",
  ASSIGNED: "Atribuída a um cliente",
  UNASSIGNED: "Devolvida ao estoque",
  REPLACED: "Trocada por outra placa",
  DEFECTIVE: "Marcada como defeituosa",
  VOIDED: "Anulada",
  RESTORED: "Restaurada",
};
