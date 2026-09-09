import { redis } from "@/lib/redis";
import { isChaosActive } from "@/lib/chaos/flags";
import { recordCacheEvent } from "@/lib/observability/cache-metrics";

// Three independently-invalidated keys instead of one per-card blob: if
// company branding lived inside the per-card entry, editing a logo on a
// company with 500 cards would mean deleting 500 keys. Splitting company
// info and campaigns into their own per-company keys makes every settings
// or campaign edit exactly one DEL, regardless of card count.
const TTL_SECONDS = { card: 300, company: 300, campaigns: 60, organizationCampaigns: 60 } as const;

const cacheKey = {
  card: (uniqueCode: string) => `resolve:card:v1:${uniqueCode}`,
  company: (companyId: string) => `resolve:company:v1:${companyId}`,
  campaigns: (companyId: string) => `resolve:campaigns:v1:${companyId}`,
  // Separate from the per-company `campaigns` key above: an org-wide
  // campaign is invalidated once per edit regardless of how many companies
  // (franchise units) belong to the organization, instead of having to
  // enumerate and invalidate every member company's own cache entry.
  organizationCampaigns: (organizationId: string) => `resolve:org-campaigns:v1:${organizationId}`,
};

interface CacheResult<T> {
  value: T;
  fromCache: boolean;
}

/**
 * Degrades to Postgres-only on ANY Redis problem — not just when `redis` is
 * null (no Upstash env vars, same condition lib/rate-limit.ts degrades
 * under), but also a configured-and-unreachable Redis (network blip, wrong
 * credentials, an Upstash outage). A cache being down must never take the
 * public redirect page down with it, so every Redis call is wrapped and
 * failures are logged, not thrown.
 *
 * The `NODE_ENV !== "production"` guard around the Chaos Mode check below
 * means production pays exactly zero extra cost (a single string compare,
 * never a Redis round-trip) to support a feature that's hard-disabled in
 * production anyway — see `lib/chaos/flags.ts` and ADR-035.
 */
export async function cachedOrLoad<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<CacheResult<T>> {
  const chaosRedisDown = process.env.NODE_ENV !== "production" && (await isChaosActive("redisDown"));

  if (redis && !chaosRedisDown) {
    try {
      const cached = await redis.get<T>(key);
      if (cached !== null) {
        recordCacheEvent("resolution", "hit");
        return { value: cached, fromCache: true };
      }
      recordCacheEvent("resolution", "miss");
    } catch (err) {
      console.error("[resolution-engine] redis GET failed, falling back to Postgres", err);
    }
  }

  const value = await loader();

  if (redis && !chaosRedisDown && value !== null && value !== undefined) {
    redis.set(key, value, { ex: ttlSeconds }).catch((err) => {
      console.error("[resolution-engine] redis SET failed", err);
    });
  }

  return { value, fromCache: false };
}

export const resolutionCacheKeys = cacheKey;
export const resolutionCacheTtl = TTL_SECONDS;

// Callers `await` these from dashboard mutations (e.g. updateCard) — a
// Redis hiccup must never fail an otherwise-successful Postgres write, so
// failures are swallowed (logged) rather than thrown. Worst case, a cache
// entry survives one extra TTL window instead of being evicted immediately.
async function safeDel(key: string) {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (err) {
    console.error(`[resolution-engine] redis DEL failed for ${key}`, err);
  }
}

export function invalidateCard(uniqueCode: string) {
  return safeDel(cacheKey.card(uniqueCode));
}

export function invalidateCompany(companyId: string) {
  return safeDel(cacheKey.company(companyId));
}

export function invalidateCompanyCampaigns(companyId: string) {
  return safeDel(cacheKey.campaigns(companyId));
}

/** Called whenever an ORGANIZATION-scope assignment (or the campaign/rules
 * behind it) changes — see ADR-016. Every company under the organization
 * reads this same key, so one DEL here covers the whole franchise instead
 * of enumerating member companies. */
export function invalidateOrganizationCampaigns(organizationId: string) {
  return safeDel(cacheKey.organizationCampaigns(organizationId));
}
