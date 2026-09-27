import { describe, expect, it } from "vitest";
import {
  computeVoucherWindow,
  decideOnTouch,
  explainRedeemFailure,
  lastValidInstant,
  voucherPhase,
  type VoucherLike,
} from "./lifecycle";
import { formatDayMonth } from "./time";

const SP = "America/Sao_Paulo";
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-25T17:32:00Z"); // 14:32 em São Paulo

function voucher(overrides: Partial<VoucherLike> & { id?: string } = {}): VoucherLike {
  return {
    id: overrides.id ?? "v1",
    status: "ISSUED",
    issuedAt: new Date(NOW.getTime() - DAY),
    availableAt: new Date(NOW.getTime() - 1000),
    expiresAt: new Date(NOW.getTime() + 10 * DAY),
    ...overrides,
  };
}

describe("computeVoucherWindow", () => {
  it("emitido em 25/09 com 14 dias: libera em 26/09 e vale até 09/10 (o exemplo dos materiais)", () => {
    const { availableAt, expiresAt } = computeVoucherWindow(NOW, SP, 14);
    expect(availableAt.toISOString()).toBe("2026-09-26T03:00:00.000Z");
    expect(expiresAt.toISOString()).toBe("2026-10-10T03:00:00.000Z");
    expect(formatDayMonth(lastValidInstant(expiresAt), SP)).toBe("09/10");
  });

  it("janela de 1 dia vale só o dia da liberação", () => {
    const { availableAt, expiresAt } = computeVoucherWindow(NOW, SP, 1);
    expect(expiresAt.getTime() - availableAt.getTime()).toBe(DAY);
    expect(formatDayMonth(lastValidInstant(expiresAt), SP)).toBe("26/09");
  });

  it("vira o ano", () => {
    const { expiresAt } = computeVoucherWindow(new Date("2026-12-25T15:00:00Z"), SP, 14);
    expect(formatDayMonth(lastValidInstant(expiresAt), SP)).toBe("08/01");
  });

  it("tocar às 23h50 locais libera à meia-noite, dez minutos depois", () => {
    const { availableAt } = computeVoucherWindow(new Date("2026-09-26T02:50:00Z"), SP, 14);
    expect(availableAt.toISOString()).toBe("2026-09-26T03:00:00.000Z");
  });
});

describe("voucherPhase", () => {
  it("NOT_YET antes de liberar, AVAILABLE depois", () => {
    const v = voucher({ availableAt: new Date(NOW.getTime() + 1000) });
    expect(voucherPhase(v, NOW)).toBe("NOT_YET");
    expect(voucherPhase(v, new Date(NOW.getTime() + 1000))).toBe("AVAILABLE");
  });

  it("vence na leitura, mesmo com status ainda ISSUED no banco", () => {
    const v = voucher({ expiresAt: new Date(NOW.getTime() + 1000) });
    expect(voucherPhase(v, NOW)).toBe("AVAILABLE");
    expect(voucherPhase(v, new Date(NOW.getTime() + 1000))).toBe("EXPIRED");
    expect(voucherPhase(v, new Date(NOW.getTime() + 2000))).toBe("EXPIRED");
  });

  it("status terminais prevalecem sobre as datas", () => {
    expect(voucherPhase(voucher({ status: "REDEEMED" }), NOW)).toBe("REDEEMED");
    expect(voucherPhase(voucher({ status: "VOIDED" }), NOW)).toBe("VOIDED");
    expect(voucherPhase(voucher({ status: "EXPIRED" }), NOW)).toBe("EXPIRED");
  });
});

