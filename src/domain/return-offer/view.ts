import { formatVoucherCode } from "./code";
import { lastValidInstant, voucherPhase, type VoucherLike, type VoucherPhase } from "./lifecycle";
import { formatDayMonth } from "./time";

/**
 * O que a tela do cliente recebe sobre um brinde (ADR-079). Datas já formatadas
 * no fuso da empresa ("26/09"), para o navegador nunca calcular dia com o fuso
 * do aparelho. Não carrega nada do banco além do que o cliente precisa ver.
 */
export interface PublicVoucherView {
  /** No formato mostrado ao cliente: K7X-4QM. */
  code: string;
  title: string;
  phase: VoucherPhase;
  availableAt: string;
  expiresAt: string;
  /** Dia em que libera, "26/09". */
  availableLabel: string;
  /** Último dia em que vale, "09/10". */
  lastValidLabel: string;
}

export function toPublicVoucherView(
  voucher: Pick<VoucherLike, "status" | "availableAt" | "expiresAt"> & { code: string; title: string },
  timeZone: string,
  now: Date
): PublicVoucherView {
  return {
    code: formatVoucherCode(voucher.code),
    title: voucher.title,
    phase: voucherPhase(voucher, now),
    availableAt: voucher.availableAt.toISOString(),
    expiresAt: voucher.expiresAt.toISOString(),
    availableLabel: formatDayMonth(voucher.availableAt, timeZone),
    lastValidLabel: formatDayMonth(lastValidInstant(voucher.expiresAt), timeZone),
  };
}

export type ReturnTouchView =
  | { state: "ISSUED" | "EXISTING"; voucher: PublicVoucherView }
  | { state: "COOLDOWN"; nextEligibleLabel: string; lastStatus: "ISSUED" | "REDEEMED" | "EXPIRED" }
  | { state: "CAP_REACHED" };
