import { describe, expect, it } from "vitest";
import { resolveDecision } from "./resolve";
import type { CampaignAssignmentSnapshot, PublicCardInfo, PublicCompanyInfo, ResolutionContext } from "./types";

const NOW = new Date("2026-06-15T12:00:00Z");

const CARD: PublicCardInfo = { id: "card1", companyId: "company1", uniqueCode: "abc123", branchId: null, zoneId: null };
const COMPANY: PublicCompanyInfo = {
  id: "company1",
  organizationId: null,
  name: "Bella Vista",
  logoUrl: null,
  primaryColor: "#000000",
  googleReviewUrl: "https://g.page/r/bella-vista/review",
  whatsapp: "5511999999999",
  timezone: "America/Sao_Paulo",
};

function assignment(overrides: Partial<CampaignAssignmentSnapshot>): CampaignAssignmentSnapshot {
  return {
    campaignId: "camp1",
    campaignName: "Campanha",
    type: "URL_REDIRECT",
    status: "ACTIVE",
    priority: 0,
    startsAt: null,
    endsAt: null,
    config: { url: "https://example.com" },
    recurrenceType: "NONE",
    recurrenceConfig: null,
    rules: [],
    variants: [],
    scope: "COMPANY",
    branchId: null,
    zoneId: null,
    cardId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function ctx(assignments: CampaignAssignmentSnapshot[]): ResolutionContext {
  return { card: CARD, company: COMPANY, assignments, deviceType: null };
}

describe("resolveDecision", () => {
  it("falls back to the review flow when there are no assignments at all", () => {
    const { decision } = resolveDecision(ctx([]), NOW);
    expect(decision.outcome).toBe("REVIEW_FLOW_FALLBACK");
  });

  it("resolves a single active company-scope assignment to its campaign", () => {
    const { decision } = resolveDecision(ctx([assignment({ campaignId: "camp-solo" })]), NOW);
    expect(decision.outcome).toBe("CAMPAIGN");
    if (decision.outcome === "CAMPAIGN") expect(decision.campaignId).toBe("camp-solo");
  });

  it("never resolves a DRAFT campaign, even if it's the only one available — regression for the provisioning bug found this session", () => {
    const { decision } = resolveDecision(ctx([assignment({ campaignId: "camp-draft", status: "DRAFT" })]), NOW);
    expect(decision.outcome).toBe("REVIEW_FLOW_FALLBACK");
  });

  it("excludes PAUSED and ARCHIVED campaigns from resolution", () => {
    for (const status of ["PAUSED", "ARCHIVED"] as const) {
      const { decision } = resolveDecision(ctx([assignment({ status })]), NOW);
      expect(decision.outcome).toBe("REVIEW_FLOW_FALLBACK");
    }
  });

  it("picks the more specific scope regardless of priority", () => {
    const { decision } = resolveDecision(
      ctx([
        assignment({ campaignId: "company-wide", scope: "COMPANY", priority: 100 }),
        assignment({ campaignId: "this-card-only", scope: "CARD", cardId: CARD.id, priority: 0 }),
      ]),
      NOW
    );
    expect(decision.outcome).toBe("CAMPAIGN");
    if (decision.outcome === "CAMPAIGN") expect(decision.campaignId).toBe("this-card-only");
  });

  it("breaks a tie in scope by priority", () => {
    const { decision } = resolveDecision(
      ctx([
        assignment({ campaignId: "low-priority", scope: "COMPANY", priority: 1 }),
        assignment({ campaignId: "high-priority", scope: "COMPANY", priority: 5 }),
      ]),
      NOW
    );
    expect(decision.outcome).toBe("CAMPAIGN");
    if (decision.outcome === "CAMPAIGN") expect(decision.campaignId).toBe("high-priority");
  });

  it("breaks a tie in scope and priority by recency (newest wins)", () => {
    const { decision } = resolveDecision(
      ctx([
        assignment({ campaignId: "older", scope: "COMPANY", priority: 0, createdAt: new Date("2026-01-01T00:00:00Z") }),
        assignment({ campaignId: "newer", scope: "COMPANY", priority: 0, createdAt: new Date("2026-05-01T00:00:00Z") }),
      ]),
      NOW
    );
    expect(decision.outcome).toBe("CAMPAIGN");
    if (decision.outcome === "CAMPAIGN") expect(decision.campaignId).toBe("newer");
  });

  it("excludes an assignment whose window hasn't started yet", () => {
    const { decision } = resolveDecision(
      ctx([assignment({ startsAt: new Date("2026-07-01T00:00:00Z") })]),
      NOW
    );
    expect(decision.outcome).toBe("REVIEW_FLOW_FALLBACK");
  });

  it("excludes an assignment whose window already ended", () => {
    const { decision } = resolveDecision(ctx([assignment({ endsAt: new Date("2026-05-01T00:00:00Z") })]), NOW);
    expect(decision.outcome).toBe("REVIEW_FLOW_FALLBACK");
  });

  it("includes an assignment whose window covers now", () => {
    const { decision } = resolveDecision(
      ctx([assignment({ startsAt: new Date("2026-06-01T00:00:00Z"), endsAt: new Date("2026-07-01T00:00:00Z") })]),
      NOW
    );
    expect(decision.outcome).toBe("CAMPAIGN");
  });

  it("excludes a candidate whose attached rule fails", () => {
    const { decision, ruleTrace } = resolveDecision(
      ctx([
        assignment({
          rules: [{ id: "r1", type: "DATE_RANGE", config: { startDate: "2020-01-01", endDate: "2020-01-02" } }],
        }),
      ]),
      NOW
    );
    expect(decision.outcome).toBe("REVIEW_FLOW_FALLBACK");
    expect(ruleTrace).toHaveLength(1);
    expect(ruleTrace[0].passed).toBe(false);
  });

  it("includes a candidate whose attached rule passes", () => {
    const { decision } = resolveDecision(
      ctx([
        assignment({
          campaignId: "in-range",
          rules: [{ id: "r1", type: "DATE_RANGE", config: { startDate: "2026-01-01", endDate: "2026-12-31" } }],
        }),
      ]),
      NOW
    );
    expect(decision.outcome).toBe("CAMPAIGN");
    if (decision.outcome === "CAMPAIGN") expect(decision.campaignId).toBe("in-range");
  });

  it("falls back to the base config when a campaign has no A/B variants", () => {
    const { decision } = resolveDecision(ctx([assignment({ config: { url: "https://base.example.com" } })]), NOW);
    expect(decision.outcome).toBe("CAMPAIGN");
    if (decision.outcome === "CAMPAIGN") {
      expect(decision.variantId).toBeNull();
      expect(decision.config).toEqual({ url: "https://base.example.com" });
    }
  });
});
