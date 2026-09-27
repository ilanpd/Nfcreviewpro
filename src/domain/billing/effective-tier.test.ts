import { describe, expect, it } from "vitest";
import { GRACE_DAYS, READ_ONLY_DAYS, resolveAccess, type AccessInput } from "./effective-tier";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-27T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

const base: AccessInput = {
  accountType: "CUSTOMER",
  plan: "STARTER",
  stripeSubscriptionStatus: "active",
  subscriptionStatusChangedAt: null,
  now: NOW,
};

describe("resolveAccess: quem nunca assinou", () => {
  it("cartão avulso (empresa GUEST) não tem painel, mesmo com plano gravado", () => {
    const decision = resolveAccess({ ...base, accountType: "GUEST", plan: "PRO" });
    expect(decision).toMatchObject({ state: "NONE", effectivePlan: null, canUseDashboard: false, canWrite: false, canIssueVouchers: false });
  });

  it.each([null, "incomplete", "incomplete_expired"])("cadastro sem pagar (status %s) não abre o painel", (status) => {
    expect(resolveAccess({ ...base, stripeSubscriptionStatus: status }).state).toBe("NONE");
  });
});

describe("resolveAccess: assinatura em dia", () => {
  it.each(["active", "trialing"])("%s: acesso total ao plano da empresa", (status) => {
    const decision = resolveAccess({ ...base, plan: "PRO", stripeSubscriptionStatus: status });
    expect(decision).toEqual({
      state: "ACTIVE",
      effectivePlan: "PRO",
      canUseDashboard: true,
      canWrite: true,
      canIssueVouchers: true,
      endsAt: null,
    });
  });
});

describe("resolveAccess: cobrança atrasada", () => {
  const pastDue = (changedDaysAgo: number | null) =>
    resolveAccess({
      ...base,
      stripeSubscriptionStatus: "past_due",
      subscriptionStatusChangedAt: changedDaysAgo === null ? null : daysAgo(changedDaysAgo),
    });

  it("dentro dos 7 dias de tolerância: tudo funciona, e diz quando a tolerância acaba", () => {
    const decision = pastDue(3);
    expect(decision).toMatchObject({ state: "GRACE", canWrite: true, canIssueVouchers: true, effectivePlan: "STARTER" });
    expect(decision.endsAt).toEqual(new Date(daysAgo(3).getTime() + GRACE_DAYS * DAY));
  });

  it("passou a tolerância: só leitura, sem brinde novo", () => {
    const decision = pastDue(8);
    expect(decision).toMatchObject({ state: "READ_ONLY", canUseDashboard: true, canWrite: false, canIssueVouchers: false });
  });

  it("passou tolerância e leitura: bloqueado até reativar", () => {
    const decision = pastDue(GRACE_DAYS + READ_ONLY_DAYS + 1);
    expect(decision).toMatchObject({ state: "LAPSED", effectivePlan: null, canUseDashboard: false });
  });

  it("no instante exato em que a tolerância termina já é só leitura", () => {
    expect(pastDue(GRACE_DAYS).state).toBe("READ_ONLY");
  });

  it("sem data da mudança (linha antiga) conta como se tivesse acabado de atrasar: nunca tranca por falta de dado", () => {
    expect(pastDue(null).state).toBe("GRACE");
  });

  it("unpaid segue a mesma regra de past_due", () => {
    expect(resolveAccess({ ...base, stripeSubscriptionStatus: "unpaid", subscriptionStatusChangedAt: daysAgo(1) }).state).toBe("GRACE");
  });
});

describe("resolveAccess: cancelada", () => {
  it("cancelou há 30 dias: 90 dias de leitura, sem escrever", () => {
    const decision = resolveAccess({ ...base, stripeSubscriptionStatus: "canceled", subscriptionStatusChangedAt: daysAgo(30) });
    expect(decision).toMatchObject({ state: "READ_ONLY", canUseDashboard: true, canWrite: false, canIssueVouchers: false, effectivePlan: "STARTER" });
    expect(decision.endsAt).toEqual(new Date(daysAgo(30).getTime() + READ_ONLY_DAYS * DAY));
  });

  it("cancelou há mais de 90 dias: bloqueado", () => {
    expect(resolveAccess({ ...base, stripeSubscriptionStatus: "canceled", subscriptionStatusChangedAt: daysAgo(91) }).state).toBe("LAPSED");
  });

  it("cancelada sem data: leitura, não bloqueio", () => {
    expect(resolveAccess({ ...base, stripeSubscriptionStatus: "canceled" }).state).toBe("READ_ONLY");
  });

  it("status desconhecido do Stripe cai para leitura (erra para o lado de não trancar quem paga)", () => {
    expect(resolveAccess({ ...base, stripeSubscriptionStatus: "algo_novo" }).state).toBe("READ_ONLY");
    expect(resolveAccess({ ...base, stripeSubscriptionStatus: "paused" }).state).toBe("READ_ONLY");
  });

  it("um cancelamento nunca vira Starter por queda de plano: o plano efetivo é o que a empresa tinha", () => {
    const decision = resolveAccess({ ...base, plan: "BUSINESS", stripeSubscriptionStatus: "canceled", subscriptionStatusChangedAt: daysAgo(1) });
    expect(decision.effectivePlan).toBe("BUSINESS");
  });
});
