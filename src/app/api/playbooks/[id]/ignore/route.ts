import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { ignoreRecommendation } from "@/services/recommendation-engine.service";
import { recordAudit } from "@/services/audit.service";
import { handleApiError } from "@/lib/api-error";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "campaign:assign");
    const { id } = await params;
    const recommendation = await ignoreRecommendation(ctx, id);
    await recordAudit(ctx, "RECOMMENDATION_IGNORED", { targetId: id, metadata: { playbookKey: recommendation.playbook.key } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
