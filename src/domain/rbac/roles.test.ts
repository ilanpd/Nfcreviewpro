import { describe, expect, it } from "vitest";
import { roleHasPermission, ALL_ROLES, ALL_PERMISSIONS, ASSIGNABLE_ROLES } from "./roles";

describe("roleHasPermission", () => {
  it("gives OWNER and ADMIN every declared permission", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(roleHasPermission("OWNER", permission)).toBe(true);
      expect(roleHasPermission("ADMIN", permission)).toBe(true);
    }
  });

  it("gives READ_ONLY no permission at all", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(roleHasPermission("READ_ONLY", permission)).toBe(false);
    }
  });

  it("restricts MARKETING to campaign write/assign only", () => {
    expect(roleHasPermission("MARKETING", "campaign:write")).toBe(true);
    expect(roleHasPermission("MARKETING", "campaign:assign")).toBe(true);
    expect(roleHasPermission("MARKETING", "card:write")).toBe(false);
    expect(roleHasPermission("MARKETING", "team:write")).toBe(false);
  });

  it("gives MANAGER campaign + card + feedback, but not team/settings", () => {
    expect(roleHasPermission("MANAGER", "campaign:write")).toBe(true);
    expect(roleHasPermission("MANAGER", "card:write")).toBe(true);
    expect(roleHasPermission("MANAGER", "feedback:resolve")).toBe(true);
    expect(roleHasPermission("MANAGER", "team:write")).toBe(false);
    expect(roleHasPermission("MANAGER", "settings:write")).toBe(false);
  });

  it("restricts OPERATOR to feedback resolution only", () => {
    expect(roleHasPermission("OPERATOR", "feedback:resolve")).toBe(true);
    expect(roleHasPermission("OPERATOR", "campaign:write")).toBe(false);
    expect(roleHasPermission("OPERATOR", "card:write")).toBe(false);
  });

  it("never lets a non-OWNER/ADMIN role manage developers or automation", () => {
    for (const role of ["MARKETING", "MANAGER", "OPERATOR", "READ_ONLY"] as const) {
      expect(roleHasPermission(role, "developers:manage")).toBe(false);
      expect(roleHasPermission(role, "automation:manage")).toBe(false);
    }
  });
});

describe("ASSIGNABLE_ROLES", () => {
  it("never includes OWNER — the only path to OWNER is creating the company", () => {
    expect(ASSIGNABLE_ROLES).not.toContain("OWNER");
  });

  it("covers every role except OWNER", () => {
    const expected = ALL_ROLES.filter((r) => r !== "OWNER");
    expect(new Set(ASSIGNABLE_ROLES)).toEqual(new Set(expected));
  });
});
