import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { inviteMemberSchema } from "@/lib/validations/team";
import { inviteMember, listMembers } from "@/services/team.service";
import { recordAudit } from "@/services/audit.service";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const ctx = await requireAuthContext();
    const members = await listMembers(ctx.companyId);
    return NextResponse.json({ members });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "team:write");
    const input = inviteMemberSchema.parse(await req.json());
    const member = await inviteMember(ctx.companyId, input);
    await recordAudit(ctx, "TEAM_MEMBER_INVITED", { targetId: member.id, metadata: { email: member.email, role: member.role } });
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
