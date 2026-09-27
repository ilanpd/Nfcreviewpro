import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth";
import { buildFeedbackWhatsappUrl } from "@/lib/whatsapp";
import { publishEvent } from "@/lib/event-bus";
import type { CreateFeedbackInput } from "@/lib/validations/feedback";

export class FeedbackError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "FeedbackError";
  }
}

interface FeedbackTarget {
  companyId: string;
  whatsapp: string;
  cardId: string | null;
  cardName: string;
  ratingEventId: string | null;
  visitId: string | null;
  stars: number | null;
}

/** De onde vem a mensagem: a nota (link antigo), a visita ou só o cartão. */
async function resolveTarget(input: CreateFeedbackInput): Promise<FeedbackTarget> {
  if (input.ratingEventId) {
    const ratingEvent = await prisma.ratingEvent.findUnique({
      where: { id: input.ratingEventId },
      include: { privateFeedback: true, company: true, visit: { include: { card: true } } },
    });
    if (!ratingEvent) throw new FeedbackError("Visita não encontrada", 404);
    if (ratingEvent.privateFeedback) throw new FeedbackError("Esta visita já enviou uma mensagem", 409);
    return {
      companyId: ratingEvent.companyId,
      whatsapp: ratingEvent.company.whatsapp,
      cardId: ratingEvent.visit.cardId,
      cardName: ratingEvent.visit.card.name,
      ratingEventId: ratingEvent.id,
      visitId: null,
      stars: ratingEvent.stars,
    };
  }

  if (input.visitId) {
    const visit = await prisma.visit.findUnique({
      where: { id: input.visitId },
      include: { company: true, card: true, privateFeedbacks: { select: { id: true }, take: 1 } },
    });
    if (!visit) throw new FeedbackError("Visita não encontrada", 404);
    if (visit.privateFeedbacks.length > 0) throw new FeedbackError("Esta visita já enviou uma mensagem", 409);
    return {
      companyId: visit.companyId,
      whatsapp: visit.company.whatsapp,
      cardId: visit.cardId,
      cardName: visit.card.name,
      ratingEventId: null,
      visitId: visit.id,
      stars: null,
    };
  }

  const card = await prisma.nFCCard.findFirst({
    where: { uniqueCode: input.cardCode!, active: true },
    include: { company: true },
  });
  if (!card) throw new FeedbackError("Cartão não encontrado", 404);
  return {
    companyId: card.companyId,
    whatsapp: card.company.whatsapp,
    cardId: card.id,
    cardName: card.name,
    ratingEventId: null,
    visitId: null,
    stars: null,
  };
}

export async function createFeedback(input: CreateFeedbackInput) {
  const target = await resolveTarget(input);

  const whatsappUrl = buildFeedbackWhatsappUrl({
    whatsapp: target.whatsapp,
    stars: target.stars,
    message: input.message,
    name: input.name,
    phone: input.phone,
    cardName: target.cardName,
    createdAt: new Date(),
  });

  const feedback = await prisma.privateFeedback.create({
    data: {
      ratingEventId: target.ratingEventId,
      visitId: target.visitId,
      companyId: target.companyId,
      name: input.name || null,
      phone: input.phone || null,
      message: input.message,
      whatsappSentAt: new Date(),
    },
  });

  // Event Bus (Fase 8) — mesmo padrão best-effort do rating.service/
  // resolution-engine: publicar não pode atrasar a resposta a um cliente
  // enviando uma mensagem em "Falar com a gente".
  after(() => {
    publishEvent(
      "FeedbackRecebido",
      { feedbackId: feedback.id, ratingEventId: target.ratingEventId, cardId: target.cardId, stars: target.stars },
      { companyId: target.companyId }
    ).catch((err) => console.error("[feedback] publish FeedbackRecebido failed", err));
  });

  return { feedback, whatsappUrl };
}

/** O que a página /feedback precisa para se montar: só a marca da empresa e se já houve mensagem. */
export async function getFeedbackPageContext(origin: { ratingEventId?: string; visitId?: string; cardCode?: string }) {
  const brand = { name: true, logoUrl: true, primaryColor: true } as const;

  if (origin.ratingEventId) {
    const ratingEvent = await prisma.ratingEvent.findUnique({
      where: { id: origin.ratingEventId },
      include: { company: { select: brand }, privateFeedback: { select: { id: true } } },
    });
    if (!ratingEvent) return null;
    return { company: ratingEvent.company, alreadySent: !!ratingEvent.privateFeedback };
  }
  if (origin.visitId) {
    const visit = await prisma.visit.findUnique({
      where: { id: origin.visitId },
      include: { company: { select: brand }, privateFeedbacks: { select: { id: true }, take: 1 } },
    });
    if (!visit) return null;
    return { company: visit.company, alreadySent: visit.privateFeedbacks.length > 0 };
  }
  if (origin.cardCode) {
    const card = await prisma.nFCCard.findFirst({
      where: { uniqueCode: origin.cardCode, active: true },
      select: { company: { select: brand } },
    });
    return card ? { company: card.company, alreadySent: false } : null;
  }
  return null;
}

/**
 * `since`/`take` são opcionais e só usados pela página de Analytics — ela
 * roda em toda visita, então não pode custar uma varredura sem limite do
 * histórico inteiro da empresa (medido em produção: 22.8s de renderização
 * numa empresa com bastante histórico, perto o bastante do timeout da
 * função serverless pra derrubar a página de vez em quando). A gestão de
 * feedback de verdade (`/api/feedback`) e a exportação em CSV continuam sem
 * limite nenhum — cortar histórico ali seria perder dado, não só lentidão.
 */
export function listFeedback(companyId: string, resolved?: boolean, options?: { since?: Date; take?: number }) {
  return prisma.privateFeedback.findMany({
    where: {
      companyId,
      ...(resolved !== undefined ? { resolved } : {}),
      ...(options?.since ? { createdAt: { gte: options.since } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options?.take,
    include: {
      ratingEvent: { include: { visit: { select: { device: true, browser: true, createdAt: true } } } },
      visit: { select: { device: true, browser: true, createdAt: true } },
    },
  });
}

export async function setFeedbackResolved(companyId: string, feedbackId: string, resolved: boolean) {
  const feedback = await prisma.privateFeedback.findFirst({ where: { id: feedbackId, companyId } });
  if (!feedback) throw new ForbiddenError("Feedback não encontrado nesta empresa");
  return prisma.privateFeedback.update({ where: { id: feedbackId }, data: { resolved } });
}
