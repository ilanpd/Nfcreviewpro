import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { createCardSchema } from "@/lib/validations/card";
import { createCard, listCards } from "@/services/card.service";
import { publishEvent } from "@/lib/event-bus";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const ctx = await requireAuthContext();
    const cards = await listCards(ctx.companyId);
    return NextResponse.json({ cards });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "card:write");
    const input = createCardSchema.parse(await req.json());
    const card = await createCard(ctx.companyId, input);
    await publishEvent("MesaAtualizada", { cardId: card.id, action: "CREATED" }, { companyId: ctx.companyId });
    return NextResponse.json({ card }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
