import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

// In-memory fallback so the app still runs (with weaker guarantees) when
// Upstash env vars are absent, e.g. local dev without a Redis instance.
const memoryHits = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = memoryHits.get(key);
  if (!entry || entry.resetAt < now) {
    memoryHits.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }
  entry.count += 1;
  const success = entry.count <= limit;
  return { success, remaining: Math.max(0, limit - entry.count) };
}

type LimiterName = "publicCard" | "rating" | "feedback" | "api" | "queueRouting" | "apiV1" | "demoScenario";

const LIMITS: Record<LimiterName, { limit: number; windowSeconds: number }> = {
  publicCard: { limit: 60, windowSeconds: 60 },
  rating: { limit: 10, windowSeconds: 60 },
  feedback: { limit: 5, windowSeconds: 60 },
  api: { limit: 120, windowSeconds: 60 },
  // API Pública v1 (Fase 9) — por ApiKey (não por IP, ao contrário dos
  // limiters públicos acima), generoso o bastante para um SDK/integração
  // real fazer chamadas legítimas em lote sem tropeçar no limite.
  apiV1: { limit: 300, windowSeconds: 60 },
  // Segurança operacional (Fase 8) — protege o Queue Engine (BullMQ,
  // chamadas externas de webhook) de uma única organização, mesmo que
  // legítima (um pico real de tráfego), saturando as filas compartilhadas.
  // Generoso o bastante para nunca incomodar uma operação real: 500
  // eventos/min é bem acima do que uma rede de restaurantes gera em uso
  // normal. Nunca afeta o redirecionamento em si nem a gravação em
  // `EventLog` — só o roteamento para filas. Ver ADR-032.
  queueRouting: { limit: 500, windowSeconds: 60 },
  // Demo OS (Fase 12) — `/demo` é deliberadamente público, sem cadastro
  // ("funciona sem cadastro" é um requisito, não um descuido). Rodar um
  // cenário grava linhas reais (RedirectLog/RatingEvent) na empresa fixa de
  // demonstração — por IP, generoso o bastante para uma demonstração real
  // ao vivo, apertado o bastante para não virar uma via de escrita em
  // massa não autenticada.
  demoScenario: { limit: 10, windowSeconds: 60 },
};

const limiters = new Map<LimiterName, Ratelimit>();

function getLimiter(name: LimiterName): Ratelimit | null {
  if (!redis) return null;
  if (!limiters.has(name)) {
    const { limit, windowSeconds } = LIMITS[name];
    limiters.set(
      name,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
        prefix: `ratelimit:${name}`,
      })
    );
  }
  return limiters.get(name)!;
}

export async function rateLimit(name: LimiterName, identifier: string) {
  const { limit, windowSeconds } = LIMITS[name];
  const limiter = getLimiter(name);
  if (!limiter) {
    return memoryLimit(`${name}:${identifier}`, limit, windowSeconds * 1000);
  }

  // A configured-but-unreachable Redis (network blip, wrong credentials, an
  // Upstash outage) must degrade to the in-memory limiter, not take every
  // caller down with it — same reasoning as resolution-engine/cache.ts.
  try {
    const { success, remaining } = await limiter.limit(identifier);
    return { success, remaining };
  } catch (err) {
    console.error(`[rate-limit] Redis limiter "${name}" failed, falling back to in-memory`, err);
    return memoryLimit(`${name}:${identifier}`, limit, windowSeconds * 1000);
  }
}
