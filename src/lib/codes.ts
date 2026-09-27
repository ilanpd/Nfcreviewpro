import { randomBytes } from "crypto";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/i/l — avoids ambiguous codes on printed cards

/** Short, URL-safe, human-legible code used in /r/[code]. */
export function generateCardCode(length = 8): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

/**
 * Formato aceito em rotas públicas que recebem um código de cartão (ex.: o
 * QR sob demanda). Deliberadamente mais frouxo que o alfabeto de
 * `generateCardCode`: serve para barrar lixo e caracteres de caminho, não para
 * decidir se o cartão existe (quem decide é o banco, em `/r/[code]`).
 */
export function isWellFormedCardCode(code: string): boolean {
  return /^[A-Za-z0-9]{4,32}$/.test(code);
}
