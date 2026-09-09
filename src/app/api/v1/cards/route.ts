import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiV1, parsePageParams, cursorQueryArgs, buildPage } from "@/lib/api-v1";
import { createCard } from "@/services/card.service";
import { createCardSchema } from "@/lib/validations/card";

/**
 * GET /api/v1/cards — lista os ativos NFC ("mesas") da empresa dona da
 * chave, paginado por cursor. POST cria um novo.
 */
export const GET = withApiV1(
  async (req, { apiKey }) => {
    const page = parsePageParams(req.nextUrl.searchParams);
    const rows = await prisma.nFCCard.findMany({
      where: { companyId: apiKey.companyId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...cursorQueryArgs(page),
    });
    return NextResponse.json(buildPage(rows, page.limit));
  },
  { scopes: ["cards:read"] }
);

export const POST = withApiV1(
  async (req, { apiKey }) => {
    const input = createCardSchema.parse(await req.json());
    const card = await createCard(apiKey.companyId, input);
    return NextResponse.json(card, { status: 201 });
  },
  { scopes: ["cards:write"] }
);
