import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { getAutoPilotSetting, setAutoPilotLevel } from "@/services/automation-engine.service";
import { setAutoPilotLevelSchema } from "@/lib/validations/playbook";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const ctx = await requireAuthContext();
    const level = await getAutoPilotSetting(ctx.companyId);
    return NextResponse.json({ level });
  } catch (error) {
    return handleApiError(error);
  }
}

// AutoPilot Seguro (Fase 11) — deliberadamente restrito a "automation:manage"
// (OWNER/ADMIN), nunca "campaign:assign": ligar o nível Automático é decidir
// que o sistema pode agir em N recomendações futuras sem confirmação — um
// limite de segurança maior do que aplicar uma recomendação por vez.
export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "automation:manage");
    const { level } = setAutoPilotLevelSchema.parse(await req.json());
    await setAutoPilotLevel(ctx, level);
    return NextResponse.json({ level });
  } catch (error) {
    return handleApiError(error);
  }
}
