import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { applyRecommendation } from "@/services/recommendation-engine.service";
import { applyRecommendationSchema } from "@/lib/validations/playbook";
import { recordAudit } from "@/services/audit.service";
import { handleApiError } from "@/lib/api-error";

// One-Tap Execution (Fase 11) — mesma permissão de atribuir uma campanha
// manualmente ("campaign:assign"): aplicar uma recomendação tem exatamente o
// mesmo raio de efeito. Nunca reaproveita "automation:manage" — aquela
// permissão é sobre LIGAR o AutoPilot, um risco maior (ver domain/rbac/roles.ts).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "campaign:assign");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const input = applyRecommendationSchema.parse(body);

    const schedule =
      input.mode === "now"
        ? undefined
        : input.mode === "later"
          ? { mode: "later" as const, runAt: input.runAt! }
          : { mode: "repeat" as const, recurrence: { type: input.recurrence! } };

    const { executionId, playbookKey } = await applyRecommendation(ctx, id, schedule);
    await recordAudit(ctx, "RECOMMENDATION_APPLIED", { targetId: id, metadata: { playbookKey, mode: input.mode } });
    return NextResponse.json({ executionId }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
