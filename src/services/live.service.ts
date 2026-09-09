import "server-only";
import { prisma } from "@/lib/prisma";
import { formatRedirectEvent, formatRatingEvent, formatFeedbackEvent, formatAssignmentAuditEvent } from "@/domain/live/format";
import type { LiveEvent } from "@/domain/live/types";

const ASSIGNMENT_ACTIONS = ["CAMPAIGN_ASSIGNED", "CAMPAIGN_UNASSIGNED"] as const;

/**
 * Tudo que aconteceu numa empresa desde `since` — a fonte de dados do feed
 * de eventos do Live Mode e do Command Center. Não inventa uma tabela nova
 * de eventos: lê exatamente as tabelas que o produto já grava (`RedirectLog`
 * do Resolution Engine, `RatingEvent`/`PrivateFeedback` do fluxo legado,
 * `AuditLog` de mudanças de atribuição da Fase 4) e as funde numa timeline
 * única, ordenada por `createdAt`. Ver ADR-025.
 */
export async function listRecentEvents(companyId: string, since: Date, limit = 50): Promise<LiveEvent[]> {
  const [redirects, ratings, feedbacks, assignmentChanges] = await Promise.all([
    prisma.redirectLog.findMany({
      where: { companyId, createdAt: { gt: since } },
      select: { id: true, createdAt: true, card: { select: { name: true } }, cardId: true, campaign: { select: { type: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.ratingEvent.findMany({
      where: { companyId, createdAt: { gt: since } },
      select: { id: true, createdAt: true, cardId: true, stars: true, redirectedGoogle: true, visit: { select: { card: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.privateFeedback.findMany({
      where: { companyId, createdAt: { gt: since } },
      select: { id: true, createdAt: true, ratingEvent: { select: { cardId: true, visit: { select: { card: { select: { name: true } } } } } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.auditLog.findMany({
      where: { companyId, createdAt: { gt: since }, action: { in: [...ASSIGNMENT_ACTIONS] } },
      select: { id: true, action: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  const events: LiveEvent[] = [
    ...redirects.map((r) => formatRedirectEvent({ id: r.id, cardId: r.cardId, cardName: r.card.name, campaignType: r.campaign?.type ?? null, createdAt: r.createdAt })),
    ...ratings.map((r) => formatRatingEvent({ id: r.id, cardId: r.cardId, cardName: r.visit.card.name, stars: r.stars, redirectedGoogle: r.redirectedGoogle, createdAt: r.createdAt })),
    ...feedbacks.map((f) => formatFeedbackEvent({ id: f.id, cardId: f.ratingEvent.cardId, cardName: f.ratingEvent.visit.card.name, createdAt: f.createdAt })),
    ...assignmentChanges.map((a) => formatAssignmentAuditEvent(a)),
  ];

  return events.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}
