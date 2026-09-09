import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { duplicateCard } from "@/services/card.service";
import { handleApiError } from "@/lib/api-error";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "card:write");
    const { id } = await params;
    const card = await duplicateCard(ctx.companyId, id);
    return NextResponse.json({ card }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
