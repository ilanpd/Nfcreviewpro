import "server-only";
import { prisma } from "@/lib/prisma";
import { computeTableStatus } from "@/domain/table-map/status";
import { listAssignmentsForStatus } from "./table-map.service";
import { getLastInteractionByCard } from "./heatmap.service";
import { getReviewGoalForecast } from "./forecast-engine.service";
import { getRoiSummary } from "./analytics-engine.service";

/**
 * State Inspector (Fase 12) — "uma espécie de React DevTools para o
 * restaurante": seleciona UMA mesa e mostra tudo que já é real em outros
 * lugares do produto, agregado numa única leitura. Nenhum dado novo é
 * calculado aqui — cada campo já é uma função de serviço existente,
 * chamada com o `cardId` como lente.
 */
export async function inspectCardState(companyId: string, cardId: string) {
  const card = await prisma.nFCCard.findFirst({ where: { id: cardId, companyId } });
  if (!card) return null;

  const [assignments, company, lastInteraction, recentEvents, activePlaybookRecs, reviewGoal, roi] = await Promise.all([
    listAssignmentsForStatus(companyId, null),
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
    getLastInteractionByCard(companyId, new Date(Date.now() - 30 * 86_400_000)),
    prisma.redirectLog.findMany({ where: { companyId, cardId }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.playbookRecommendation.findMany({ where: { companyId, scopeId: cardId, status: "PENDING" }, include: { playbook: true } }),
    getReviewGoalForecast(companyId, 100),
    getRoiSummary(companyId, 30),
  ]);

  const status = computeTableStatus({ id: card.id, branchId: card.branchId, zoneId: card.zoneId }, assignments, company.organizationId);

  return {
    card: { id: card.id, name: card.name, tags: card.tags, zoneId: card.zoneId, branchId: card.branchId },
    status,
    history: recentEvents,
    lastInteractionAt: lastInteraction.get(cardId)?.toISOString() ?? null,
    activePlaybooks: activePlaybookRecs,
    forecast: reviewGoal,
    roi,
  };
}
