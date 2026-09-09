import "server-only";
import { prisma } from "@/lib/prisma";
import type { CampaignType } from "@/generated/prisma/client";

/**
 * Time Machine (Fase 6) — reconstrói o salão num instante do passado a
 * partir do único registro histórico de verdade que o produto tem hoje:
 * `RedirectLog`, gravado a cada toque (ver ADR-025/ADR-026). Deliberadamente
 * NÃO tenta reconstruir "qual era a atribuição de campanha ativa" — não
 * existe uma tabela de histórico de atribuições (CampaignAssignment não tem
 * `deletedAt`/versão), então fingir esse nível de precisão seria inventar um
 * dado que o produto não tem. Em vez disso, mostra honestamente "a última
 * campanha que essa mesa realmente serviu até este momento", que é uma
 * aproximação forte e 100% verificável — quase sempre coincide com a
 * atribuição real, e nunca finge saber mais do que sabe.
 */

export interface TimeMachineCardSnapshot {
  cardId: string;
  campaignId: string | null;
  campaignName: string | null;
  campaignType: CampaignType | null;
  at: Date;
}

export interface TimeMachineTopTable {
  cardId: string;
  cardName: string;
  conversions: number;
}

export interface TimeMachineSummary {
  totalTouches: number;
  topTables: TimeMachineTopTable[];
}

// Janela limitada de linhas por consulta — evitar escanear todo o histórico
// de uma empresa grande só para achar o último toque de cada mesa. Numa
// operação muito ativa (milhares de toques entre duas mesas voltarem a
// tocar), uma mesa raramente usada pode não aparecer no snapshot — um limite
// honesto, documentado, não escondido. Ver DECISOES_DE_ARQUITETURA.md.
const SNAPSHOT_SCAN_LIMIT = 3000;

export async function getSnapshotAt(companyId: string, at: Date): Promise<TimeMachineCardSnapshot[]> {
  const rows = await prisma.redirectLog.findMany({
    where: { companyId, createdAt: { lte: at } },
    orderBy: { createdAt: "desc" },
    take: SNAPSHOT_SCAN_LIMIT,
    select: {
      cardId: true,
      campaignId: true,
      createdAt: true,
      campaign: { select: { name: true, type: true } },
    },
  });

  const seen = new Map<string, TimeMachineCardSnapshot>();
  for (const row of rows) {
    if (seen.has(row.cardId)) continue;
    seen.set(row.cardId, {
      cardId: row.cardId,
      campaignId: row.campaignId,
      campaignName: row.campaign?.name ?? null,
      campaignType: row.campaign?.type ?? null,
      at: row.createdAt,
    });
  }
  return [...seen.values()];
}

export async function getWindowSummary(companyId: string, windowStart: Date, windowEnd: Date): Promise<TimeMachineSummary> {
  const [totalTouches, ratings] = await Promise.all([
    prisma.redirectLog.count({ where: { companyId, createdAt: { gte: windowStart, lte: windowEnd } } }),
    prisma.ratingEvent.findMany({
      where: { companyId, createdAt: { gte: windowStart, lte: windowEnd }, redirectedGoogle: true },
      select: { cardId: true, visit: { select: { card: { select: { name: true } } } } },
    }),
  ]);

  const counts = new Map<string, TimeMachineTopTable>();
  for (const rating of ratings) {
    const entry = counts.get(rating.cardId) ?? { cardId: rating.cardId, cardName: rating.visit.card.name, conversions: 0 };
    entry.conversions += 1;
    counts.set(rating.cardId, entry);
  }

  const topTables = [...counts.values()].sort((a, b) => b.conversions - a.conversions).slice(0, 5);
  return { totalTouches, topTables };
}
