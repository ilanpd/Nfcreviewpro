"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MousePointerClick, Star, LayoutGrid as TablesIcon, Megaphone, AlertTriangle } from "lucide-react";
import {
  KpiCard,
  AnalyticsCard,
  SmartBadge,
  ConnectionIndicator,
  LiveEventFeed,
  InsightCardList,
  FunnelChart,
  ActivityFeed,
  type LiveFeedEntry,
  type ActivityFeedEntry,
} from "@nfc-os/ui";
import { TableMapView } from "@/components/dashboard/table-map/table-map-view";
import { NextBestActionsCard } from "./next-best-actions-card";
import { useLiveConnection } from "@/lib/live/use-live-connection";
import { DESTINATION_META } from "@/domain/campaign/destination";
import { computeAllTableStatuses, type TableStatusAssignment } from "@/domain/table-map/status";
import type { LiveEvent } from "@/domain/live/types";
import type { ExecutiveTimelineEntry, FunnelStage, InsightCard, RankingEntry, RankingType } from "@/domain/analytics/types";
import type { CampaignTrendForecast } from "@/services/forecast-engine.service";
import type { ForecastResult } from "@/domain/analytics/types";
import type { TableCardItem, TableMapCampaignItem } from "@/types";
import type { BranchListItem, ZoneListItem } from "@/types";
import type { CampaignType } from "@/generated/prisma/client";

const DEMO_API_BASE = "/api/dev/demo";
// Uma mesa conta como "com atividade agora" enquanto seu último evento
// coube dentro desta janela — puramente visual, não é uma métrica de
// negócio, só o que mantém o KPI "vivo" sem crescer para sempre.
const RECENT_ACTIVITY_WINDOW_MS = 5 * 60_000;
// Funil/ranking/timeline/insights não mudam a cada segundo como os eventos
// SSE — um refresh a cada 30s já entrega a sensação de "vivo" pedida, sem
// abrir um segundo canal de push só para agregados que se movem devagar.
const ANALYTICS_REFRESH_MS = 30_000;
const ANALYTICS_DAYS = 30;

const TIMELINE_ICON: Record<ExecutiveTimelineEntry["kind"], React.ReactNode> = {
  CAMPAIGN_LIFECYCLE: <Megaphone className="size-3.5" />,
  AUDIT: <Star className="size-3.5" />,
  TOUCH_SPIKE: <MousePointerClick className="size-3.5" />,
  REVIEW_RECORD: <Star className="size-3.5" />,
};

