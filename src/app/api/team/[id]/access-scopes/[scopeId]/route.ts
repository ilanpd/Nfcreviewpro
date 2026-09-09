import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { revokeAccessScope } from "@/services/team.service";
import { recordAudit } from "@/services/audit.service";
import { handleApiError } from "@/lib/api-error";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; scopeId: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "access-scope:write");
    const { id, scopeId } = await params;
    await revokeAccessScope(ctx.companyId, id, scopeId);
    await recordAudit(ctx, "ACCESS_SCOPE_REVOKED", { targetId: id, metadata: { scopeId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
