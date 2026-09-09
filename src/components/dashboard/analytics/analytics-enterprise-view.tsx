"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  MousePointerClick,
  Star,
  MessageSquareText,
  Percent,
  TrendingUp,
  Calendar,
  CalendarRange,
  Download,
  ChevronDown,
  Megaphone,
  MapPinned,
  LayoutGrid,
  Users,
  Clock,
  CalendarDays,
} from "lucide-react";
import {
  KpiCard,
  AnalyticsCard,
  ActivityFeed,
  InsightCardList,
  RankingList,
  FunnelChart,
  type ActivityFeedEntry,
} from "@nfc-os/ui";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  ExecutiveTimelineEntry,
  FunnelStage,
  InsightCard,
  KpiValue,
  RankingEntry,
  RankingType,
  RoiSummary,
} from "@/domain/analytics/types";
import type { PeriodComparatives } from "@/services/analytics-engine.service";
import type { CampaignTrendForecast } from "@/services/forecast-engine.service";
import type { ForecastResult } from "@/domain/analytics/types";

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

const RANKING_TABS: { type: RankingType; label: string; icon: React.ReactNode }[] = [
  { type: "CAMPAIGN", label: "Campanhas", icon: <Megaphone className="size-3.5" /> },
  { type: "ZONE", label: "Zonas", icon: <MapPinned className="size-3.5" /> },
  { type: "CARD", label: "Mesas", icon: <LayoutGrid className="size-3.5" /> },
  { type: "EMPLOYEE", label: "Funcionários", icon: <Users className="size-3.5" /> },
  { type: "HOUR", label: "Horários", icon: <Clock className="size-3.5" /> },
  { type: "DAY_OF_WEEK", label: "Dias", icon: <CalendarDays className="size-3.5" /> },
];

const TIMELINE_ICON: Record<ExecutiveTimelineEntry["kind"], React.ReactNode> = {
  CAMPAIGN_LIFECYCLE: <Megaphone className="size-3.5" />,
  AUDIT: <Calendar className="size-3.5" />,
  TOUCH_SPIKE: <TrendingUp className="size-3.5" />,
  REVIEW_RECORD: <Star className="size-3.5" />,
};

const KPI_ICON: Record<string, React.ReactNode> = {
  approaches_today: <MousePointerClick />,
  conversions: <Percent />,
  reviews_generated: <Star />,
  ctr: <MousePointerClick />,
  conversion_rate: <Percent />,
  weekly_growth: <Calendar />,
  monthly_growth: <CalendarRange />,
  estimated_revenue: <TrendingUp />,
};

