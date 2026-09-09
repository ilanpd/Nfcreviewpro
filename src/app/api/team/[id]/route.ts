import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { updateMemberSchema } from "@/lib/validations/team";
import { removeMember, updateMemberRole } from "@/services/team.service";
import { recordAudit } from "@/services/audit.service";
import { handleApiError } from "@/lib/api-error";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "team:write");
    const { id } = await params;
    const input = updateMemberSchema.parse(await req.json());
    const member = await updateMemberRole(ctx.companyId, id, input);
    await recordAudit(ctx, "TEAM_MEMBER_ROLE_CHANGED", { targetId: id, metadata: { role: input.role } });
    return NextResponse.json({ member });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "team:write");
    const { id } = await params;
    await removeMember(ctx.companyId, id, ctx.role);
    await recordAudit(ctx, "TEAM_MEMBER_REMOVED", { targetId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
