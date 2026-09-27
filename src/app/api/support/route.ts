import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { createSupportRequestSchema } from "@/lib/validations/support";
import { createSupportRequest, listSupportRequestsForCompany } from "@/services/support.service";
import { handleApiError } from "@/lib/api-error";

/** Sem `requirePermission` — pedir ajuda não é uma ação sensível; qualquer
 * papel autenticado (inclusive READ_ONLY) pode abrir um chamado. */
export async function GET() {
  try {
    const ctx = await requireAuthContext();
    const requests = await listSupportRequestsForCompany(ctx.companyId);
    return NextResponse.json({ requests });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    const input = createSupportRequestSchema.parse(await req.json());
    const request = await createSupportRequest(ctx.companyId, ctx.userId, input);
    return NextResponse.json({ request }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
