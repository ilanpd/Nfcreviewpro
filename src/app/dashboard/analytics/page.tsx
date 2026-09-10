import { requireAuthContext } from "@/lib/auth";
import { roleHasPermission } from "@/domain/rbac/roles";
import { getAnalytics } from "@/services/analytics.service";
import { listFeedback } from "@/services/feedback.service";
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
import { VisitsChart } from "@/components/dashboard/visits-chart";
import { HourlyChart } from "@/components/dashboard/hourly-chart";
import { BreakdownList } from "@/components/dashboard/breakdown-list";
import { FeedbackList } from "@/components/dashboard/feedback-list";
import { AnalyticsEnterpriseView } from "@/components/dashboard/analytics/analytics-enterprise-view";

const DEFAULT_DAYS = 30;

export default async function AnalyticsPage() {
  const ctx = await requireAuthContext();
  const [analytics, feedback, kpis, funnel, insights, timeline, comparatives, roi, topRankings] = await Promise.all([
    getAnalytics(ctx.companyId, 30),
    listFeedback(ctx.companyId),
    getExecutiveKpis(ctx.companyId, DEFAULT_DAYS),
    getFunnel(ctx.companyId, DEFAULT_DAYS),
    getInsights(ctx.companyId, DEFAULT_DAYS),
    getExecutiveTimeline(ctx.companyId, DEFAULT_DAYS),
    getPeriodComparatives(ctx.companyId),
    getRoiSummary(ctx.companyId, DEFAULT_DAYS),
    getTopOfEachRanking(ctx.companyId, DEFAULT_DAYS),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Comportamento dos clientes nos últimos 30 dias.</p>
      </div>

      <Tabs defaultValue="enterprise">
        <TabsList>
          <TabsTrigger value="enterprise">Enterprise</TabsTrigger>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="feedback">Feedbacks privados</TabsTrigger>
        </TabsList>

        <TabsContent value="enterprise">
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

        <TabsContent value="feedback">
          <FeedbackList initialFeedback={feedback} canManage={roleHasPermission(ctx.role, "feedback:resolve")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
