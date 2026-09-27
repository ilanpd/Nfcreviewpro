import { describe, expect, it } from "vitest";
import { buildPublicRatingResult } from "./public-result";

describe("buildPublicRatingResult (ADR-075)", () => {
  const input = { ratingEventId: "evt_1", googleReviewUrl: "https://g.page/r/abc/review" };

  it("devolve exatamente o evento e o link do Google, nada mais", () => {
    const result = buildPublicRatingResult(input);
    expect(Object.keys(result).sort()).toEqual(["googleReviewUrl", "ratingEventId"]);
    expect(result).toEqual(input);
  });

  it("não tem como depender da nota: o construtor não recebe `stars`", () => {
    // Mesmo que alguém passe campos extras, eles não entram no resultado.
    const withExtra = buildPublicRatingResult({ ...input, stars: 1 } as typeof input);
    expect(withExtra).toEqual(buildPublicRatingResult({ ...input, stars: 5 } as typeof input));
  });
});
