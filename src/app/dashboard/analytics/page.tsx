import { LineChart } from "lucide-react";
import { requireAuthContext } from "@/lib/auth";
import { planHasFeature, minimumPlanForFeature } from "@/lib/plans";
import { getAnalytics } from "@/services/analytics.service";
import {
  getExecutiveKpis,
  getFunnel,
  getPeriodComparatives,
  getRoiSummary,
  getExecutiveTimeline,
} from "@/services/analytics-engine.service";
import { getTopOfEachRanking } from "@/services/ranking-engine.service";
import { getInsights } from "@/services/insights-engine.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsCard } from "@nfc-os/ui";
import { PlanUpsell } from "@/components/dashboard/plan-upsell";
import { VisitsChart } from "@/components/dashboard/visits-chart";
import { HourlyChart } from "@/components/dashboard/hourly-chart";
import { BreakdownList } from "@/components/dashboard/breakdown-list";
import { AnalyticsEnterpriseView } from "@/components/dashboard/analytics/analytics-enterprise-view";

// Confirmado em produção (vercel logs): esta página já levou 22.8s pra
// renderizar pra uma empresa com bastante histórico, perto o bastante do
// timeout padrão da função serverless pra derrubar a página
// intermitentemente ("Não foi possível carregar esta página") mesmo sem
// nenhum erro real de código. A causa raiz era \`listFeedback\` sem limite de
// tempo/quantidade — o feedback saiu daqui de vez no C7 (\`/dashboard/mensagens\`,
// que já nasce com o limite de 90 dias). Este teto mais alto fica como rede
// de segurança das 7 queries do Enterprise, não como a correção principal.
export const maxDuration = 60;

const DEFAULT_DAYS = 30;

/**
 * Fase 20 — só a aba "Enterprise" (KPIs executivos, funil, ROI, rankings) é
 * Pro+ (`planHasFeature`, `lib/plans.ts`). "Visão geral" continua disponível
 * no Starter — negar isso removeria valor já entregue hoje a quem já paga,
 * sem ganho nenhum de clareza comercial. As 7 queries do Enterprise nem
 * rodam quando o plano não inclui a feature — nunca busca dado só pra jogar
 * fora atrás de um upsell. "Feedbacks privados" saiu para \`/dashboard/mensagens\`
 * no C7 (F5 do plano da Fase 22).
 */
export default async function AnalyticsPage() {
  const ctx = await requireAuthContext();
  const hasEnterpriseAnalytics = planHasFeature(ctx.plan, "analytics_full");

  const [analytics, enterpriseData] = await Promise.all([
    getAnalytics(ctx.companyId, 30),
    hasEnterpriseAnalytics
      ? Promise.all([
          getExecutiveKpis(ctx.companyId, DEFAULT_DAYS),
          getFunnel(ctx.companyId, DEFAULT_DAYS),
          getInsights(ctx.companyId, DEFAULT_DAYS),
          getExecutiveTimeline(ctx.companyId, DEFAULT_DAYS),
          getPeriodComparatives(ctx.companyId),
          getRoiSummary(ctx.companyId, DEFAULT_DAYS),
          getTopOfEachRanking(ctx.companyId, DEFAULT_DAYS),
        ])
      : null,
  ]);
  const [kpis, funnel, insights, timeline, comparatives, roi, topRankings] = enterpriseData ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Comportamento dos clientes nos últimos 30 dias.</p>
      </div>

      <Tabs defaultValue={hasEnterpriseAnalytics ? "enterprise" : "overview"}>
        <TabsList>
          <TabsTrigger value="enterprise">Enterprise</TabsTrigger>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
        </TabsList>

        <TabsContent value="enterprise">
          {hasEnterpriseAnalytics && kpis && funnel && insights && timeline && comparatives && roi && topRankings ? (
            <AnalyticsEnterpriseView
              initialDays={DEFAULT_DAYS}
              initialKpis={kpis}
              initialFunnel={funnel}
              initialInsights={insights}
              initialTimeline={timeline}
              initialComparatives={comparatives}
              initialRoi={roi}
              initialTopRankings={topRankings}
            />
          ) : (
            <PlanUpsell
              icon={<LineChart />}
              featureLabel="Analytics Enterprise (KPIs executivos, funil, ROI, rankings)"
              requiredPlan={minimumPlanForFeature("analytics_full")}
              currentPlan={ctx.plan}
            />
          )}
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <AnalyticsCard title="Acessos e conversões">
            <VisitsChart data={analytics.timeseries} />
          </AnalyticsCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <AnalyticsCard title="Acessos por horário">
              <HourlyChart data={analytics.byHour} />
            </AnalyticsCard>

            <AnalyticsCard title="Localização aproximada">
              <BreakdownList items={analytics.byLocation} />
            </AnalyticsCard>

            <AnalyticsCard title="Dispositivos">
              <BreakdownList items={analytics.byDevice} />
            </AnalyticsCard>

            <AnalyticsCard title="Navegadores">
              <BreakdownList items={analytics.byBrowser} />
            </AnalyticsCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
