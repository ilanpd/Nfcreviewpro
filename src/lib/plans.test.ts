import { describe, expect, it } from "vitest";
import {
  canCreateCard,
  cardLimitForPlan,
  planForStripePriceId,
  planHasFeature,
  minimumPlanForFeature,
  teamLimitForPlan,
  canInviteTeamMember,
} from "./plans";

describe("cardLimitForPlan", () => {
  it("caps STARTER at 1 card", () => {
    expect(cardLimitForPlan("STARTER")).toBe(1);
  });

  it("caps PRO at 10 cards", () => {
    expect(cardLimitForPlan("PRO")).toBe(10);
  });

  it("leaves BUSINESS unlimited", () => {
    expect(cardLimitForPlan("BUSINESS")).toBeNull();
  });
});

describe("canCreateCard", () => {
  it("blocks a STARTER company at its 1-card limit", () => {
    expect(canCreateCard("STARTER", 0)).toBe(true);
    expect(canCreateCard("STARTER", 1)).toBe(false);
  });

  it("blocks a PRO company only once it reaches 10 cards", () => {
    expect(canCreateCard("PRO", 9)).toBe(true);
    expect(canCreateCard("PRO", 10)).toBe(false);
  });

  it("never blocks a BUSINESS company no matter the count", () => {
    expect(canCreateCard("BUSINESS", 0)).toBe(true);
    expect(canCreateCard("BUSINESS", 100_000)).toBe(true);
  });
});

describe("planForStripePriceId", () => {
  // STRIPE_PRICE_* só existe de verdade em produção — a leitura de env
  // acontece uma vez, na carga do módulo, então este teste não tenta mockar
  // isso (mudar process.env aqui não afetaria o valor já capturado). O que
  // importa testar é a garantia de sempre falhar fechado: um id de Price que
  // não corresponde a nenhum plano configurado nunca deve travar nem
  // inventar um plano — regressão do bug de auto-serviço de upgrade
  // encontrado em 11/09/2026 (troca de plano pelo Portal da Stripe nunca
  // refletia de volta no banco).
  it("returns null for a price id that matches no configured plan", () => {
    expect(planForStripePriceId("price_that_does_not_exist_anywhere")).toBeNull();
  });
});

// Fase 20 — entitlements por plano. STARTER nunca deveria acidentalmente
// ganhar acesso a um recurso pago por um erro de digitação no Set de
// PLAN_FEATURES; estes testes travam o contrato real vendido em cada tier.
describe("planHasFeature", () => {
  it("gives STARTER none of the paid features", () => {
    expect(planHasFeature("STARTER", "campaigns")).toBe(false);
    expect(planHasFeature("STARTER", "table_map")).toBe(false);
    expect(planHasFeature("STARTER", "analytics_full")).toBe(false);
    expect(planHasFeature("STARTER", "csv_export")).toBe(false);
    expect(planHasFeature("STARTER", "automation")).toBe(false);
    expect(planHasFeature("STARTER", "multi_branch")).toBe(false);
    expect(planHasFeature("STARTER", "white_label")).toBe(false);
    expect(planHasFeature("STARTER", "api_access")).toBe(false);
  });

  it("gives PRO everything except the BUSINESS-exclusive features", () => {
    expect(planHasFeature("PRO", "campaigns")).toBe(true);
    expect(planHasFeature("PRO", "table_map")).toBe(true);
    expect(planHasFeature("PRO", "analytics_full")).toBe(true);
    expect(planHasFeature("PRO", "csv_export")).toBe(true);
    expect(planHasFeature("PRO", "automation")).toBe(true);
    expect(planHasFeature("PRO", "multi_branch")).toBe(false);
    expect(planHasFeature("PRO", "white_label")).toBe(false);
    expect(planHasFeature("PRO", "api_access")).toBe(false);
  });

  it("gives BUSINESS every feature", () => {
    const features = ["campaigns", "table_map", "analytics_full", "csv_export", "automation", "multi_branch", "white_label", "api_access"] as const;
    for (const feature of features) {
      expect(planHasFeature("BUSINESS", feature)).toBe(true);
    }
  });
});

describe("return_offer e messages_inbox (ADR-078)", () => {
  it("estão nos três planos: é o que o Starter vende, e Pro e Business não o perdem", () => {
    for (const plan of ["STARTER", "PRO", "BUSINESS"] as const) {
      expect(planHasFeature(plan, "return_offer")).toBe(true);
      expect(planHasFeature(plan, "messages_inbox")).toBe(true);
    }
  });

  it("o plano mínimo é o Starter", () => {
    expect(minimumPlanForFeature("return_offer")).toBe("STARTER");
  });
});

describe("minimumPlanForFeature", () => {
  it("finds PRO as the cheapest plan with campaigns", () => {
    expect(minimumPlanForFeature("campaigns")).toBe("PRO");
  });

  it("finds BUSINESS as the cheapest plan with multi_branch", () => {
    expect(minimumPlanForFeature("multi_branch")).toBe("BUSINESS");
  });
});

describe("teamLimitForPlan / canInviteTeamMember", () => {
  it("caps STARTER at a solo owner", () => {
    expect(teamLimitForPlan("STARTER")).toBe(1);
    expect(canInviteTeamMember("STARTER", 1)).toBe(false);
  });

  it("caps PRO at 5 members", () => {
    expect(teamLimitForPlan("PRO")).toBe(5);
    expect(canInviteTeamMember("PRO", 4)).toBe(true);
    expect(canInviteTeamMember("PRO", 5)).toBe(false);
  });

  it("never blocks BUSINESS", () => {
    expect(teamLimitForPlan("BUSINESS")).toBeNull();
    expect(canInviteTeamMember("BUSINESS", 1000)).toBe(true);
  });
});
