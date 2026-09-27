import "server-only";
import { prisma } from "@/lib/prisma";
import { formatRedirectEvent, formatRatingEvent, formatFeedbackEvent, formatAssignmentAuditEvent, formatStoreOrderEvent } from "@/domain/live/format";
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

/** Prefixa o nome da empresa na mensagem — só faz sentido no feed GLOBAL
 * (o Live Mode por-empresa já sabe de qual empresa se trata, implícito). */
function withCompany(event: LiveEvent, companyName: string): LiveEvent {
  return { ...event, message: `${companyName} · ${event.message}` };
}

/**
 * Fase 19.2 — a mesma fusão de `listRecentEvents`, sem o filtro de
 * `companyId`, para a Timeline Viva do Centro de Operações. Reaproveita os
 * mesmos formatadores (nunca uma segunda cópia do formato de evento) e
 * adiciona `StoreOrder` (pago/entregue) — sinal de negócio que só faz
 * sentido numa visão cross-tenant, nunca no Live Mode de um salão.
 */
export async function listGlobalRecentEvents(since: Date, limit = 50): Promise<LiveEvent[]> {
  const [redirects, ratings, feedbacks, assignmentChanges, paidOrders, deliveredOrders] = await Promise.all([
    prisma.redirectLog.findMany({
      where: { createdAt: { gt: since } },
      select: { id: true, createdAt: true, card: { select: { name: true } }, cardId: true, campaign: { select: { type: true } }, company: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.ratingEvent.findMany({
      where: { createdAt: { gt: since } },
      select: { id: true, createdAt: true, cardId: true, stars: true, redirectedGoogle: true, visit: { select: { card: { select: { name: true } } } }, company: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.privateFeedback.findMany({
      where: { createdAt: { gt: since } },
      select: { id: true, createdAt: true, company: { select: { name: true } }, ratingEvent: { select: { cardId: true, visit: { select: { card: { select: { name: true } } } } } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gt: since }, action: { in: [...ASSIGNMENT_ACTIONS] } },
      select: { id: true, action: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.storeOrder.findMany({
      where: { createdAt: { gt: since }, status: { not: "PENDING_PAYMENT" } },
      select: { id: true, customerName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.storeOrder.findMany({
      where: { deliveredAt: { gt: since } },
      select: { id: true, customerName: true, deliveredAt: true },
      orderBy: { deliveredAt: "desc" },
      take: limit,
    }),
  ]);

  const events: LiveEvent[] = [
    ...redirects.map((r) => withCompany(formatRedirectEvent({ id: r.id, cardId: r.cardId, cardName: r.card.name, campaignType: r.campaign?.type ?? null, createdAt: r.createdAt }), r.company.name)),
    ...ratings.map((r) => withCompany(formatRatingEvent({ id: r.id, cardId: r.cardId, cardName: r.visit.card.name, stars: r.stars, redirectedGoogle: r.redirectedGoogle, createdAt: r.createdAt }), r.company.name)),
    ...feedbacks.map((f) => withCompany(formatFeedbackEvent({ id: f.id, cardId: f.ratingEvent.cardId, cardName: f.ratingEvent.visit.card.name, createdAt: f.createdAt }), f.company.name)),
    ...assignmentChanges.map((a) => formatAssignmentAuditEvent(a)),
    ...paidOrders.map((o) => formatStoreOrderEvent({ id: o.id, customerName: o.customerName, stage: "paid", createdAt: o.createdAt })),
    ...deliveredOrders.map((o) => formatStoreOrderEvent({ id: o.id, customerName: o.customerName, stage: "delivered", createdAt: o.deliveredAt! })),
  ];

  return events.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}
