import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth";
import { buildFeedbackWhatsappUrl } from "@/lib/whatsapp";
import { publishEvent } from "@/lib/event-bus";
import type { CreateFeedbackInput } from "@/lib/validations/feedback";

export async function createFeedback(input: CreateFeedbackInput) {
  const ratingEvent = await prisma.ratingEvent.findUnique({
    where: { id: input.ratingEventId },
    include: { privateFeedback: true, company: true, visit: { include: { card: true } } },
  });
  if (!ratingEvent) throw new Error("Avaliação não encontrada");
  if (ratingEvent.privateFeedback) throw new Error("Esta avaliação já recebeu um feedback");

  const whatsappUrl = buildFeedbackWhatsappUrl({
    whatsapp: ratingEvent.company.whatsapp,
    stars: ratingEvent.stars,
    message: input.message,
    name: input.name,
    phone: input.phone,
    cardName: ratingEvent.visit.card.name,
    createdAt: new Date(),
  });

  const feedback = await prisma.privateFeedback.create({
    data: {
      ratingEventId: ratingEvent.id,
      companyId: ratingEvent.companyId,
      name: input.name || null,
      phone: input.phone || null,
      message: input.message,
      whatsappSentAt: new Date(),
    },
  });

  // Event Bus (Fase 8) — mesmo padrão best-effort do rating.service/
  // resolution-engine: publicar não pode atrasar a resposta a um cliente
  // insatisfeito preenchendo o formulário de feedback privado.
  after(() => {
    publishEvent(
      "FeedbackRecebido",
      { feedbackId: feedback.id, ratingEventId: ratingEvent.id, cardId: ratingEvent.visit.cardId, stars: ratingEvent.stars },
      { companyId: ratingEvent.companyId }
    ).catch((err) => console.error("[feedback] publish FeedbackRecebido failed", err));
  });

  return { feedback, whatsappUrl };
}

export function listFeedback(companyId: string, resolved?: boolean) {
  return prisma.privateFeedback.findMany({
    where: { companyId, ...(resolved !== undefined ? { resolved } : {}) },
    orderBy: { createdAt: "desc" },
    include: { ratingEvent: { include: { visit: { select: { device: true, browser: true, createdAt: true } } } } },
  });
}

export async function setFeedbackResolved(companyId: string, feedbackId: string, resolved: boolean) {
  const feedback = await prisma.privateFeedback.findFirst({ where: { id: feedbackId, companyId } });
  if (!feedback) throw new ForbiddenError("Feedback não encontrado nesta empresa");
  return prisma.privateFeedback.update({ where: { id: feedbackId }, data: { resolved } });
}
