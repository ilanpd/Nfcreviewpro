import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishEvent } from "@/lib/event-bus";
import { buildPublicRatingResult, type PublicRatingResult } from "@/domain/rating/public-result";

/**
 * Registra a nota rápida e devolve SEMPRE o mesmo resultado, qualquer que seja
 * a nota (ADR-075). A nota fica só como dado interno; nunca decide o que o
 * cliente vê nem para onde ele pode ir.
 */
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
  // ponto do fluxo público onde uma avaliação passa a existir.
  after(() => {
    publishEvent(
      "AvaliacaoPublicada",
      { ratingEventId: ratingEvent.id, cardId: visit.cardId, stars },
      { companyId: visit.companyId }
    ).catch((err) => console.error("[rating] publish AvaliacaoPublicada failed", err));
  });

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: visit.companyId },
    select: { googleReviewUrl: true },
  });
  return buildPublicRatingResult({ ratingEventId: ratingEvent.id, googleReviewUrl: company.googleReviewUrl });
}

export async function markRedirectedToGoogle(ratingEventId: string) {
  await prisma.ratingEvent.update({
    where: { id: ratingEventId },
    data: { redirectedGoogle: true },
  });
}
