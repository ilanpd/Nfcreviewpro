import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { duplicateCampaign } from "@/services/campaign.service";
import { handleApiError } from "@/lib/api-error";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "campaign:write");
    const { id } = await params;
    const campaign = await duplicateCampaign(ctx.companyId, id);
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
