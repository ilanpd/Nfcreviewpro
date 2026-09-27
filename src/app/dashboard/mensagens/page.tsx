import Link from "next/link";
import { MessageSquareWarning } from "lucide-react";
import { requireAuthContext } from "@/lib/auth";
import { roleHasPermission } from "@/domain/rbac/roles";
import { planHasFeature } from "@/lib/plans";
import { listFeedback } from "@/services/feedback.service";
import { FeedbackList } from "@/components/dashboard/feedback-list";

const WINDOW_DAYS = 90;

/**
 * Mensagens (F5 do plano da Fase 22) — página própria, separada de
 * Analytics: "Falar com a gente" está aberto a todo cliente desde o C6
 * (ADR-080), não é mais um desdobramento de uma nota baixa, então merece
 * lugar próprio no menu, não uma aba dentro de outra ferramenta.
 *
 * Janela de 90 dias (achado real de produção, ver \`analytics/page.tsx\`):
 * sem limite, esta consulta já levou a página a 22,8s de renderização numa
 * empresa com bastante histórico. \`/api/feedback\` (usado pelo export CSV e
 * pela gestão em si) continua sem limite — cortar histórico ali seria
 * perder dado, não só lentidão.
 */
export default async function MensagensPage() {
  const ctx = await requireAuthContext();
  const feedback = await listFeedback(ctx.companyId, undefined, {
    since: new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000),
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <MessageSquareWarning className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Mensagens</h1>
            <p className="text-sm text-muted-foreground">
              O que os clientes escrevem em &ldquo;Falar com a gente&rdquo; — últimos {WINDOW_DAYS} dias.
            </p>
          </div>
        </div>
        <Link href="/dashboard/suporte" className="shrink-0 text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Precisa de ajuda?
        </Link>
      </div>

      <FeedbackList
        initialFeedback={feedback}
        canManage={roleHasPermission(ctx.role, "feedback:resolve")}
        showExport={planHasFeature(ctx.plan, "csv_export")}
      />
    </div>
  );
}
