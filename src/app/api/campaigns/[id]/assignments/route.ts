import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { assignCampaignSchema } from "@/lib/validations/campaign";
import { assignCampaign, listAssignments } from "@/services/campaign.service";
import { recordAudit } from "@/services/audit.service";
import { handleApiError } from "@/lib/api-error";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    const { id } = await params;
    const assignments = await listAssignments(ctx.companyId, id);
    return NextResponse.json({ assignments });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "campaign:assign");
    const { id } = await params;
    const input = assignCampaignSchema.parse(await req.json());
    const assignment = await assignCampaign(ctx, id, input);
    await recordAudit(ctx, "CAMPAIGN_ASSIGNED", { targetId: assignment.id, metadata: { campaignId: id, scope: input.scope } });
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
