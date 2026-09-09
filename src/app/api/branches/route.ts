import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { createBranch, listBranches } from "@/services/branch.service";
import { createBranchSchema } from "@/lib/validations/branch";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const ctx = await requireAuthContext();
    const branches = await listBranches(ctx.companyId);
    return NextResponse.json({ branches });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "settings:write");
    const { name } = createBranchSchema.parse(await req.json());
    const branch = await createBranch(ctx.companyId, name);
    return NextResponse.json({ branch }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
