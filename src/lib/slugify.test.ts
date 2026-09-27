import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("lowercases and dashes spaces", () => {
    expect(slugify("Restaurante Sabor & Arte")).toBe("restaurante-sabor-arte");
  });

  it("strips accents instead of dropping the whole word", () => {
    expect(slugify("Café Confeitaria")).toBe("cafe-confeitaria");
  });

  it("trims leading/trailing dashes left over from stripped punctuation", () => {
    expect(slugify("--Loja!!--")).toBe("loja");
  });

  it("falls back to the given default when nothing usable remains", () => {
    expect(slugify("!!!", { fallback: "empresa" })).toBe("empresa");
  });

  it("respects maxLength when given", () => {
    expect(slugify("um nome de empresa bem comprido", { maxLength: 10 })).toHaveLength(10);
  });
});
