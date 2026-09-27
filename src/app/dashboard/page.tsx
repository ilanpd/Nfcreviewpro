import { BarChart3, CreditCard, MessageSquareWarning, MousePointerClick } from "lucide-react";
import { requireAuthContext } from "@/lib/auth";
import { getAnalytics, getDashboardSummary } from "@/services/analytics.service";
import { getOfferSettings, getReturnSummary } from "@/services/return-offer.service";
import { getCompanyById } from "@/services/company.service";
import { StatCard } from "@/components/dashboard/stat-card";
import { VisitsChart } from "@/components/dashboard/visits-chart";
import { ReturnOverviewCard } from "@/components/dashboard/return-overview-card";
import { AnalyticsCard } from "@nfc-os/ui";

/**
 * Visão geral (F5 do plano da Fase 22) — o Retorno vira o assunto principal
 * da primeira tela que o dono vê: os 3 números, a receita estimada e o
 * checklist de ativação (\`ReturnOverviewCard\`), no lugar dos KPIs antigos
 * de topo. Os KPIs de acesso/dispositivo continuam abaixo, num bloco próprio
 * — ainda são dado real e útil, só deixam de ser a manchete da página. Ver
 * ADR-081/ADR-082.
 */
export default async function DashboardPage() {
  const ctx = await requireAuthContext();
  const [summary, analytics, returnSettings, returnSummary, company] = await Promise.all([
    getDashboardSummary(ctx.companyId),
    getAnalytics(ctx.companyId, 30),
    getOfferSettings(ctx.companyId),
    getReturnSummary(ctx.companyId, 30),
    getCompanyById(ctx.companyId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
        <p className="text-sm text-muted-foreground">O Retorno nos últimos 30 dias — o que traz o cliente de volta.</p>
      </div>

      <ReturnOverviewCard
        summary={returnSummary}
        offerExists={!!returnSettings.offer}
        hasPin={returnSettings.offer?.hasPin ?? false}
        active={returnSettings.offer?.active ?? false}
        avgTicketReais={company.roiAvgTicket}
      />

      <div>
        <h2 className="text-lg font-semibold tracking-tight">Acessos ao cartão</h2>
        <p className="text-sm text-muted-foreground">Dado histórico do cartão, independente do Retorno estar ativo.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total de acessos" value={summary.totalVisits.toLocaleString("pt-BR")} icon={BarChart3} />
        <StatCard
          label="Cliques no Google"
          value={summary.googleClicks.toLocaleString("pt-BR")}
          icon={MousePointerClick}
          accent="positive"
        />
        <StatCard label="Cartões ativos" value={summary.activeCards.toLocaleString("pt-BR")} icon={CreditCard} />
        <StatCard
          label="Mensagens recebidas"
          value={summary.privateFeedbacks.toLocaleString("pt-BR")}
          icon={MessageSquareWarning}
          hint="Ver em Mensagens"
        />
      </div>

      <AnalyticsCard title="Acessos (30 dias)">
        <VisitsChart data={analytics.timeseries} />
      </AnalyticsCard>
    </div>
  );
}
