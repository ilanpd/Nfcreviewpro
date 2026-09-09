import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { replayWebhookDelivery } from "@/services/webhook-endpoint.service";
import { handleApiError } from "@/lib/api-error";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; deliveryId: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "developers:manage");
    const { id, deliveryId } = await params;
    const delivery = await replayWebhookDelivery(ctx.companyId, id, deliveryId);
    return NextResponse.json({ delivery });
  } catch (error) {
    return handleApiError(error);
  }
}
