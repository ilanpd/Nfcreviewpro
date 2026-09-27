import { describe, expect, it } from "vitest";
import { computeDisplayStatus, isEligibleStatus } from "./status";

const NOW = new Date("2026-06-15T12:00:00Z");

describe("computeDisplayStatus", () => {
  it("passes through DRAFT/PAUSED/ARCHIVED unchanged, ignoring dates", () => {
    expect(computeDisplayStatus({ status: "DRAFT", startsAt: null, endsAt: null }, NOW)).toBe("DRAFT");
    expect(computeDisplayStatus({ status: "PAUSED", startsAt: null, endsAt: null }, NOW)).toBe("PAUSED");
    expect(computeDisplayStatus({ status: "ARCHIVED", startsAt: null, endsAt: null }, NOW)).toBe("ARCHIVED");
  });

  it("shows ACTIVE with no window as ACTIVE", () => {
    expect(computeDisplayStatus({ status: "ACTIVE", startsAt: null, endsAt: null }, NOW)).toBe("ACTIVE");
  });

  it("shows an ACTIVE campaign whose window hasn't started yet as SCHEDULED", () => {
    const startsAt = new Date("2026-07-01T00:00:00Z");
    expect(computeDisplayStatus({ status: "ACTIVE", startsAt, endsAt: null }, NOW)).toBe("SCHEDULED");
  });

  it("shows an ACTIVE campaign whose window already ended as COMPLETED", () => {
    const endsAt = new Date("2026-05-01T00:00:00Z");
    expect(computeDisplayStatus({ status: "ACTIVE", startsAt: null, endsAt }, NOW)).toBe("COMPLETED");
  });

  it("shows an ACTIVE campaign inside its window as ACTIVE", () => {
    const startsAt = new Date("2026-06-01T00:00:00Z");
    const endsAt = new Date("2026-07-01T00:00:00Z");
    expect(computeDisplayStatus({ status: "ACTIVE", startsAt, endsAt }, NOW)).toBe("ACTIVE");
  });
});

describe("isEligibleStatus", () => {
  it("is true only for ACTIVE — the resolution engine's real gate", () => {
    expect(isEligibleStatus("ACTIVE")).toBe(true);
    expect(isEligibleStatus("DRAFT")).toBe(false);
    expect(isEligibleStatus("PAUSED")).toBe(false);
    expect(isEligibleStatus("ARCHIVED")).toBe(false);
  });
});
