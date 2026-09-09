import { NextResponse } from "next/server";
import { withApiV1, notFoundIfMissing } from "@/lib/api-v1";
import { getCardForCompany, updateCard, deleteCard } from "@/services/card.service";
import { updateCardSchema } from "@/lib/validations/card";

export const GET = withApiV1<{ id: string }>(
  async (_req, { params, apiKey }) => {
    const card = await notFoundIfMissing(() => getCardForCompany(apiKey.companyId, params.id));
    return NextResponse.json(card);
  },
  { scopes: ["cards:read"] }
);

export const PATCH = withApiV1<{ id: string }>(
  async (req, { params, apiKey }) => {
    const input = updateCardSchema.parse(await req.json());
    const card = await notFoundIfMissing(() => updateCard(apiKey.companyId, params.id, input));
    return NextResponse.json(card);
  },
  { scopes: ["cards:write"] }
);

export const DELETE = withApiV1<{ id: string }>(
  async (_req, { params, apiKey }) => {
    await notFoundIfMissing(() => deleteCard(apiKey.companyId, params.id));
    return NextResponse.json({ id: params.id, deleted: true });
  },
  { scopes: ["cards:write"] }
);
