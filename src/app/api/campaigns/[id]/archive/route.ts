import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { archiveCampaign } from "@/services/campaign.service";
import { recordAudit } from "@/services/audit.service";
import { publishEvent } from "@/lib/event-bus";
import { handleApiError } from "@/lib/api-error";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "campaign:write");
    const { id } = await params;
    const campaign = await archiveCampaign(ctx.companyId, id);
    await recordAudit(ctx, "CAMPAIGN_ARCHIVED", { targetId: id });
    await publishEvent("CampanhaEncerrada", { campaignId: id, reason: "ARCHIVED" }, { companyId: ctx.companyId });
    return NextResponse.json({ campaign });
  } catch (error) {
    return handleApiError(error);
  }
}
