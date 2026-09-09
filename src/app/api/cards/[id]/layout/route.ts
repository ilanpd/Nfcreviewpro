import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { updateCardLayoutSchema } from "@/lib/validations/card";
import { updateCardLayout } from "@/services/card.service";
import { handleApiError } from "@/lib/api-error";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "card:write");
    const { id } = await params;
    const input = updateCardLayoutSchema.parse(await req.json());
    const card = await updateCardLayout(ctx.companyId, id, input);
    return NextResponse.json({ card });
  } catch (error) {
    return handleApiError(error);
  }
}
