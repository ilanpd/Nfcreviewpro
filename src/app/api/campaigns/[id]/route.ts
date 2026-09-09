import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { updateCampaignSchema } from "@/lib/validations/campaign";
import { deleteCampaign, getCampaign, updateCampaign } from "@/services/campaign.service";
import { recordAudit } from "@/services/audit.service";
import { publishEvent } from "@/lib/event-bus";
import { handleApiError } from "@/lib/api-error";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    const { id } = await params;
    const campaign = await getCampaign(ctx.companyId, id);
    return NextResponse.json({ campaign });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "campaign:write");
    const { id } = await params;
    const input = updateCampaignSchema.parse(await req.json());
    const campaign = await updateCampaign(ctx.companyId, id, input);
    await recordAudit(ctx, "CAMPAIGN_UPDATED", { targetId: id });
    await publishEvent("CampanhaAtualizada", { campaignId: id, changedFields: Object.keys(input) }, { companyId: ctx.companyId });
    return NextResponse.json({ campaign });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "campaign:write");
    const { id } = await params;
    await deleteCampaign(ctx.companyId, id);
    await recordAudit(ctx, "CAMPAIGN_DELETED", { targetId: id });
    await publishEvent("CampanhaEncerrada", { campaignId: id, reason: "DELETED" }, { companyId: ctx.companyId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
