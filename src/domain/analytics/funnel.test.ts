import { describe, expect, it } from "vitest";
import { buildReviewFunnel } from "./funnel";

/**
 * Auditoria de 28/09/2026: o funil tinha 5 estágios (dois deles — "Clique
 * (avaliação enviada)" e "Avaliação publicada" — só faziam sentido na tela de
 * estrelas que a ADR-080 removeu). Reduzido a 3, honestos sobre o que este
 * produto consegue medir hoje.
 */
describe("buildReviewFunnel", () => {
  it("tem exatamente 3 estágios, nesta ordem", () => {
    const stages = buildReviewFunnel({ approaches: 10, pageOpens: 8, conversions: 4 });
    expect(stages.map((s) => s.key)).toEqual(["APPROACH", "PAGE_OPENED", "CONVERSION"]);
  });

  it("o primeiro estágio nunca tem dropoff (não há um anterior a comparar)", () => {
    const [first] = buildReviewFunnel({ approaches: 10, pageOpens: 8, conversions: 4 });
    expect(first.dropoffFromPrevious).toBeNull();
  });

  it("dropoff é a razão pro estágio anterior, em percentual", () => {
    const stages = buildReviewFunnel({ approaches: 100, pageOpens: 50, conversions: 25 });
    expect(stages[1].dropoffFromPrevious).toBe(50);
    expect(stages[2].dropoffFromPrevious).toBe(50);
  });

  it("estágio anterior zerado nunca divide por zero — dropoff honesto em 0, não NaN/Infinity", () => {
    const stages = buildReviewFunnel({ approaches: 0, pageOpens: 0, conversions: 0 });
    expect(stages[1].dropoffFromPrevious).toBe(0);
    expect(stages[2].dropoffFromPrevious).toBe(0);
  });

  it("nunca menciona estrela ou avaliação nos rótulos — não é mais o fluxo antigo", () => {
    const stages = buildReviewFunnel({ approaches: 1, pageOpens: 1, conversions: 1 });
    for (const stage of stages) expect(stage.label).not.toMatch(/estrela|avalia/i);
  });
});
