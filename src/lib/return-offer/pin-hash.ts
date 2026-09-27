import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Hash do PIN da loja (ADR-079). Um PIN de 4 dígitos tem só 10 mil valores, então
 * o hash sozinho não protege contra quem tiver o banco: por isso o PIN passa por
 * um HMAC com um segredo do servidor (`RETURN_PIN_SECRET`, fora do banco) antes
 * do scrypt com sal aleatório. Sem o segredo, um vazamento do banco não permite
 * testar os 10 mil PINs offline.
 *
 * Em produção, sem o segredo, falha em vez de usar um valor padrão: um PIN
 * protegido por um segredo conhecido não é protegido.
 */

const VERSION = "s1";

function pepper(): string {
  const secret = process.env.RETURN_PIN_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("RETURN_PIN_SECRET não está definido: o PIN da loja não pode ser guardado sem ele.");
  }
  return "segredo-somente-para-desenvolvimento";
}

function derive(pin: string, salt: Buffer): Buffer {
  const keyed = createHmac("sha256", pepper()).update(pin).digest();
  return scryptSync(keyed, salt, 32);
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  return `${VERSION}$${salt.toString("base64url")}$${derive(pin, salt).toString("base64url")}`;
}

/** Comparação em tempo constante. Hash ausente ou malformado nunca confere. */
export function verifyPin(pin: string, stored: string | null): boolean {
  if (!stored) return false;
  const [version, saltPart, hashPart] = stored.split("$");
  if (version !== VERSION || !saltPart || !hashPart) return false;
  const expected = Buffer.from(hashPart, "base64url");
  const actual = derive(pin, Buffer.from(saltPart, "base64url"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
