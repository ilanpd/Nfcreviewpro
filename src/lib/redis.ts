import { Redis } from "@upstash/redis";

declare global {
  var redisGlobal: Redis | undefined;
}

function createRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Redis is optional in local dev — rate limiting and caching degrade
// gracefully (see lib/rate-limit.ts) when it isn't configured.
export const redis = globalThis.redisGlobal ?? createRedis();

if (process.env.NODE_ENV !== "production") {
  globalThis.redisGlobal = redis ?? undefined;
}
