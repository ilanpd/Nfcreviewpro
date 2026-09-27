import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { createCampaign, updateCampaign, assignCampaign } from "@/services/campaign.service";
import { buildSyntheticAuthContext } from "@/lib/api-v1/auth";

/**
 * Portal leve para clientes GUEST (Fase 18) — acesso por link pessoal
 * (`editToken`), nunca por senha/login. Bloqueado com 404 se a empresa do
 * cartão não for GUEST: um cliente ASSINANTE já tem o dashboard completo
 * com RBAC de verdade, nunca deveria editar por aqui — defesa em
 * profundidade, não só uma checagem de UI.
 */
async function findGuestCard(editToken: string) {
  const card = await prisma.nFCCard.findUnique({ where: { editToken }, include: { company: true } });
  if (!card || card.company.accountType !== "GUEST") return null;
  return card;
}

async function currentCardAssignment(cardId: string) {
  return prisma.campaignAssignment.findFirst({
    where: { cardId, scope: "CARD" },
    include: { campaign: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ editToken: string }> }) {
  try {
    const { editToken } = await params;
    const card = await findGuestCard(editToken);
    if (!card) return NextResponse.json({ error: "Link inválido" }, { status: 404 });

    const assignment = await currentCardAssignment(card.id);
    const config = assignment?.campaign.config as { url?: string } | null;
    const destinationUrl = config?.url ?? card.company.googleReviewUrl;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const visitsThisMonth = await prisma.visit.count({ where: { cardId: card.id, createdAt: { gte: startOfMonth } } });

    return NextResponse.json({ name: card.name, destinationUrl, visitsThisMonth });
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({ destinationUrl: z.string().url("Informe um link válido (ex: https://...)") });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ editToken: string }> }) {
  try {
    const { editToken } = await params;
    const card = await findGuestCard(editToken);
    if (!card) return NextResponse.json({ error: "Link inválido" }, { status: 404 });

    const { destinationUrl } = patchSchema.parse(await req.json());
    const assignment = await currentCardAssignment(card.id);

    if (assignment) {
      await updateCampaign(card.companyId, assignment.campaignId, { config: { url: destinationUrl } });
    } else {
      // Caso defensivo — todo cartão GUEST sai do provisionamento com uma
      // atribuição já criada; só chega aqui se algo externo a removeu.
      const ctx = await buildSyntheticAuthContext(card.companyId);
      const campaign = await createCampaign(card.companyId, {
        name: "Direcionamento — editado pelo cliente",
        type: "URL_REDIRECT",
        priority: 0,
        recurrenceType: "NONE",
        tags: [],
        config: { url: destinationUrl },
      });
      await updateCampaign(card.companyId, campaign.id, { status: "ACTIVE" });
      await assignCampaign(ctx, campaign.id, { scope: "CARD", cardId: card.id });
    }

    return NextResponse.json({ destinationUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
