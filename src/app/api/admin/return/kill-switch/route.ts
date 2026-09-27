import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSuperAdmin, getSuperAdminEmail } from "@/lib/super-admin";
import { getSiteSettings } from "@/lib/site-settings";
import { setReturnKillSwitch } from "@/services/return-offer.service";
import { handleApiError } from "@/lib/api-error";

const bodySchema = z.object({ enabled: z.boolean() });

export async function GET() {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const settings = await getSiteSettings();
  return NextResponse.json({ enabled: settings?.returnOfferEnabled ?? true });
}

/**
 * Interruptor geral do Retorno (ADR-079): `enabled: false` desliga emissão e
 * resgate para todas as empresas na hora, sem deploy. O cartão volta ao
 * comportamento anterior. Uso de emergência.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const { enabled } = bodySchema.parse(await req.json());
    await setReturnKillSwitch(await getSuperAdminEmail(), enabled);
    return NextResponse.json({ ok: true, enabled });
  } catch (error) {
    return handleApiError(error);
  }
}
