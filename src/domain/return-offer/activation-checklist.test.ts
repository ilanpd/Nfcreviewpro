import { describe, expect, it } from "vitest";
import { buildActivationChecklist, isActivationComplete } from "./activation-checklist";

const NONE = { offerExists: false, hasPin: false, active: false, issued: 0, redeemed: 0 };

describe("buildActivationChecklist", () => {
  it("empresa nova: os 5 passos, nenhum feito", () => {
    const steps = buildActivationChecklist(NONE);
    expect(steps).toHaveLength(5);
    expect(steps.every((s) => !s.done)).toBe(true);
    expect(steps.map((s) => s.id)).toEqual(["offer", "pin", "active", "issued", "redeemed"]);
  });

  it("cada passo acende independente, na ordem certa", () => {
    expect(buildActivationChecklist({ ...NONE, offerExists: true }).map((s) => s.done)).toEqual([true, false, false, false, false]);
    expect(buildActivationChecklist({ ...NONE, offerExists: true, hasPin: true }).map((s) => s.done)).toEqual([true, true, false, false, false]);
    expect(buildActivationChecklist({ ...NONE, offerExists: true, hasPin: true, active: true }).map((s) => s.done)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it("emitido não implica resgatado, e vice-versa nunca acontece sozinho na prática mas a função não assume isso", () => {
    const issuedOnly = buildActivationChecklist({ ...NONE, issued: 5, redeemed: 0 });
    expect(issuedOnly.find((s) => s.id === "issued")!.done).toBe(true);
    expect(issuedOnly.find((s) => s.id === "redeemed")!.done).toBe(false);
  });

  it("tudo feito", () => {
    const steps = buildActivationChecklist({ offerExists: true, hasPin: true, active: true, issued: 3, redeemed: 1 });
    expect(isActivationComplete(steps)).toBe(true);
  });

  it("isActivationComplete é falso enquanto faltar um passo", () => {
    expect(isActivationComplete(buildActivationChecklist(NONE))).toBe(false);
    expect(isActivationComplete(buildActivationChecklist({ offerExists: true, hasPin: true, active: true, issued: 1, redeemed: 0 }))).toBe(false);
  });
});
