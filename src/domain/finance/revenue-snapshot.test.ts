import { describe, expect, it } from "vitest";
import { computeRevenueSnapshot } from "./revenue-snapshot";

describe("computeRevenueSnapshot", () => {
  it("returns zeroed snapshot for no companies", () => {
    expect(computeRevenueSnapshot([])).toEqual({
      mrrCents: 0,
      arrCents: 0,
      payingCompanyCount: 0,
      totalCustomerCount: 0,
      planDistribution: [],
    });
  });

  it("only counts companies with an active Stripe subscription toward MRR", () => {
    const snapshot = computeRevenueSnapshot([
      { plan: "PRO", stripeSubscriptionStatus: "active" },
      { plan: "BUSINESS", stripeSubscriptionStatus: "past_due" },
      { plan: "STARTER", stripeSubscriptionStatus: null },
    ]);
    // Só o PRO ativo entra: R$89 -> 8900 centavos.
    expect(snapshot.mrrCents).toBe(8900);
    expect(snapshot.arrCents).toBe(8900 * 12);
    expect(snapshot.payingCompanyCount).toBe(1);
    expect(snapshot.totalCustomerCount).toBe(3);
  });

  it("groups the plan distribution by tier and sorts by company count, descending", () => {
    const snapshot = computeRevenueSnapshot([
      { plan: "STARTER", stripeSubscriptionStatus: "active" },
      { plan: "STARTER", stripeSubscriptionStatus: "active" },
      { plan: "STARTER", stripeSubscriptionStatus: "active" },
      { plan: "PRO", stripeSubscriptionStatus: "active" },
      { plan: "BUSINESS", stripeSubscriptionStatus: "active" },
      { plan: "BUSINESS", stripeSubscriptionStatus: "active" },
    ]);
    expect(snapshot.planDistribution).toEqual([
      { plan: "STARTER", companyCount: 3 },
      { plan: "BUSINESS", companyCount: 2 },
      { plan: "PRO", companyCount: 1 },
    ]);
  });

  it("omits a tier from the distribution entirely when it has zero active subscribers", () => {
    const snapshot = computeRevenueSnapshot([{ plan: "PRO", stripeSubscriptionStatus: "active" }]);
    expect(snapshot.planDistribution).toEqual([{ plan: "PRO", companyCount: 1 }]);
  });
});
