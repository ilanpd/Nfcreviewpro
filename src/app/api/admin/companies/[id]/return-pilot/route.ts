import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSuperAdmin, getSuperAdminEmail } from "@/lib/super-admin";
import { setReturnPilot } from "@/services/return-offer.service";
import { handleApiError } from "@/lib/api-error";

const bodySchema = z.object({ enabled: z.boolean() });

/** Libera ou bloqueia o Retorno para uma empresa (piloto). Só o Admin; fica na auditoria da empresa. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    const { id } = await params;
    const { enabled } = bodySchema.parse(await req.json());
    await setReturnPilot(await getSuperAdminEmail(), id, enabled);
    return NextResponse.json({ ok: true, enabled });
  } catch (error) {
    return handleApiError(error);
  }
}
