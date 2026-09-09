import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { claimDomainSchema } from "@/lib/validations/company";
import { claimDomain, removeDomain } from "@/services/company.service";
import { recordAudit } from "@/services/audit.service";
import { handleApiError } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "settings:write");
    const { domain } = claimDomainSchema.parse(await req.json());
    const company = await claimDomain(ctx.companyId, domain);
    await recordAudit(ctx, "COMPANY_SETTINGS_UPDATED", { metadata: { domain } });
    return NextResponse.json({ company });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "settings:write");
    const company = await removeDomain(ctx.companyId);
    await recordAudit(ctx, "COMPANY_SETTINGS_UPDATED", { metadata: { domain: null } });
    return NextResponse.json({ company });
  } catch (error) {
    return handleApiError(error);
  }
}
