import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { revokeApiKey } from "@/services/api-key.service";
import { handleApiError } from "@/lib/api-error";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "developers:manage");
    const { id } = await params;
    const apiKey = await revokeApiKey(ctx.companyId, id);
    return NextResponse.json({ apiKey });
  } catch (error) {
    return handleApiError(error);
  }
}
