import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { updateCompanySchema } from "@/lib/validations/company";
import { getCompanyById, updateCompany } from "@/services/company.service";
import { recordAudit } from "@/services/audit.service";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const ctx = await requireAuthContext();
    const company = await getCompanyById(ctx.companyId);
    return NextResponse.json({ company });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "settings:write");
    const input = updateCompanySchema.parse(await req.json());
    const company = await updateCompany(ctx.companyId, input);
    await recordAudit(ctx, "COMPANY_SETTINGS_UPDATED");
    return NextResponse.json({ company });
  } catch (error) {
    return handleApiError(error);
  }
}
