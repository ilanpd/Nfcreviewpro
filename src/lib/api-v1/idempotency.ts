import "server-only";
import { redis } from "@/lib/redis";

/**
 * API Pública v1 (Fase 9) — idempotência real (com replay da resposta),
 * não só deduplicação de efeito colateral como o `claimIdempotencyKey` de
 * fila da Fase 8 (`lib/queues/idempotency.ts`, que só decide "processar ou
 * pular", nunca guarda o que devolver). Mesmo padrão da Stripe: um cliente
 * que reenvia `POST /cards` com o mesmo `Idempotency-Key` depois de uma
 * conexão cair no meio da resposta recebe EXATAMENTE a mesma resposta de
 * volta, nunca um segundo cartão criado.
 *
 * A chave é reivindicada com um placeholder `"PENDING"` (`SET NX`) antes do
 * handler rodar — isso fecha a janela de corrida de duas requisições
 * concorrentes com a mesma chave: a segunda encontra `PENDING` (não `null`),
 * então sabe que a primeira já está em andamento e devolve 409 em vez de
 * executar a mutação de novo.
 */
const TTL_SECONDS = 60 * 60 * 24;
const PENDING = "PENDING" as const;

interface StoredResponse {
  status: number;
  body: unknown;
}

function key(companyId: string, idempotencyKey: string) {
  return `idempotency:v1:api:${companyId}:${idempotencyKey}`;
}

export type ClaimResult = { claimed: true } | { claimed: false; cached: StoredResponse | null };

/** Sem Redis configurado, sempre reivindica (degrada para "sem proteção de
 * idempotência", nunca bloqueia uma chamada de API por infraestrutura de
 * apoio ausente — mesma filosofia do resto do produto). */
export async function claimIdempotencyKey(companyId: string, idempotencyKey: string): Promise<ClaimResult> {
  if (!redis) return { claimed: true };

  try {
    const claimedNow = await redis.set(key(companyId, idempotencyKey), PENDING, { nx: true, ex: TTL_SECONDS });
    if (claimedNow !== null) return { claimed: true };

    const existing = await redis.get<StoredResponse | typeof PENDING>(key(companyId, idempotencyKey));
    if (existing === null || existing === PENDING) return { claimed: false, cached: null };
    return { claimed: false, cached: existing };
  } catch {
    return { claimed: true };
  }
}

export async function storeIdempotentResponse(companyId: string, idempotencyKey: string, response: StoredResponse): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key(companyId, idempotencyKey), response, { ex: TTL_SECONDS });
  } catch {
    // best-effort — pior caso, uma repetição exata desta chave reprocessa em vez de replayar
  }
}
