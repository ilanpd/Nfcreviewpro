import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishEvent } from "@/lib/event-bus";
import type { PublicRatingResult } from "@/types";

const GOOGLE_REDIRECT_THRESHOLD = 4;

export async function createRating(visitId: string, stars: number): Promise<PublicRatingResult> {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { card: true, ratingEvent: true },
  });
  if (!visit) throw new Error("Visita não encontrada");
  if (visit.ratingEvent) throw new Error("Esta visita já recebeu uma avaliação");

  const ratingEvent = await prisma.ratingEvent.create({
    data: {
      visitId,
      companyId: visit.companyId,
      cardId: visit.cardId,
      stars,
    },
  });

  // Event Bus (Fase 8) — mesmo padrão best-effort do resolution-engine: a
  // resposta ao cliente não espera a publicação do evento. Este é o único
  // ponto do fluxo público onde uma avaliação passa a existir, então
  // "AvaliacaoPublicada" nasce aqui, antes de saber se o destino final é o
  // Google ou o feedback privado (ambos os ramos abaixo já têm a avaliação
  // registrada).
  after(() => {
    publishEvent(
      "AvaliacaoPublicada",
      { ratingEventId: ratingEvent.id, cardId: visit.cardId, stars },
      { companyId: visit.companyId }
    ).catch((err) => console.error("[rating] publish AvaliacaoPublicada failed", err));
  });

  if (stars >= GOOGLE_REDIRECT_THRESHOLD) {
    const company = await prisma.company.findUniqueOrThrow({ where: { id: visit.companyId } });
    return { outcome: "google", ratingEventId: ratingEvent.id, googleReviewUrl: company.googleReviewUrl };
  }

  return { outcome: "feedback", ratingEventId: ratingEvent.id };
}

/** Public lookup used by /feedback — only exposes what the branding screen needs. */
export async function getRatingEventForFeedback(ratingEventId: string) {
  const ratingEvent = await prisma.ratingEvent.findUnique({
    where: { id: ratingEventId },
    include: { company: true, privateFeedback: true },
  });
  if (!ratingEvent) return null;

  return {
    stars: ratingEvent.stars,
    alreadyHasFeedback: Boolean(ratingEvent.privateFeedback),
    company: {
      name: ratingEvent.company.name,
      logoUrl: ratingEvent.company.logoUrl,
      primaryColor: ratingEvent.company.primaryColor,
    },
  };
}

export async function markRedirectedToGoogle(ratingEventId: string) {
  await prisma.ratingEvent.update({
    where: { id: ratingEventId },
    data: { redirectedGoogle: true },
  });
}
