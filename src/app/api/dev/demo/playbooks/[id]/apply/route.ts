import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { buildSyntheticAuthContext } from "@/lib/api-v1/auth";
import { executeRecommendation } from "@/services/execution-engine.service";
import { handleApiError } from "@/lib/api-error";
import { devToolsEnabled } from "@/lib/dev/gate";

/**
 * Executive Copilot (Fase 11) — a ÚNICA rota de escrita que `/dev/ceo`
 * jamais teve, uma exceção deliberada e estreita a ADR-027 ("O Command
 * Center nunca ganha rotas de escrita próprias"), não uma violação
 * silenciosa dele. Justificativa registrada em ADR-051: o Demo Premium
 * desta fase pede explicitamente um "botão de execução imediata" na coluna
 * "Próximas melhores ações" — sem uma aplicação de verdade, o momento
 * central do roteiro de demonstração (insight → playbook → aplicar → KPIs
 * reagem) não existe. Protegida pelas MESMAS três camadas que toda
 * `/dev/ceo/*` já tem: `NODE_ENV === "production"` → 404 (o mesmo gate que
 * já torna esta árvore inexistente em toda build de produção real, inclusive
 * previews do Vercel — nunca um gate novo, o mesmo já confiado desde a Fase
 * 2); a empresa é sempre a fixa do seed (`getDemoCompany()`, nunca aceita de
 * fora); e a ação é 100% reversível (a mesma `undoExecution` de uma execução
 * manual, chamada pela mesma rota `/api/playbooks/executions/:id/undo`).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!devToolsEnabled()) notFound();
  try {
    const company = await getDemoCompany();
    if (!company) return NextResponse.json({ error: "Empresa de demonstração não encontrada" }, { status: 404 });
    const { id } = await params;
    const ctx = await buildSyntheticAuthContext(company.id);
    const { executionId } = await executeRecommendation(ctx, id, { triggeredBy: "USER" });
    return NextResponse.json({ executionId });
  } catch (error) {
    return handleApiError(error);
  }
}
