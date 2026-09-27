import { describe, expect, it } from "vitest";
import { toPublicVoucherView } from "./view";
import { computeVoucherWindow } from "./lifecycle";

const SP = "America/Sao_Paulo";
const ISSUED_AT = new Date("2026-09-25T17:32:00Z");

describe("toPublicVoucherView", () => {
  const window = computeVoucherWindow(ISSUED_AT, SP, 14);
  const voucher = { code: "K7X4QM", title: "Hidratação grátis", status: "ISSUED" as const, ...window };

  it("mostra o código com hífen e as datas do exemplo dos materiais (vale de amanhã até 09/10)", () => {
    const view = toPublicVoucherView(voucher, SP, ISSUED_AT);
    expect(view).toMatchObject({
      code: "K7X-4QM",
      title: "Hidratação grátis",
      phase: "NOT_YET",
      availableLabel: "26/09",
      lastValidLabel: "09/10",
    });
  });

  it("a fase acompanha o relógio: liberado no dia seguinte", () => {
    const next = new Date("2026-09-26T15:00:00Z");
    expect(toPublicVoucherView(voucher, SP, next).phase).toBe("AVAILABLE");
  });

  it("depois do último dia, vencido", () => {
    const late = new Date("2026-10-10T12:00:00Z");
    expect(toPublicVoucherView(voucher, SP, late).phase).toBe("EXPIRED");
  });

  it("datas em ISO para o navegador", () => {
    const view = toPublicVoucherView(voucher, SP, ISSUED_AT);
    expect(view.availableAt).toBe("2026-09-26T03:00:00.000Z");
    expect(view.expiresAt).toBe("2026-10-10T03:00:00.000Z");
  });
});
