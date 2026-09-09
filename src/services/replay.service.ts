import "server-only";
import { prisma } from "@/lib/prisma";
import { replayExistingEvent } from "@/lib/event-bus";
import type { DomainEvent, DomainEventType } from "@/domain/events/types";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Replay Engine (Fase 8) — duas capacidades deliberadamente separadas:
 *
 * 1. `reconstructSequence` — SOMENTE LEITURA. Devolve a sequência exata de
 *    eventos gravados para uma campanha/cartão/correlationId, na ordem em
 *    que aconteceram. É isto que "reproduzir uma campanha" ou "uma
 *    sequência de toques" significa em um produto que leva honestidade a
 *    sério: mostrar o que o `EventLog` realmente tem, nunca reprocessar
 *    nada. Serve tanto para investigação/auditoria quanto como matéria-
 *    prima para reconstruir uma visão de analytics equivalente à original.
 *
 * 2. `replayToQueues` — opera de verdade, com efeito colateral: reenfileira
 *    eventos já gravados (ex.: uma janela em que o Queue Engine esteve fora
 *    do ar) para seus consumidores. Nunca cria uma nova linha em `EventLog`
 *    (o acontecimento já existe; só a entrega é repetida) — ver
 *    `replayExistingEvent`. Como isso pode re-disparar um webhook real, é
 *    uma ação explícita, nunca automática.
 */

export interface ReplayFilter {
  id?: string;
  type?: DomainEventType;
  correlationId?: string;
  companyId?: string;
  since?: Date;
  until?: Date;
  limit?: number;
}

function buildWhere(filter: ReplayFilter): Prisma.EventLogWhereInput {
  return {
    ...(filter.id ? { id: filter.id } : {}),
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.correlationId ? { correlationId: filter.correlationId } : {}),
    ...(filter.companyId ? { companyId: filter.companyId } : {}),
    ...(filter.since || filter.until
      ? { createdAt: { ...(filter.since ? { gte: filter.since } : {}), ...(filter.until ? { lte: filter.until } : {}) } }
      : {}),
  };
}

export async function reconstructSequence(filter: ReplayFilter) {
  return prisma.eventLog.findMany({
    where: buildWhere(filter),
    orderBy: { createdAt: "asc" },
    take: Math.min(filter.limit ?? 200, 500),
  });
}

/**
 * Event Explorer (Fase 12) — navegação "mais recente primeiro", diferente
 * de `reconstructSequence` (cronológica, para replay). Mesma tabela, mesmo
 * filtro — só a ordem e o propósito mudam.
 */
export async function listRecentEventLogs(filter: ReplayFilter) {
  return prisma.eventLog.findMany({
    where: buildWhere(filter),
    orderBy: { createdAt: "desc" },
    take: Math.min(filter.limit ?? 50, 200),
  });
}

/** Um evento por id, com os demais eventos da MESMA correlação (para o
 * Event Explorer mostrar "origem/destino/correlação" de verdade — nunca
 * inventado, sempre derivado de linhas reais do `EventLog`). */
export async function getEventWithCorrelation(id: string) {
  const event = await prisma.eventLog.findUnique({ where: { id } });
  if (!event) return null;

  const correlated = await prisma.eventLog.findMany({
    where: { correlationId: event.correlationId },
    orderBy: { createdAt: "asc" },
  });

  return { event, correlated };
}

export interface ReplayToQueuesResult {
  matched: number;
  replayed: number;
  failed: number;
}

export async function replayToQueues(filter: ReplayFilter): Promise<ReplayToQueuesResult> {
  const rows = await reconstructSequence(filter);
  let replayed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const event: DomainEvent = {
        id: row.id,
        type: row.type as DomainEventType,
        version: row.version,
        companyId: row.companyId,
        organizationId: row.organizationId,
        correlationId: row.correlationId,
        payload: row.payload as never,
        occurredAt: row.createdAt,
      };
      await replayExistingEvent(event);
      replayed++;
    } catch {
      failed++;
    }
  }

  return { matched: rows.length, replayed, failed };
}
