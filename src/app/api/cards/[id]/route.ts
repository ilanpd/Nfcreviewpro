import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { updateCardSchema } from "@/lib/validations/card";
import { deleteCard, updateCard } from "@/services/card.service";
import { publishEvent } from "@/lib/event-bus";
import { handleApiError } from "@/lib/api-error";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "card:write");
    const { id } = await params;
    const input = updateCardSchema.parse(await req.json());
    const card = await updateCard(ctx.companyId, id, input);
    await publishEvent("MesaAtualizada", { cardId: id, action: "UPDATED" }, { companyId: ctx.companyId });
    return NextResponse.json({ card });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "card:write");
    const { id } = await params;
    await deleteCard(ctx.companyId, id);
    await publishEvent("MesaAtualizada", { cardId: id, action: "DELETED" }, { companyId: ctx.companyId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
