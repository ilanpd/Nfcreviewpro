import { describe, expect, it } from "vitest";
import { generateCardCode, isWellFormedCardCode } from "./codes";

describe("generateCardCode", () => {
  it("gera 8 caracteres sem os ambíguos 0/o/1/i/l", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCardCode();
      expect(code).toMatch(/^[a-hjkmnp-z2-9]{8}$/);
    }
  });

  it("todo código gerado é aceito pelo validador de rotas públicas", () => {
    for (let i = 0; i < 200; i++) {
      expect(isWellFormedCardCode(generateCardCode())).toBe(true);
    }
  });
});

describe("isWellFormedCardCode", () => {
  it.each(["k7x4qm2a", "PREVIEW", "abcd", "a".repeat(32)])("aceita %s", (code) => {
    expect(isWellFormedCardCode(code)).toBe(true);
  });

  it.each(["", "abc", "a".repeat(33), "../etc/passwd", "k7x4qm2a?x=1", "k7x4 qm2", "k7x4-qm2", "código", "a/b"])(
    "recusa %j",
    (code) => {
      expect(isWellFormedCardCode(code)).toBe(false);
    }
  );
});
