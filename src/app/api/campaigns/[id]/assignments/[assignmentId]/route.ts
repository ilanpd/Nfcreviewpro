import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { unassignCampaign } from "@/services/campaign.service";
import { recordAudit } from "@/services/audit.service";
import { handleApiError } from "@/lib/api-error";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "campaign:assign");
    const { assignmentId } = await params;
    await unassignCampaign(ctx, assignmentId);
    await recordAudit(ctx, "CAMPAIGN_UNASSIGNED", { targetId: assignmentId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
