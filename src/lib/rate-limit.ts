import { Ratelimit } from "@upstash/ratelimit";
import { NextResponse } from "next/server";
import { redis } from "./redis";

// In-memory fallback so the app still runs (with weaker guarantees) when
// Upstash env vars are absent, e.g. local dev without a Redis instance.
const memoryHits = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  limit: number;
  /** Quando a janela zera (ms desde 1970). */
  reset: number;
}

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  // limpeza simples para o mapa nao crescer sem fim numa instancia longa
  if (memoryHits.size > 5000) for (const [k, v] of memoryHits) if (v.resetAt < now) memoryHits.delete(k);
  const entry = memoryHits.get(key);
  if (!entry || entry.resetAt < now) {
    memoryHits.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, limit, reset: now + windowMs };
  }
  entry.count += 1;
  const success = entry.count <= limit;
  return { success, remaining: Math.max(0, limit - entry.count), limit, reset: entry.resetAt };
}

type LimiterName =
  | "publicCard"
  | "rating"
  | "feedback"
  | "api"
  | "queueRouting"
  | "apiV1"
  | "demoScenario"
  | "authMutation"
  | "voucherLookup"
  | "voucherRedeem"
  | "personalLinkRecovery"
  | "contact"
  | "storeCheckout"
  | "apiRead"
  | "authMutationIp"
  | "publicData"
  | "publicImage"
  | "personalLink"
  | "exportHeavy";

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
  // Segurança (Auditoria Nível Bilionário, 11/09/2026) — antes desta
  // entrada, NENHUMA rota de mutação autenticada do dashboard tinha limite
  // de taxa (só as rotas públicas tinham). Aplicado uma vez, no middleware,
  // a toda rota `/api/*` que muta dado (ver src/middleware.ts) — nunca
  // depende de cada rota individualmente lembrar de chamar isto. Por
  // usuário (não por IP) sempre que autenticado, generoso o bastante para
  // uso legítimo intenso (editar várias campanhas em sequência), apertado
  // o bastante para travar um script martelando uma rota.
  authMutation: { limit: 120, windowSeconds: 60 },
  // Retorno (ADR-079) — rotas públicas do brinde, por IP. O código tem 481
  // milhões de combinações e o resgate exige o PIN, mas tentativa em massa
  // não deve nem chegar ao banco. Consulta: o cliente digita o código de vez
  // em quando. Resgate: uma tablet de balcão faz poucos por minuto.
  voucherLookup: { limit: 15, windowSeconds: 60 },
  voucherRedeem: { limit: 10, windowSeconds: 60 },
  // "Perdi o link pessoal" (ADR-080) — por IP. Sem limite por e-mail: a rota
  // nunca revela se o e-mail existe, então nem faria sentido travar por ele.
  personalLinkRecovery: { limit: 5, windowSeconds: 300 },
  // /contato (C9/F6) — por IP, mesma ordem de grandeza de `feedback`: uma
  // pessoa de verdade manda uma mensagem de cada vez, nunca em rajada.
  contact: { limit: 5, windowSeconds: 300 },
  // Checkout público da Loja (C15) — por IP. Cada chamada grava um StoreOrder
  // PENDING_PAYMENT e abre uma sessão no Stripe, sem exigir conta: o limite
  // geral de `/api/*` (authMutation, 120/min) é folgado demais pra isso e um
  // script encheria a fila de pedidos do admin. Um comprador real fecha 1
  // pedido (2-3 se errar o CPF); uma rede com vários compradores atrás do mesmo
  // IP ainda cabe folgada em 10 a cada 5 minutos.
  storeCheckout: { limit: 10, windowSeconds: 300 },
  // Auditoria de ciberseguranca (11/10/2026, ADR-096) — antes destas entradas, so as MUTACOES tinham
  // teto geral; leituras da API, as rotas publicas caras e as exportacoes ficavam livres.
  // Leitura geral, por usuario (ou IP): folgada, o painel faz varias chamadas por tela.
  apiRead: { limit: 300, windowSeconds: 60 },
  // Teto POR IP para mutacoes autenticadas, alem do teto por usuario: quem cria varias contas
  // para multiplicar o limite continua preso ao mesmo IP. Folgado para um escritorio inteiro atras do mesmo IP.
  authMutationIp: { limit: 600, windowSeconds: 60 },
  // Dados da demonstracao (sem login, com consulta ao banco: heatmap, linha do tempo...).
  publicData: { limit: 60, windowSeconds: 60 },
  // QR e imagens da marca, geradas na hora (CPU), por IP.
  publicImage: { limit: 120, windowSeconds: 60 },
  // Link pessoal (/api/meu-cartao/<token>): o token vai no caminho; nunca deixar adivinhar em massa.
  personalLink: { limit: 30, windowSeconds: 60 },
  // Exportacoes e PDFs (CSV, planilhas, arquivos da grafica): pesam no banco e na CPU, 6 por minuto por usuario.
  exportHeavy: { limit: 6, windowSeconds: 60 },
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

