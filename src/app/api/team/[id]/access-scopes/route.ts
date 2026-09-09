import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { createAccessScopeSchema } from "@/lib/validations/team";
import { grantAccessScope, listAccessScopes } from "@/services/team.service";
import { recordAudit } from "@/services/audit.service";
import { handleApiError } from "@/lib/api-error";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "access-scope:write");
    const { id } = await params;
    const scopes = await listAccessScopes(ctx.companyId, id);
    return NextResponse.json({ scopes });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "access-scope:write");
    const { id } = await params;
    const input = createAccessScopeSchema.parse(await req.json());
    const scope = await grantAccessScope(ctx.companyId, id, input);
    await recordAudit(ctx, "ACCESS_SCOPE_GRANTED", {
      targetId: id,
      metadata: { branchId: input.branchId, zoneId: input.zoneId },
    });
    return NextResponse.json({ scope }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
