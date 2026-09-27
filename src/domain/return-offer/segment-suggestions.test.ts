import { describe, expect, it } from "vitest";
import { REWARD_SUGGESTIONS } from "./segment-suggestions";
import { findForbiddenRewardTerm } from "./compliance";
import { offerInputSchema } from "@/lib/validations/return-offer";

describe("REWARD_SUGGESTIONS (decisão D5)", () => {
  it("tem os cinco segmentos do plano, sem repetir", () => {
    expect(REWARD_SUGGESTIONS.map((s) => s.segment)).toEqual(["Barbearia", "Restaurante", "Pet shop", "Salão", "Loja"]);
  });

  it("nenhuma sugestão cita avaliação (a mesma trava do servidor)", () => {
    for (const s of REWARD_SUGGESTIONS) {
      expect(findForbiddenRewardTerm(s.title)).toBeNull();
      expect(findForbiddenRewardTerm(s.description)).toBeNull();
    }
  });

  it("toda sugestão passa sozinha pela validação real do formulário do brinde", () => {
    for (const s of REWARD_SUGGESTIONS) {
      const result = offerInputSchema.safeParse({ title: s.title, description: s.description, windowDays: 14, cooldownDays: 30, active: false });
      expect(result.success, `${s.segment}: ${JSON.stringify(!result.success && result.error.issues)}`).toBe(true);
    }
  });
});
