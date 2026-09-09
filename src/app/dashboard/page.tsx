import { BarChart3, CreditCard, MessageSquareWarning, MousePointerClick, Star, Users2 } from "lucide-react";
import { requireAuthContext } from "@/lib/auth";
import { getAnalytics, getDashboardSummary } from "@/services/analytics.service";
import { StatCard } from "@/components/dashboard/stat-card";
import { VisitsChart } from "@/components/dashboard/visits-chart";
import { AnalyticsCard } from "@nfc-os/ui";

export default async function DashboardPage() {
  const ctx = await requireAuthContext();
  const [summary, analytics] = await Promise.all([
    getDashboardSummary(ctx.companyId),
    getAnalytics(ctx.companyId, 30),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
        <p className="text-sm text-muted-foreground">Desempenho dos seus cartões NFC nos últimos 30 dias.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total de acessos" value={summary.totalVisits.toLocaleString("pt-BR")} icon={BarChart3} />
        <StatCard
          label="Cliques no Google"
          value={summary.googleClicks.toLocaleString("pt-BR")}
          icon={MousePointerClick}
          accent="positive"
        />
        <StatCard
          label="Feedbacks privados"
          value={summary.privateFeedbacks.toLocaleString("pt-BR")}
          icon={MessageSquareWarning}
        />
        <StatCard
          label="Taxa de conversão"
          value={`${(summary.conversionRate * 100).toFixed(1)}%`}
          icon={Users2}
          hint="Avaliações que viraram review no Google"
        />
        <StatCard label="Cartões ativos" value={summary.activeCards.toLocaleString("pt-BR")} icon={CreditCard} />
      </div>

      <AnalyticsCard
        title="Acessos e conversões (30 dias)"
        action={
          summary.averageStars ? (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="size-4 fill-amber-400 text-amber-400" />
              {summary.averageStars.toFixed(1)} de média
            </div>
          ) : undefined
        }
      >
        <VisitsChart data={analytics.timeseries} />
      </AnalyticsCard>
    </div>
  );
}