interface CommandCenterViewProps {
  companyName: string;
  cards: TableCardItem[];
  zones: ZoneListItem[];
  branches: BranchListItem[];
  trayCampaigns: TableMapCampaignItem[];
  initialAssignments: TableStatusAssignment[];
  organizationId: string | null;
  initialTouchesToday: number;
  initialRatingsToday: number;
  activeCampaigns: { id: string; name: string; type: CampaignType }[];
  initialFunnel: FunnelStage[];
  initialTopRankings: Record<RankingType, RankingEntry | null>;
  initialTimeline: ExecutiveTimelineEntry[];
  initialInsights: InsightCard[];
  initialReviewGoalForecast: ForecastResult;
  initialCampaignTrend: CampaignTrendForecast | null;
  initialTopRecommendations: Parameters<typeof NextBestActionsCard>[0]["initialRecommendations"];
  /** Ver `TableMapView.liveApiBase` — o harness temporário da Fase 6
   * sobrepõe isto para rotas mock, já que este componente por padrão aponta
   * para a empresa de demonstração fixa em `/api/dev/demo`. */
  apiBase?: string;
}

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function CommandCenterView({
  companyName,
  cards,
  zones,
  branches,
  trayCampaigns,
  initialAssignments,
  organizationId,
  initialTouchesToday,
  initialRatingsToday,
  activeCampaigns,
  initialFunnel,
  initialTopRankings,
  initialTimeline,
  initialInsights,
  initialReviewGoalForecast,
  initialCampaignTrend,
  initialTopRecommendations,
  apiBase = DEMO_API_BASE,
}: CommandCenterViewProps) {
  const [touchesToday, setTouchesToday] = useState(initialTouchesToday);
  const [funnel, setFunnel] = useState(initialFunnel);
  const [topRankings, setTopRankings] = useState(initialTopRankings);
  const [timeline, setTimeline] = useState(initialTimeline);
  const [insights, setInsights] = useState(initialInsights);
  const [reviewGoalForecast, setReviewGoalForecast] = useState(initialReviewGoalForecast);
  const [campaignTrend, setCampaignTrend] = useState(initialCampaignTrend);
  const [ratingsToday, setRatingsToday] = useState(initialRatingsToday);
  const [feedEntries, setFeedEntries] = useState<LiveFeedEntry[]>([]);
  const recentActivityRef = useRef(new Map<string, number>());
  const [activeTableCount, setActiveTableCount] = useState(0);

  const pruneActiveTables = useCallback(() => {
    const cutoff = Date.now() - RECENT_ACTIVITY_WINDOW_MS;
    for (const [cardId, at] of recentActivityRef.current) {
      if (at < cutoff) recentActivityRef.current.delete(cardId);
    }
    setActiveTableCount(recentActivityRef.current.size);
  }, []);

  useEffect(() => {
    const interval = setInterval(pruneActiveTables, 15_000);
    return () => clearInterval(interval);
  }, [pruneActiveTables]);

  const handleEvent = useCallback(
    (event: LiveEvent) => {
      if (event.kind === "REDIRECT") setTouchesToday((n) => n + 1);
      if (event.kind === "RATING") setRatingsToday((n) => n + 1);
      if (event.cardId) {
        recentActivityRef.current.set(event.cardId, Date.now());
        setActiveTableCount(recentActivityRef.current.size);
      }
      setFeedEntries((prev) => [
        { id: event.id, kind: event.kind, message: event.message, timestamp: formatClock(event.createdAt) },
        ...prev,
      ].slice(0, 50));
    },
    []
  );

  const { status: connectionStatus } = useLiveConnection({ onEvent: handleEvent, apiBase });

  useEffect(() => {
    async function refreshAnalytics() {
      try {
        const [funnelRes, topRes, timelineRes, insightsRes, forecastRes] = await Promise.all([
          fetch(`${apiBase}/analytics/funnel?days=${ANALYTICS_DAYS}`).then((r) => r.json()),
          fetch(`${apiBase}/analytics/rankings?type=ALL&days=${ANALYTICS_DAYS}`).then((r) => r.json()),
          fetch(`${apiBase}/analytics/timeline?days=${ANALYTICS_DAYS}`).then((r) => r.json()),
          fetch(`${apiBase}/analytics/insights?days=${ANALYTICS_DAYS}`).then((r) => r.json()),
          fetch(`${apiBase}/analytics/forecast?goal=100`).then((r) => r.json()),
        ]);
        setFunnel(funnelRes.funnel);
        setTopRankings(topRes.top);
        setTimeline(timelineRes.timeline);
        setInsights(insightsRes.insights);
        setReviewGoalForecast(forecastRes.reviewGoal);
        setCampaignTrend(forecastRes.campaignTrend);
      } catch {
        // Silencioso — os valores anteriores continuam na tela até o próximo ciclo.
      }
    }

    const interval = setInterval(refreshAnalytics, ANALYTICS_REFRESH_MS);
    return () => clearInterval(interval);
  }, [apiBase]);

  const attentionInsights = insights.filter((i) => i.severity === "attention");
  const timelineEntries: ActivityFeedEntry[] = timeline.slice(0, 15).map((entry) => ({
    id: entry.id,
    actor: entry.title,
    action: entry.description ?? "",
    timestamp: new Date(entry.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
    icon: TIMELINE_ICON[entry.kind],
  }));

  // Reaproveita exatamente o preview de status do Fase 5 (o mesmo que o
  // Mapa de Mesas real usa) só para contar quantas mesas têm alguma
  // campanha vencendo agora — nenhuma lógica de resolução nova aqui.
  const statusMap = computeAllTableStatuses(cards, initialAssignments, organizationId);
  const tablesWithCampaign = [...statusMap.values()].filter(Boolean).length;

  return (
    <div className="flex min-h-screen flex-col gap-3 p-4 pb-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/dev/ceo" className="flex items-center gap-1 text-xs text-muted-foreground hover:underline">
            <ArrowLeft className="size-3" /> Modo CEO
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Command Center — {companyName}</h1>
        </div>
        <ConnectionIndicator status={connectionStatus} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-2">
          <KpiCard label="Toques hoje" value={touchesToday} icon={<MousePointerClick />} />
          <KpiCard label="Avaliações hoje" value={ratingsToday} icon={<Star />} />
          <KpiCard label="Mesas com atividade agora" value={activeTableCount} icon={<TablesIcon />} hint="últimos 5 minutos" />
          <KpiCard label="Mesas com campanha ativa" value={`${tablesWithCampaign}/${cards.length}`} icon={<Megaphone />} />
        </div>

        <div className="h-[70vh] overflow-hidden rounded-lg border lg:col-span-1">
          <TableMapView
            initialCards={cards}
            zones={zones}
            branches={branches}
            campaigns={trayCampaigns}
            initialAssignments={initialAssignments}
            organizationId={organizationId}
            canEditLayout={false}
            canAssign={false}
            liveApiBase={apiBase}
            className="h-full"
          />
        </div>

        <div className="flex flex-col gap-3">
          <NextBestActionsCard initialRecommendations={initialTopRecommendations} />

          <AnalyticsCard title="Campanhas ativas" description="O que está no ar agora, em toda a rede.">
            {activeCampaigns.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma campanha ativa.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {activeCampaigns.map((c) => (
                  <SmartBadge key={c.id} label={c.name} color={DESTINATION_META[c.type].color} />
                ))}
              </div>
            )}
          </AnalyticsCard>

          <AnalyticsCard title="Feed de eventos" description="Ao vivo, direto do salão." className="flex-1 overflow-hidden">
            <div className="max-h-[40vh] overflow-y-auto">
              <LiveEventFeed entries={feedEntries} />
            </div>
          </AnalyticsCard>
        </div>
      </div>

      {attentionInsights.length > 0 ? (
        <AnalyticsCard
          title="Alertas inteligentes"
          description="Quedas reais, não ruído do dia a dia."
          action={<AlertTriangle className="size-4 text-amber-500" />}
        >
          <InsightCardList insights={attentionInsights} />
        </AnalyticsCard>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <AnalyticsCard title="Funil vivo" description={`Fluxo de avaliação, últimos ${ANALYTICS_DAYS} dias`}>
          <FunnelChart stages={funnel} />
        </AnalyticsCard>

        <AnalyticsCard title="Insights automáticos" description="Gerados a partir dos próprios dados do salão">
          <InsightCardList insights={insights} />
        </AnalyticsCard>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <RankingLeaderCard title="Melhor campanha" entry={topRankings.CAMPAIGN} />
        <RankingLeaderCard title="Melhor zona" entry={topRankings.ZONE} />
        <RankingLeaderCard title="Melhor mesa" entry={topRankings.CARD} />
        <RankingLeaderCard title="Melhor funcionário" entry={topRankings.EMPLOYEE} />
        <RankingLeaderCard title="Horário campeão" entry={topRankings.HOUR} />
        <RankingLeaderCard title="Dia campeão" entry={topRankings.DAY_OF_WEEK} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <AnalyticsCard title="Timeline executiva" description="Cruza com o Time Machine do mapa acima">
          <ActivityFeed entries={timelineEntries} emptyLabel="Nenhum evento notável ainda." />
        </AnalyticsCard>

        <AnalyticsCard title="Forecast" description="Projeção a partir do ritmo recente — sempre uma estimativa">
          <div className="space-y-2">
            <p className="text-sm text-foreground">{reviewGoalForecast.message}</p>
            {campaignTrend ? <p className="text-sm text-muted-foreground">{campaignTrend.message}</p> : null}
          </div>
        </AnalyticsCard>
      </div>
    </div>
  );
}

function RankingLeaderCard({ title, entry }: { title: string; entry: RankingEntry | null }) {
  return (
    <AnalyticsCard title={title}>
      {entry ? (
        <div>
          <p className="truncate text-base font-semibold text-foreground">{entry.label}</p>
          <p className="text-xs text-muted-foreground">
            {entry.value.toLocaleString("pt-BR")} {entry.secondaryLabel ?? ""}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Sem dados suficientes</p>
      )}
    </AnalyticsCard>
  );
}
