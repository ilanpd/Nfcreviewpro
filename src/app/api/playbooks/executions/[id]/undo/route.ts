import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, requirePermission } from "@/lib/auth";
import { undoPlaybookExecution } from "@/services/recommendation-engine.service";
import { recordAudit } from "@/services/audit.service";
import { handleApiError } from "@/lib/api-error";

// "Nunca executar silenciosamente" implica o inverso também: desfazer
// precisa ser tão fácil quanto aplicar — um único POST, sem confirmação
// adicional (a confirmação já aconteceu no Preview Inteligente antes de
// aplicar). Ver Autonomy Review em RELATORIO_FASE_11.md.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuthContext();
    requirePermission(ctx, "campaign:assign");
    const { id } = await params;
    const execution = await undoPlaybookExecution(ctx, id);
    await recordAudit(ctx, "PLAYBOOK_EXECUTION_UNDONE", { targetId: id, metadata: { playbookKey: execution.recommendation.playbook.key } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