export async function rateLimit(name: LimiterName, identifier: string): Promise<RateLimitResult> {
  const { limit, windowSeconds } = LIMITS[name];
  const limiter = getLimiter(name);
  if (!limiter) {
    return memoryLimit(`${name}:${identifier}`, limit, windowSeconds * 1000);
  }

  // A configured-but-unreachable Redis (network blip, wrong credentials, an
  // Upstash outage) must degrade to the in-memory limiter, not take every
  // caller down with it — same reasoning as resolution-engine/cache.ts.
  try {
    const { success, remaining, reset } = await limiter.limit(identifier);
    return { success, remaining, limit, reset };
  } catch (err) {
    console.error(`[rate-limit] Redis limiter "${name}" failed, falling back to in-memory`, err);
    return memoryLimit(`${name}:${identifier}`, limit, windowSeconds * 1000);
  }
}

/** Cabeçalhos padrão de limite (`RateLimit-*`) e, quando estourou, `Retry-After` em segundos. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const resetSeconds = Math.max(0, Math.ceil((result.reset - Date.now()) / 1000));
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "RateLimit-Reset": String(resetSeconds),
  };
  if (!result.success) headers["Retry-After"] = String(Math.max(1, resetSeconds));
  return headers;
}

/** 429 com os cabeçalhos certos, para o middleware e para as rotas. */
export function tooManyRequestsResponse(result: RateLimitResult, message = "Muitas requisições, tente novamente em instantes."): NextResponse {
  return NextResponse.json({ error: message }, { status: 429, headers: rateLimitHeaders(result) });
}

// ---------------------------------------------------------------------------
// Concorrência: quantas execuções simultâneas de uma operação cara por usuário.
// O limite de taxa conta requisições por minuto; ele não impede 6 exportações
// pesadas começando ao mesmo tempo. Compartilhado via Redis (INCR/DECR com
// validade, para um contador nunca ficar preso se uma função morrer no meio).
// ---------------------------------------------------------------------------
const inflightMemory = new Map<string, number>();

export type ConcurrencyResult<T> = { ok: true; value: T } | { ok: false };

export async function withConcurrencyLimit<T>(name: string, id: string, max: number, fn: () => Promise<T>, ttlSeconds = 90): Promise<ConcurrencyResult<T>> {
  const key = `concurrency:${name}:${id}`;
  let usedRedis = false;

  if (redis) {
    try {
      const n = await redis.incr(key);
      await redis.expire(key, ttlSeconds);
      usedRedis = true;
      if (n > max) {
        await redis.decr(key);
        return { ok: false };
      }
    } catch (err) {
      console.error("[rate-limit] Redis indisponivel para o limite de concorrencia, usando memoria", err);
    }
  }
  if (!usedRedis) {
    const n = (inflightMemory.get(key) ?? 0) + 1;
    if (n > max) return { ok: false };
    inflightMemory.set(key, n);
  }

  try {
    return { ok: true, value: await fn() };
  } finally {
    if (usedRedis && redis) {
      await redis.decr(key).catch(() => {});
    } else {
      const n = (inflightMemory.get(key) ?? 1) - 1;
      if (n <= 0) inflightMemory.delete(key);
      else inflightMemory.set(key, n);
    }
  }
}
