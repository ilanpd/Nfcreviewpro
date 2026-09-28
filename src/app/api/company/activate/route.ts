import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { activateCompanySchema } from "@/lib/validations/company";
import { updateCompany } from "@/services/company.service";
import { recordAudit } from "@/services/audit.service";
import { handleApiError } from "@/lib/api-error";

/**
 * Ativação pós-pagamento (C15) — "Primeiro comprei. Agora vamos ativar seu
 * negócio." Rota separada de `PATCH /api/company` (Configurações) de
 * propósito: aquela aceita edição parcial a qualquer momento; esta exige os
 * três campos juntos. `updateCompany` (reaproveitado, nunca duplicado) já
 * carimba `Company.activatedAt` sozinho — só na primeira vez que WhatsApp e
 * Google ficam preenchidos, de lá ou daqui.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "settings:write");
    const input = activateCompanySchema.parse(await req.json());
    const company = await updateCompany(ctx.companyId, input);
    await recordAudit(ctx, "COMPANY_SETTINGS_UPDATED");
    return NextResponse.json({ company });
  } catch (error) {
    return handleApiError(error);
  }
}
