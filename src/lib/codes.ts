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
