import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { listWebhookDeliveries } from "@/services/webhook-endpoint.service";
import { handleApiError } from "@/lib/api-error";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "developers:manage");
    const { id } = await params;
    const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;
    const deliveries = await listWebhookDeliveries(ctx.companyId, id, cursor);
    return NextResponse.json({ deliveries });
  } catch (error) {
    return handleApiError(error);
  }
}
