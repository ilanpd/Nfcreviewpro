import { addCalendarDays, localDay, startOfLocalDay, startOfNextLocalDay } from "./time";

/**
 * Vida do brinde (ADR-078): liberação, validade, carência e o que fazer a cada
 * toque. Puro: recebe o estado já buscado e devolve a decisão; nunca grava.
 * O serviço aplica a decisão (e o resgate atômico no banco é quem garante que
 * dois resgates simultâneos do mesmo código não passam).
 */

export type VoucherStatusValue = "ISSUED" | "REDEEMED" | "EXPIRED" | "VOIDED";

export interface VoucherLike {
  id: string;
  status: VoucherStatusValue;
  issuedAt: Date;
  availableAt: Date;
  expiresAt: Date;
}

/** NOT_YET: emitido, ainda não liberado. AVAILABLE: pode resgatar. */
export type VoucherPhase = "NOT_YET" | "AVAILABLE" | "REDEEMED" | "EXPIRED" | "VOIDED";

export interface VoucherWindow {
  availableAt: Date;
  /** Fim exclusivo: o brinde deixa de valer neste instante. */
  expiresAt: Date;
}

/**
 * Libera no dia seguinte (fuso da empresa) para o cliente não tocar e resgatar
 * na mesma visita; vale `windowDays` dias corridos contando o dia da liberação.
 * Emitido em 25/09 com 14 dias: libera em 26/09 e vale até 09/10 inclusive.
 */
export function computeVoucherWindow(now: Date, timeZone: string, windowDays: number): VoucherWindow {
  const availableAt = startOfNextLocalDay(now, timeZone);
  const firstDay = localDay(availableAt, timeZone);
  const expiresAt = startOfLocalDay(addCalendarDays(firstDay, windowDays), timeZone);
  return { availableAt, expiresAt };
}

/** Último dia em que o brinde vale, como instante dentro desse dia (para formatar a data na tela). */
export function lastValidInstant(expiresAt: Date): Date {
  return new Date(expiresAt.getTime() - 1);
}

/**
 * A fase de um brinde agora. O vencimento é conferido aqui, contra `expiresAt`,
 * e nunca depende de uma limpeza ter marcado `EXPIRED` no banco (vencimento na
 * leitura): um brinde vencido nunca resgata, mesmo com a limpeza atrasada.
 */
export function voucherPhase(voucher: Pick<VoucherLike, "status" | "availableAt" | "expiresAt">, now: Date): VoucherPhase {
  if (voucher.status === "REDEEMED") return "REDEEMED";
  if (voucher.status === "VOIDED") return "VOIDED";
  if (voucher.status === "EXPIRED" || voucher.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  if (voucher.availableAt.getTime() > now.getTime()) return "NOT_YET";
  return "AVAILABLE";
}

export type TouchDecision =
  /** Emitir um brinde novo. */
  | { kind: "ISSUE" }
  /** Já existe um brinde ativo para este aparelho: só mostrar. */
  | { kind: "SHOW_EXISTING"; voucherId: string; phase: "NOT_YET" | "AVAILABLE" }
  /** Dentro da carência: sem brinde novo agora. */
  | { kind: "COOLDOWN"; nextEligibleAt: Date; lastStatus: VoucherStatusValue }
  /** Teto diário da empresa atingido. */
  | { kind: "CAP_REACHED" };

export interface TouchInput {
  now: Date;
  cooldownDays: number;
  /** Teto de brindes emitidos por dia (fuso da empresa); nulo = sem teto. */
  dailyCap: number | null;
  /** Quantos brindes a empresa já emitiu no dia local de hoje. */
  issuedToday: number;
  /** Brindes deste aparelho (cookie) nesta empresa, em qualquer ordem. */
  visitorVouchers: VoucherLike[];
}

/**
 * O que fazer quando um aparelho toca no cartão, na ordem que o plano definiu:
 * 1) um brinde ativo por aparelho e por empresa: tocar de novo só mostra o que
 *    já existe; 2) carência entre a emissão de um brinde e a do próximo;
 * 3) teto diário; 4) emitir. Brindes anulados não contam para nada: um erro
 * de resgate ou uma fraude não pode punir o cliente.
 */
export function decideOnTouch(input: TouchInput): TouchDecision {
  const counted = input.visitorVouchers.filter((v) => v.status !== "VOIDED");

  for (const voucher of counted) {
    const phase = voucherPhase(voucher, input.now);
    if (phase === "NOT_YET" || phase === "AVAILABLE") {
      return { kind: "SHOW_EXISTING", voucherId: voucher.id, phase };
    }
  }

  const last = counted.reduce<VoucherLike | null>((acc, v) => (!acc || v.issuedAt > acc.issuedAt ? v : acc), null);
  if (last && input.cooldownDays > 0) {
    const nextEligibleAt = new Date(last.issuedAt.getTime() + input.cooldownDays * 24 * 60 * 60 * 1000);
    if (nextEligibleAt.getTime() > input.now.getTime()) {
      return { kind: "COOLDOWN", nextEligibleAt, lastStatus: last.status };
    }
  }

  if (input.dailyCap !== null && input.issuedToday >= input.dailyCap) return { kind: "CAP_REACHED" };

  return { kind: "ISSUE" };
}

export type RedeemFailure = "NOT_FOUND" | "ALREADY_REDEEMED" | "EXPIRED" | "NOT_YET_AVAILABLE" | "VOIDED";

/**
 * Por que um código não pôde ser resgatado, ou `null` se pode. Usado para
 * explicar ao atendente o resultado de uma tentativa (o UPDATE atômico do
 * serviço afetar zero linhas só diz "não passou", não o motivo).
 */
export function explainRedeemFailure(
  voucher: Pick<VoucherLike, "status" | "availableAt" | "expiresAt"> | null,
  now: Date
): RedeemFailure | null {
  if (!voucher) return "NOT_FOUND";
  switch (voucherPhase(voucher, now)) {
    case "AVAILABLE":
      return null;
    case "NOT_YET":
      return "NOT_YET_AVAILABLE";
    case "REDEEMED":
      return "ALREADY_REDEEMED";
    case "EXPIRED":
      return "EXPIRED";
    case "VOIDED":
      return "VOIDED";
  }
}
