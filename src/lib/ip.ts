import { createHash } from "crypto";
import { headers } from "next/headers";

// We never persist raw IPs (PrivacyByDesign) — only a salted hash, which is
// enough to de-duplicate/rate-limit without being able to re-identify a
// visitor's address later.
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "dev-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export async function getRequestIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "0.0.0.0";
}
