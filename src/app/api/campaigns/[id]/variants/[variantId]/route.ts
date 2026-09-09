import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { deleteVariant } from "@/services/campaign.service";
import { handleApiError } from "@/lib/api-error";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ variantId: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "campaign:write");
    const { variantId } = await params;
    await deleteVariant(ctx.companyId, variantId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
