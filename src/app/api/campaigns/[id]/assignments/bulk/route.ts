import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { bulkAssignCampaignSchema, undoBulkAssignmentSchema } from "@/lib/validations/campaign";
import { bulkAssignCampaignToCards, undoBulkAssignment } from "@/services/campaign.service";
import { recordAudit } from "@/services/audit.service";
import { handleApiError } from "@/lib/api-error";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "campaign:assign");
    const { id } = await params;
    const input = bulkAssignCampaignSchema.parse(await req.json());
    const result = await bulkAssignCampaignToCards(ctx, id, input.cardIds);
    await recordAudit(ctx, "CAMPAIGN_ASSIGNED", {
      targetId: id,
      metadata: { scope: "CARD", batch: true, created: result.created, skipped: result.skipped },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Desfazer do Ghost Mode Evolution (Fase 6): remove exatamente o lote de
 * atribuições que um POST anterior criou, pelos IDs que ele devolveu — nunca
 * um filtro amplo por campanha/cartões, para nunca arriscar apagar uma
 * atribuição que já existia antes do lote.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "campaign:assign");
    const { id } = await params;
    const input = undoBulkAssignmentSchema.parse(await req.json());
    const result = await undoBulkAssignment(ctx.companyId, input.assignmentIds);
    await recordAudit(ctx, "CAMPAIGN_UNASSIGNED", {
      targetId: id,
      metadata: { scope: "CARD", batch: true, undo: true, deleted: result.deleted },
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
