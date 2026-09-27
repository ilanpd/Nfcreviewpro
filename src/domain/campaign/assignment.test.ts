import { describe, expect, it } from "vitest";
import { scopeSpecificityRank, validateScopeTarget } from "./assignment";

describe("scopeSpecificityRank", () => {
  it("orders CARD > ZONE > BRANCH > COMPANY > ORGANIZATION", () => {
    expect(scopeSpecificityRank("CARD")).toBeGreaterThan(scopeSpecificityRank("ZONE"));
    expect(scopeSpecificityRank("ZONE")).toBeGreaterThan(scopeSpecificityRank("BRANCH"));
    expect(scopeSpecificityRank("BRANCH")).toBeGreaterThan(scopeSpecificityRank("COMPANY"));
    expect(scopeSpecificityRank("COMPANY")).toBeGreaterThan(scopeSpecificityRank("ORGANIZATION"));
  });
});

describe("validateScopeTarget", () => {
  it("accepts COMPANY scope with no target fields set", () => {
    expect(validateScopeTarget("COMPANY", {})).toBeNull();
  });

  it("rejects COMPANY scope carrying a stray target field", () => {
    expect(validateScopeTarget("COMPANY", { cardId: "c1" })).not.toBeNull();
  });

  it("accepts CARD scope with exactly a cardId", () => {
    expect(validateScopeTarget("CARD", { cardId: "c1" })).toBeNull();
  });

  it("rejects CARD scope missing cardId", () => {
    expect(validateScopeTarget("CARD", {})).not.toBeNull();
  });

  it("rejects CARD scope carrying an extra field alongside cardId", () => {
    expect(validateScopeTarget("CARD", { cardId: "c1", zoneId: "z1" })).not.toBeNull();
  });

  it("accepts ZONE scope with exactly a zoneId", () => {
    expect(validateScopeTarget("ZONE", { zoneId: "z1" })).toBeNull();
  });

  it("accepts BRANCH scope with exactly a branchId", () => {
    expect(validateScopeTarget("BRANCH", { branchId: "b1" })).toBeNull();
  });

  it("accepts ORGANIZATION scope with exactly an organizationId", () => {
    expect(validateScopeTarget("ORGANIZATION", { organizationId: "o1" })).toBeNull();
  });

  it("rejects ORGANIZATION scope missing organizationId", () => {
    expect(validateScopeTarget("ORGANIZATION", {})).not.toBeNull();
  });
});
