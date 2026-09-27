/**
 * Código do brinde (ADR-078). O código É o brinde: vale em qualquer aparelho e
 * é o que o cliente mostra ou digita, como um cupom de papel. Puro: quem
 * fornece os bytes aleatórios é o chamador (`crypto.randomBytes` no serviço).
 *
 * Alfabeto de 28 caracteres, sem 0, 1, I, L e O (confundem com outros
 * caracteres quando lidos em voz alta ou digitados no celular) e sem vogais
 * (o código nunca forma palavra, então nunca forma palavrão). 28^6 é cerca de
 * 481 milhões de códigos por empresa; adivinhar um exige ainda o PIN da loja.
 */
export const VOUCHER_CODE_ALPHABET = "23456789BCDFGHJKMNPQRSTVWXYZ";
export const VOUCHER_CODE_LENGTH = 6;

// Maior múltiplo de 28 que cabe em um byte: bytes acima disso são descartados
// para o sorteio não favorecer os primeiros caracteres do alfabeto.
const UNBIASED_LIMIT = 256 - (256 % VOUCHER_CODE_ALPHABET.length);

/** Gera um código. `randomBytes(n)` precisa devolver n bytes aleatórios seguros. */
export function generateVoucherCode(randomBytes: (n: number) => Uint8Array): string {
  let code = "";
  while (code.length < VOUCHER_CODE_LENGTH) {
    const bytes = randomBytes(VOUCHER_CODE_LENGTH * 2);
    for (const byte of bytes) {
      if (byte >= UNBIASED_LIMIT) continue;
      code += VOUCHER_CODE_ALPHABET[byte % VOUCHER_CODE_ALPHABET.length];
      if (code.length === VOUCHER_CODE_LENGTH) break;
    }
  }
  return code;
}

/**
 * Aceita o que o cliente digita: minúsculas, espaços e o hífen do formato
 * K7X-4QM. Devolve o código canônico (6 caracteres do alfabeto) ou `null`.
 */
export function normalizeVoucherCode(input: string): string | null {
  const code = input.replace(/[\s\-_.]/g, "").toUpperCase();
  if (code.length !== VOUCHER_CODE_LENGTH) return null;
  for (const char of code) if (!VOUCHER_CODE_ALPHABET.includes(char)) return null;
  return code;
}

/** K7X4QM → K7X-4QM, o formato mostrado ao cliente. */
export function formatVoucherCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}
