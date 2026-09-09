import { requireAuthContext } from "@/lib/auth";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
          <Card className="border-none shadow-sm shadow-black/5">
            <CardHeader>
              <CardTitle className="text-base font-medium">Acessos e conversões</CardTitle>
            </CardHeader>
            <CardContent>
              <VisitsChart data={analytics.timeseries} />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-none shadow-sm shadow-black/5">
              <CardHeader>
                <CardTitle className="text-base font-medium">Acessos por horário</CardTitle>
              </CardHeader>
              <CardContent>
                <HourlyChart data={analytics.byHour} />
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm shadow-black/5">
              <CardHeader>
                <CardTitle className="text-base font-medium">Localização aproximada</CardTitle>
              </CardHeader>
              <CardContent>
                <BreakdownList items={analytics.byLocation} />
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm shadow-black/5">
              <CardHeader>
                <CardTitle className="text-base font-medium">Dispositivos</CardTitle>
              </CardHeader>
              <CardContent>
                <BreakdownList items={analytics.byDevice} />
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm shadow-black/5">
              <CardHeader>
                <CardTitle className="text-base font-medium">Navegadores</CardTitle>
              </CardHeader>
              <CardContent>
                <BreakdownList items={analytics.byBrowser} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="feedback">
          <FeedbackList initialFeedback={feedback} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
