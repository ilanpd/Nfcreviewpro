import { describe, expect, it } from "vitest";
import { accessNotice, dashboardGateTarget } from "./gate";
import { resolveAccess } from "./effective-tier";

const NOW = new Date("2026-09-27T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const access = (status: string | null, changedDaysAgo: number | null = null, accountType: "GUEST" | "CUSTOMER" = "CUSTOMER") =>
  resolveAccess({
    accountType,
    plan: "STARTER",
    stripeSubscriptionStatus: status,
    subscriptionStatusChangedAt: changedDaysAgo === null ? null : new Date(NOW.getTime() - changedDaysAgo * DAY),
    now: NOW,
  });

describe("dashboardGateTarget", () => {
  it("com a cobrança desligada, o painel nunca é trancado", () => {
    expect(dashboardGateTarget(access(null), false)).toBeNull();
    expect(dashboardGateTarget(access("canceled", 400), false)).toBeNull();
  });

  it("com a cobrança ligada, quem nunca assinou vai escolher um plano", () => {
    expect(dashboardGateTarget(access(null), true)).toBe("/onboarding/plan");
    expect(dashboardGateTarget(access("incomplete"), true)).toBe("/onboarding/plan");
  });

  it("quem tem acesso (ativo, tolerância ou só leitura) entra", () => {
    expect(dashboardGateTarget(access("active"), true)).toBeNull();
    expect(dashboardGateTarget(access("past_due", 2), true)).toBeNull();
    expect(dashboardGateTarget(access("canceled", 10), true)).toBeNull();
  });

  it("depois dos 90 dias de leitura, só reativando", () => {
    expect(dashboardGateTarget(access("canceled", 200), true)).toBe("/onboarding/plan");
  });
});

describe("accessNotice", () => {
  it("assinatura em dia e sem acesso não têm aviso", () => {
    expect(accessNotice(access("active"))).toBeNull();
    expect(accessNotice(access(null))).toBeNull();
    expect(accessNotice(access("canceled", 200))).toBeNull();
  });

  it("tolerância: aviso amarelo com a data limite", () => {
    const notice = accessNotice(access("past_due", 2))!;
    expect(notice.tone).toBe("warning");
    expect(notice.description).toContain("02/10/2026");
  });

  it("só leitura: aviso crítico, dizendo que os brindes já emitidos continuam valendo", () => {
    const notice = accessNotice(access("canceled", 10))!;
    expect(notice.tone).toBe("critical");
    expect(notice.description).toContain("brindes já emitidos continuam valendo");
  });
});
