import { createHash } from "crypto";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/client-ip";

// We never persist raw IPs (PrivacyByDesign) — only a salted hash, which is
// enough to de-duplicate/rate-limit without being able to re-identify a
// visitor's address later.
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "dev-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/**
 * IP do visitante para limites de taxa e para o hash de privacidade. A regra de CONFIANÇA nos cabeçalhos
 * mora em lib/client-ip.ts (na Vercel, a borda sobrescreve os cabeçalhos; fora dela, nada é confiável
 * sem TRUSTED_PROXY_HOPS). Nunca lemos x-forwarded-for direto: o cliente escreve o que quiser nele.
 */
export async function getRequestIp(): Promise<string> {
  return getClientIp(await headers());
}
