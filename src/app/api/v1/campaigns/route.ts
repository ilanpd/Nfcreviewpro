import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiV1, parsePageParams, cursorQueryArgs, buildPage } from "@/lib/api-v1";
import { createCampaign } from "@/services/campaign.service";
import { computeDisplayStatus } from "@/domain/campaign/status";
import { createCampaignSchema } from "@/lib/validations/campaign";

/**
 * Ao contrário de /cards, /zones e /branches (que reaproveitam a mesma
 * consulta que o dashboard interno usa), esta lista consulta o Prisma
 * diretamente em vez de `listCampaigns`/`campaignRepo.findCampaigns`: essas
 * funções internas não são paginadas por cursor (o dashboard sempre carrega
 * a lista inteira de uma vez) — construir uma segunda versão paginada aqui é
 * mais simples e honesto do que forçar cursor pagination num contrato
 * interno que nunca precisou dela. `computeDisplayStatus` (o mesmo cálculo
 * puro que o dashboard usa) garante que "displayStatus" nunca diverge entre
 * as duas superfícies.
 */
export const GET = withApiV1(
  async (req, { apiKey }) => {
    const page = parsePageParams(req.nextUrl.searchParams);
    const rows = await prisma.campaign.findMany({
      where: { companyId: apiKey.companyId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...cursorQueryArgs(page),
    });
    const { data, has_more, next_cursor } = buildPage(rows, page.limit);
    return NextResponse.json({
      data: data.map((c) => ({ ...c, displayStatus: computeDisplayStatus(c, new Date()) })),
      has_more,
      next_cursor,
    });
  },
  { scopes: ["campaigns:read"] }
);

export const POST = withApiV1(
  async (req, { apiKey }) => {
    const input = createCampaignSchema.parse(await req.json());
    const campaign = await createCampaign(apiKey.companyId, input);
    return NextResponse.json(campaign, { status: 201 });
  },
  { scopes: ["campaigns:write"] }
);
