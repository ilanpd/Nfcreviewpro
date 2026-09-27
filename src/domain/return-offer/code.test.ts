import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  VOUCHER_CODE_ALPHABET,
  VOUCHER_CODE_LENGTH,
  formatVoucherCode,
  generateVoucherCode,
  normalizeVoucherCode,
} from "./code";

describe("alfabeto do código do brinde", () => {
  it("não tem 0, 1, I, L, O nem vogais, e não repete caractere", () => {
    for (const char of "01ILOAEU") expect(VOUCHER_CODE_ALPHABET).not.toContain(char);
    expect(new Set(VOUCHER_CODE_ALPHABET).size).toBe(VOUCHER_CODE_ALPHABET.length);
    expect(VOUCHER_CODE_ALPHABET).toHaveLength(28);
  });

  it("o código de exemplo dos materiais (K7X-4QM) é um código válido", () => {
    expect(normalizeVoucherCode("K7X-4QM")).toBe("K7X4QM");
  });
});

describe("generateVoucherCode", () => {
  it("usa os bytes na ordem e só os caracteres do alfabeto", () => {
    const fixed = () => new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(generateVoucherCode(fixed)).toBe(VOUCHER_CODE_ALPHABET.slice(0, 6));
  });

  it("descarta bytes que enviesariam o sorteio (acima de 251)", () => {
    // 252..255 seriam mapeados para os 4 primeiros caracteres se não fossem descartados.
    const batches = [new Uint8Array([255, 254, 253, 252, 255, 252, 0, 0, 0, 0, 0, 0]), new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])];
    let call = 0;
    const code = generateVoucherCode(() => batches[Math.min(call++, batches.length - 1)]);
    expect(code).toBe(VOUCHER_CODE_ALPHABET[0].repeat(6));
  });

  it("pede mais bytes quando os primeiros não bastam", () => {
    const calls: number[] = [];
    const scarce = (n: number) => {
      calls.push(n);
      return new Uint8Array(n).fill(calls.length === 1 ? 255 : 3);
    };
    const code = generateVoucherCode(scarce);
    expect(calls.length).toBe(2);
    expect(code).toBe(VOUCHER_CODE_ALPHABET[3].repeat(6));
  });

  it("com aleatoriedade real: 5.000 códigos válidos, de 6 caracteres, sem repetição visível", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const code = generateVoucherCode((n) => randomBytes(n));
      expect(code).toHaveLength(VOUCHER_CODE_LENGTH);
      expect(normalizeVoucherCode(code)).toBe(code);
      seen.add(code);
    }
    // 481 milhões de possibilidades: uma colisão em 5.000 sorteios é improvável demais para ser sorte.
    expect(seen.size).toBeGreaterThan(4990);
  });
});

describe("normalizeVoucherCode", () => {
  it("aceita minúsculas, espaços e hífen", () => {
    expect(normalizeVoucherCode("k7x 4qm")).toBe("K7X4QM");
    expect(normalizeVoucherCode(" k7x-4qm ")).toBe("K7X4QM");
    expect(normalizeVoucherCode("K7X.4QM")).toBe("K7X4QM");
  });

  it.each(["", "K7X4Q", "K7X4QMM", "K7X-4Q0", "K7X-4QI", "K7X-4QL", "K7X-4QO", "K7X-4QA", "K7X-4Q!"])("recusa %j", (input) => {
    expect(normalizeVoucherCode(input)).toBeNull();
  });
});

describe("formatVoucherCode", () => {
  it("mostra 3 + 3 com hífen", () => {
    expect(formatVoucherCode("K7X4QM")).toBe("K7X-4QM");
  });

  it("é a inversa de normalizeVoucherCode", () => {
    expect(normalizeVoucherCode(formatVoucherCode("K7X4QM"))).toBe("K7X4QM");
  });
});
