import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { deleteBranch, updateBranch } from "@/services/branch.service";
import { updateBranchSchema } from "@/lib/validations/branch";
import { handleApiError } from "@/lib/api-error";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "settings:write");
    const { id } = await params;
    const { name } = updateBranchSchema.parse(await req.json());
    const branch = await updateBranch(ctx.companyId, id, name);
    return NextResponse.json({ branch });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "settings:write");
    const { id } = await params;
    await deleteBranch(ctx.companyId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
