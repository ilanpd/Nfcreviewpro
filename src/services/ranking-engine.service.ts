import "server-only";
import { subDays, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { analyticsCached } from "@/lib/analytics-cache";
import { getLocalDateParts } from "@/domain/rules/timezone";
import { DESTINATION_META } from "@/domain/campaign/destination";
import type { RankingEntry, RankingType } from "@/domain/analytics/types";

/**
 * Ranking Engine (Fase 7) — leaderboards de campanha/zona/mesa/funcionário/
 * horário/dia. Métrica de ordenação por tipo (ver a nota grande em
 * domain/analytics/insights.ts para o porquê):
 *   - CAMPANHA: toques (RedirectLog) — uma campanha nunca gera uma
 *     avaliação neste modelo de dados, só é servida com mais ou menos
 *     frequência.
 *   - ZONA / MESA / FUNCIONÁRIO / HORÁRIO / DIA: conversões
 *     (`RatingEvent.redirectedGoogle = true`), a única atribuível
 *     diretamente a um `cardId` real.
 *
 * "Funcionário" não é uma entidade própria no schema (ver ADR-019) — é
 * qualquer `NFCCard` com a tag "equipe", a mesma convenção já usada pelo
 * seed da Bella Vista para o cartão do garçom. Ver ADR-030.
 */
const EMPLOYEE_TAG = "equipe";
const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

async function getConversionCountsByCard(companyId: string, since: Date): Promise<Map<string, number>> {
  const rows = await prisma.ratingEvent.findMany({
    where: { companyId, redirectedGoogle: true, createdAt: { gte: since } },
    select: { cardId: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.cardId, (counts.get(row.cardId) ?? 0) + 1);
  return counts;
}

async function rankCampaigns(companyId: string, since: Date, limit: number): Promise<RankingEntry[]> {
  const grouped = await prisma.redirectLog.groupBy({
    by: ["campaignId"],
    where: { companyId, campaignId: { not: null }, createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { campaignId: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: grouped.map((g) => g.campaignId!) } },
    select: { id: true, name: true, type: true },
  });
  const byId = new Map(campaigns.map((c) => [c.id, c]));

  return grouped.map((g) => {
    const campaign = byId.get(g.campaignId!);
    return {
      id: g.campaignId!,
      label: campaign?.name ?? "Campanha removida",
      value: g._count._all,
      secondaryLabel: "toques",
      color: campaign ? DESTINATION_META[campaign.type].color : undefined,
    };
  });
}

async function rankZones(companyId: string, since: Date, limit: number): Promise<RankingEntry[]> {
  const [counts, cards, zones] = await Promise.all([
    getConversionCountsByCard(companyId, since),
    prisma.nFCCard.findMany({ where: { companyId, zoneId: { not: null } }, select: { id: true, zoneId: true } }),
    prisma.zone.findMany({ where: { companyId }, select: { id: true, name: true } }),
  ]);

  const zoneNames = new Map(zones.map((z) => [z.id, z.name]));
  const byZone = new Map<string, number>();
  for (const card of cards) {
    const conversions = counts.get(card.id) ?? 0;
    if (conversions === 0) continue;
    byZone.set(card.zoneId!, (byZone.get(card.zoneId!) ?? 0) + conversions);
  }

  return [...byZone.entries()]
    .map(([zoneId, value]) => ({ id: zoneId, label: zoneNames.get(zoneId) ?? "Zona removida", value, secondaryLabel: "conversões" }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

async function rankCards(companyId: string, since: Date, limit: number, requireTag?: string): Promise<RankingEntry[]> {
  const [counts, cards] = await Promise.all([
    getConversionCountsByCard(companyId, since),
    prisma.nFCCard.findMany({ where: { companyId }, select: { id: true, name: true, tags: true } }),
  ]);

  return cards
    .filter((c) => !requireTag || c.tags.includes(requireTag))
    .map((c) => ({ id: c.id, label: c.name, value: counts.get(c.id) ?? 0, secondaryLabel: "conversões" }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

async function rankByLocalTime(companyId: string, since: Date, mode: "HOUR" | "DAY_OF_WEEK"): Promise<RankingEntry[]> {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { timezone: true } });
  const rows = await prisma.ratingEvent.findMany({
    where: { companyId, redirectedGoogle: true, createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const counts = new Map<number, number>();
  for (const row of rows) {
    const parts = getLocalDateParts(row.createdAt, company.timezone);
    const bucket = mode === "HOUR" ? parts.hour : parts.weekday;
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  const buckets = mode === "HOUR" ? 24 : 7;
  return Array.from({ length: buckets }, (_, i) => ({
    id: String(i),
    label: mode === "HOUR" ? `${String(i).padStart(2, "0")}h` : DAY_LABELS[i],
    value: counts.get(i) ?? 0,
    secondaryLabel: "conversões",
  }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);
}

async function computeRanking(companyId: string, type: RankingType, since: Date, limit: number): Promise<RankingEntry[]> {
  switch (type) {
    case "CAMPAIGN":
      return rankCampaigns(companyId, since, limit);
    case "ZONE":
      return rankZones(companyId, since, limit);
    case "CARD":
      return rankCards(companyId, since, limit);
    case "EMPLOYEE":
      return rankCards(companyId, since, limit, EMPLOYEE_TAG);
    case "HOUR":
      return (await rankByLocalTime(companyId, since, "HOUR")).slice(0, limit);
    case "DAY_OF_WEEK":
      return (await rankByLocalTime(companyId, since, "DAY_OF_WEEK")).slice(0, limit);
  }
}

export async function getRanking(companyId: string, type: RankingType, days = 30, limit = 10): Promise<RankingEntry[]> {
  const since = subDays(startOfDay(new Date()), days - 1);
  return analyticsCached(`${companyId}:ranking:${type}:${days}:${limit}`, () => computeRanking(companyId, type, since, limit));
}

const LEADER_TYPES: RankingType[] = ["CAMPAIGN", "ZONE", "CARD", "EMPLOYEE", "HOUR", "DAY_OF_WEEK"];

/** Um `RankingEntry` (o líder) por tipo — alimenta os 6 KPIs "melhor X" do
 * painel executivo, sem repetir a lógica de cada `rank*`. */
export async function getTopOfEachRanking(companyId: string, days = 30): Promise<Record<RankingType, RankingEntry | null>> {
  const entries = await Promise.all(LEADER_TYPES.map((type) => getRanking(companyId, type, days, 1)));
  return Object.fromEntries(LEADER_TYPES.map((type, i) => [type, entries[i][0] ?? null])) as Record<RankingType, RankingEntry | null>;
}