function formatKpiValue(kpi: KpiValue): string {
  if (kpi.unit === "percent") return `${kpi.value.toFixed(1)}%`;
  if (kpi.unit === "currency") return `R$ ${kpi.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return kpi.value.toLocaleString("pt-BR");
}

function formatTimelineDate(ms: number): string {
  return new Date(ms).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao carregar dados");
  return res.json();
}

interface AnalyticsEnterpriseViewProps {
  initialDays: number;
  initialKpis: KpiValue[];
  initialFunnel: FunnelStage[];
  initialInsights: InsightCard[];
  initialTimeline: ExecutiveTimelineEntry[];
  initialComparatives: PeriodComparatives;
  initialRoi: RoiSummary;
  initialTopRankings: Record<RankingType, RankingEntry | null>;
}

export function AnalyticsEnterpriseView({
  initialDays,
  initialKpis,
  initialFunnel,
  initialInsights,
  initialTimeline,
  initialComparatives,
  initialRoi,
  initialTopRankings,
}: AnalyticsEnterpriseViewProps) {
  const [days, setDays] = useState(initialDays);
  const [kpis, setKpis] = useState(initialKpis);
  const [funnel, setFunnel] = useState(initialFunnel);
  const [insights, setInsights] = useState(initialInsights);
  const [timeline, setTimeline] = useState(initialTimeline);
  const [comparatives, setComparatives] = useState(initialComparatives);
  const [roi, setRoi] = useState(initialRoi);
  const [topRankings, setTopRankings] = useState(initialTopRankings);
  const [loading, setLoading] = useState(false);

  const [activeRankingType, setActiveRankingType] = useState<RankingType>("CAMPAIGN");
  const [rankingEntries, setRankingEntries] = useState<Record<RankingType, RankingEntry[] | null>>({
    CAMPAIGN: null,
    ZONE: null,
    CARD: null,
    EMPLOYEE: null,
    HOUR: null,
    DAY_OF_WEEK: null,
  });

  const [goal, setGoal] = useState(100);
  const [forecast, setForecast] = useState<{ reviewGoal: ForecastResult; campaignTrend: CampaignTrendForecast | null } | null>(null);

  const reloadAll = useCallback(async (nextDays: number) => {
    setLoading(true);
    try {
      const [kpisRes, funnelRes, insightsRes, timelineRes, comparativesRes, roiRes, topRes] = await Promise.all([
        fetchJson<{ kpis: KpiValue[] }>(`/api/analytics/kpis?days=${nextDays}`),
        fetchJson<{ funnel: FunnelStage[] }>(`/api/analytics/funnel?days=${nextDays}`),
        fetchJson<{ insights: InsightCard[] }>(`/api/analytics/insights?days=${nextDays}`),
        fetchJson<{ timeline: ExecutiveTimelineEntry[] }>(`/api/analytics/timeline?days=${nextDays}`),
        fetchJson<{ comparatives: PeriodComparatives }>(`/api/analytics/comparatives`),
        fetchJson<{ roi: RoiSummary }>(`/api/analytics/roi?days=${nextDays}`),
        fetchJson<{ top: Record<RankingType, RankingEntry | null> }>(`/api/analytics/rankings?type=ALL&days=${nextDays}`),
      ]);
      setKpis(kpisRes.kpis);
      setFunnel(funnelRes.funnel);
      setInsights(insightsRes.insights);
      setTimeline(timelineRes.timeline);
      setComparatives(comparativesRes.comparatives);
      setRoi(roiRes.roi);
      setTopRankings(topRes.top);
      setRankingEntries({ CAMPAIGN: null, ZONE: null, CARD: null, EMPLOYEE: null, HOUR: null, DAY_OF_WEEK: null });
    } catch {
      // silencioso — os dados anteriores continuam na tela em vez de sumir
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (days === initialDays) return;
    reloadAll(days);
  }, [days, initialDays, reloadAll]);

  useEffect(() => {
    if (rankingEntries[activeRankingType] !== null) return;
    fetchJson<{ entries: RankingEntry[] }>(`/api/analytics/rankings?type=${activeRankingType}&days=${days}&limit=10`)
      .then((res) => setRankingEntries((prev) => ({ ...prev, [activeRankingType]: res.entries })))
      .catch(() => {});
  }, [activeRankingType, days, rankingEntries]);

  useEffect(() => {
    fetchJson<{ reviewGoal: ForecastResult; campaignTrend: CampaignTrendForecast | null }>(`/api/analytics/forecast?goal=${goal}`)
      .then(setForecast)
      .catch(() => {});
  }, [goal]);

  const timelineEntries: ActivityFeedEntry[] = timeline.map((entry) => ({
    id: entry.id,
    actor: entry.title,
    action: entry.description ?? "",
    timestamp: formatTimelineDate(entry.at),
    icon: TIMELINE_ICON[entry.kind],
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger size="sm" className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="size-3.5" /> Exportar <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a href={`/api/analytics/export?format=csv&days=${days}`}>CSV</a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`/api/analytics/export?format=xlsx&days=${days}`}>Excel (.xlsx)</a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`/api/analytics/export?format=pdf&days=${days}`}>PDF executivo</a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.key}
            label={kpi.label}
            value={formatKpiValue(kpi)}
            icon={KPI_ICON[kpi.key]}
            delta={kpi.delta ?? undefined}
            hint={kpi.delta === undefined || kpi.delta === null ? kpi.hint : undefined}
          />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnalyticsCard title="Melhor campanha" description="Mais utilizada no período">
          <LeaderValue entry={topRankings.CAMPAIGN} />
        </AnalyticsCard>
        <AnalyticsCard title="Melhor zona" description="Mais conversões">
          <LeaderValue entry={topRankings.ZONE} />
        </AnalyticsCard>
        <AnalyticsCard title="Melhor mesa" description="Mais conversões">
          <LeaderValue entry={topRankings.CARD} />
        </AnalyticsCard>
        <AnalyticsCard title="Melhor funcionário" description="Mais conversões">
          <LeaderValue entry={topRankings.EMPLOYEE} />
        </AnalyticsCard>
        <AnalyticsCard title="Horário campeão" description="Mais conversões">
          <LeaderValue entry={topRankings.HOUR} />
        </AnalyticsCard>
        <AnalyticsCard title="Dia campeão" description="Mais conversões">
          <LeaderValue entry={topRankings.DAY_OF_WEEK} />
        </AnalyticsCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsCard title="Funil Inteligente" description="Do toque à avaliação publicada">
          <FunnelChart stages={funnel} />
        </AnalyticsCard>

        <AnalyticsCard title="Insights automáticos" description="Gerados a partir dos seus próprios dados, não frases fixas">
          <InsightCardList insights={insights} />
        </AnalyticsCard>
      </div>

      <AnalyticsCard title="Rankings" description="Quem está performando melhor, por categoria">
        <Tabs value={activeRankingType} onValueChange={(v) => setActiveRankingType(v as RankingType)}>
          <TabsList>
            {RANKING_TABS.map((tab) => (
              <TabsTrigger key={tab.type} value={tab.type} className="gap-1.5">
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="mt-4">
          <RankingList entries={rankingEntries[activeRankingType] ?? []} />
        </div>
      </AnalyticsCard>

      <div className="grid gap-4 sm:grid-cols-3">
        <ComparativeCard label={comparatives.dayOverDay.currentLabel} vsLabel={comparatives.dayOverDay.previousLabel} data={comparatives.dayOverDay} />
        <ComparativeCard label={comparatives.weekOverWeek.currentLabel} vsLabel={comparatives.weekOverWeek.previousLabel} data={comparatives.weekOverWeek} />
        <ComparativeCard label={comparatives.monthOverMonth.currentLabel} vsLabel={comparatives.monthOverMonth.previousLabel} data={comparatives.monthOverMonth} />
      </div>

      <AnalyticsCard title="Timeline Executiva" description="Eventos importantes deste período — cruza com o Time Machine do Mapa de Mesas">
        <ActivityFeed entries={timelineEntries} emptyLabel="Nenhum evento notável neste período ainda." />
      </AnalyticsCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsCard title="Forecast Inteligente" description="Estimativa a partir do ritmo recente — sempre uma projeção, nunca uma garantia">
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="forecast-goal" className="text-xs text-muted-foreground">
                  Meta de avaliações
                </Label>
                <Input id="forecast-goal" type="number" min={1} value={goal} onChange={(e) => setGoal(Math.max(1, Number(e.target.value)))} className="w-32" />
              </div>
            </div>
            {forecast ? (
              <>
                <p className="text-sm text-foreground">{forecast.reviewGoal.message}</p>
                {forecast.campaignTrend ? <p className="text-sm text-muted-foreground">{forecast.campaignTrend.message}</p> : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Calculando…</p>
            )}
          </div>
        </AnalyticsCard>

        <AnalyticsCard title="ROI Mode" description="Toques e conversões traduzidos em dinheiro estimado">
          {roi.configured ? (
            <div className="space-y-2">
              <p className="text-3xl font-semibold tracking-tight text-foreground">
                R$ {roi.estimatedRevenue!.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">
                {roi.qualifyingInteractions} interações × R$ {roi.avgTicket!.toFixed(2)} × {(roi.returnRate! * 100).toFixed(0)}% de retorno estimado
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Configure o ticket médio e a taxa de retorno para ver a receita estimada influenciada pelo NFC.</p>
              <Button size="sm" asChild>
                <Link href="/dashboard/settings">Configurar ROI Mode</Link>
              </Button>
            </div>
          )}
        </AnalyticsCard>
      </div>

      {loading ? <p className="text-center text-xs text-muted-foreground">Atualizando…</p> : null}
    </div>
  );
}

function LeaderValue({ entry }: { entry: RankingEntry | null }) {
  if (!entry) return <p className="text-sm text-muted-foreground">Sem dados suficientes</p>;
  return (
    <div>
      <p className="truncate text-lg font-semibold text-foreground">{entry.label}</p>
      <p className="text-xs text-muted-foreground">
        {entry.value.toLocaleString("pt-BR")} {entry.secondaryLabel ?? ""}
      </p>
    </div>
  );
}

function ComparativeCard({ label, vsLabel, data }: { label: string; vsLabel: string; data: { current: number; previous: number; deltaPercent: number | null } }) {
  return (
    <KpiCard
      label={`${label} vs. ${vsLabel}`}
      value={data.current.toLocaleString("pt-BR")}
      hint={data.deltaPercent === null ? `Anterior: ${data.previous}` : undefined}
      delta={data.deltaPercent ?? undefined}
      icon={<MessageSquareText />}
    />
  );
}
