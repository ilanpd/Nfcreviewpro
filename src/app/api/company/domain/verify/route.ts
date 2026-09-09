import { NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { verifyDomainOwnership } from "@/services/company.service";
import { handleApiError } from "@/lib/api-error";

export async function POST() {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "settings:write");
    const result = await verifyDomainOwnership(ctx.companyId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