describe("decideOnTouch", () => {
  const base = { now: NOW, cooldownDays: 30, dailyCap: null, issuedToday: 0 };

  it("aparelho sem brinde: emite", () => {
    expect(decideOnTouch({ ...base, visitorVouchers: [] })).toEqual({ kind: "ISSUE" });
  });

  it("brinde ainda não liberado: só mostra o que já existe", () => {
    const v = voucher({ id: "a", availableAt: new Date(NOW.getTime() + DAY) });
    expect(decideOnTouch({ ...base, visitorVouchers: [v] })).toEqual({ kind: "SHOW_EXISTING", voucherId: "a", phase: "NOT_YET" });
  });

  it("brinde liberado: mostra, com o botão de resgatar", () => {
    expect(decideOnTouch({ ...base, visitorVouchers: [voucher({ id: "b" })] })).toEqual({
      kind: "SHOW_EXISTING",
      voucherId: "b",
      phase: "AVAILABLE",
    });
  });

  it("brinde ativo tem prioridade sobre o teto diário e sobre a carência", () => {
    const decision = decideOnTouch({ ...base, dailyCap: 1, issuedToday: 5, visitorVouchers: [voucher({ id: "c" })] });
    expect(decision.kind).toBe("SHOW_EXISTING");
  });

  it("brinde vencido dentro da carência: sem brinde novo, e diz quando volta a poder", () => {
    const issuedAt = new Date(NOW.getTime() - 20 * DAY);
    const decision = decideOnTouch({
      ...base,
      visitorVouchers: [voucher({ issuedAt, availableAt: new Date(issuedAt.getTime() + DAY), expiresAt: new Date(NOW.getTime() - 5 * DAY) })],
    });
    expect(decision).toEqual({ kind: "COOLDOWN", nextEligibleAt: new Date(issuedAt.getTime() + 30 * DAY), lastStatus: "ISSUED" });
  });

  it("brinde já resgatado dentro da carência: também espera", () => {
    const decision = decideOnTouch({
      ...base,
      visitorVouchers: [voucher({ status: "REDEEMED", issuedAt: new Date(NOW.getTime() - 10 * DAY) })],
    });
    expect(decision).toMatchObject({ kind: "COOLDOWN", lastStatus: "REDEEMED" });
  });

  it("fora da carência: emite outro", () => {
    const decision = decideOnTouch({
      ...base,
      visitorVouchers: [voucher({ status: "REDEEMED", issuedAt: new Date(NOW.getTime() - 31 * DAY) })],
    });
    expect(decision).toEqual({ kind: "ISSUE" });
  });

  it("a carência conta a partir da emissão mais recente", () => {
    const decision = decideOnTouch({
      ...base,
      visitorVouchers: [
        voucher({ id: "old", status: "REDEEMED", issuedAt: new Date(NOW.getTime() - 90 * DAY) }),
        voucher({ id: "new", status: "REDEEMED", issuedAt: new Date(NOW.getTime() - 5 * DAY) }),
      ],
    });
    expect(decision.kind).toBe("COOLDOWN");
  });

  it("carência zero: pode emitir outro logo que o anterior deixa de estar ativo", () => {
    const decision = decideOnTouch({
      ...base,
      cooldownDays: 0,
      visitorVouchers: [voucher({ status: "REDEEMED", issuedAt: new Date(NOW.getTime() - DAY) })],
    });
    expect(decision).toEqual({ kind: "ISSUE" });
  });

  it("brinde anulado não conta nem como ativo nem para a carência", () => {
    const decision = decideOnTouch({ ...base, visitorVouchers: [voucher({ status: "VOIDED", issuedAt: new Date(NOW.getTime() - DAY) })] });
    expect(decision).toEqual({ kind: "ISSUE" });
  });

  it("teto diário atingido: não emite", () => {
    expect(decideOnTouch({ ...base, dailyCap: 10, issuedToday: 10, visitorVouchers: [] })).toEqual({ kind: "CAP_REACHED" });
    expect(decideOnTouch({ ...base, dailyCap: 10, issuedToday: 9, visitorVouchers: [] })).toEqual({ kind: "ISSUE" });
  });
});

describe("explainRedeemFailure", () => {
  it("código que não existe", () => {
    expect(explainRedeemFailure(null, NOW)).toBe("NOT_FOUND");
  });

  it("resgatável: nenhum motivo de recusa", () => {
    expect(explainRedeemFailure(voucher(), NOW)).toBeNull();
  });

  it.each([
    ["ainda não liberou", { availableAt: new Date(NOW.getTime() + DAY) }, "NOT_YET_AVAILABLE"],
    ["já resgatado", { status: "REDEEMED" as const }, "ALREADY_REDEEMED"],
    ["vencido", { expiresAt: new Date(NOW.getTime() - 1) }, "EXPIRED"],
    ["anulado", { status: "VOIDED" as const }, "VOIDED"],
  ])("%s", (_nome, patch, expected) => {
    expect(explainRedeemFailure(voucher(patch), NOW)).toBe(expected);
  });
});
