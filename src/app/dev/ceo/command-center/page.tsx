import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { listCardsForMap, listActiveCampaignsForMap, listAssignmentsForStatus } from "@/services/table-map.service";
import { listZones } from "@/services/zone.service";
import { listBranches } from "@/services/branch.service";
import { getFunnel, getExecutiveTimeline } from "@/services/analytics-engine.service";
import { getTopOfEachRanking } from "@/services/ranking-engine.service";
import { getInsights } from "@/services/insights-engine.service";
import { getReviewGoalForecast, getTopCampaignTrend } from "@/services/forecast-engine.service";
import { listTopActionableRecommendations } from "@/services/recommendation-engine.service";
import { CommandCenterView } from "./command-center-view";
import { devToolsEnabled } from "@/lib/dev/gate";

const COMMAND_CENTER_DAYS = 30;

/**
 * Command Center (Fase 6) — a mesma arquitetura de sempre (Campaign
 * Resolution Engine, RedirectLog, Table Map, Design System), orquestrada
 * numa única tela para uma demonstração executiva. Roda sobre a empresa
 * "Bella Vista" do seed, sem autenticação de verdade — por isso as rotas de
 * Live Mode/Heatmap/Time Machine que ele usa têm um par dedicado em
 * `/api/dev/demo/*` (ver ADR-027), mas a leitura inicial e o Mapa de Mesas em
 * si são exatamente os mesmos serviços do dashboard real.
 */
export default async function CommandCenterPage() {
  if (!devToolsEnabled()) notFound();

  const company = await getDemoCompany();

  if (!company) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-10">
        <Link href="/dev/ceo" className="flex items-center gap-1 text-xs text-muted-foreground hover:underline">
          <ArrowLeft className="size-3" /> Modo CEO
        </Link>
        <p className="text-sm text-muted-foreground">
          A empresa de demonstração &ldquo;bella-vista&rdquo; ainda não existe neste banco. Rode{" "}
          <code className="rounded bg-muted px-1 py-0.5">npm run db:seed</code> e recarregue esta página.
        </p>
      </main>
    );
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    cards,
    zones,
    branches,
    trayCampaigns,
    assignments,
    touchesToday,
    ratingsToday,
    activeCampaigns,
    funnel,
    topRankings,
    timeline,
    insights,
    reviewGoal,
    campaignTrend,
    topRecommendations,
  ] = await Promise.all([
    listCardsForMap(company.id),
    listZones(company.id),
    listBranches(company.id),
    listActiveCampaignsForMap(company.id),
    listAssignmentsForStatus(company.id, company.organizationId),
    prisma.redirectLog.count({ where: { companyId: company.id, createdAt: { gte: todayStart } } }),
    prisma.ratingEvent.count({ where: { companyId: company.id, createdAt: { gte: todayStart } } }),
    prisma.campaign.findMany({
      where: { companyId: company.id, status: "ACTIVE" },
      select: { id: true, name: true, type: true },
      orderBy: { priority: "desc" },
    }),
    getFunnel(company.id, COMMAND_CENTER_DAYS),
    getTopOfEachRanking(company.id, COMMAND_CENTER_DAYS),
    getExecutiveTimeline(company.id, COMMAND_CENTER_DAYS),
    getInsights(company.id, COMMAND_CENTER_DAYS),
    getReviewGoalForecast(company.id, 100),
    getTopCampaignTrend(company.id),
    listTopActionableRecommendations(company.id, 5),
  ]);

  return (
    <CommandCenterView
      companyName={company.name}
      cards={cards}
      zones={zones}
      branches={branches}
      trayCampaigns={trayCampaigns}
      initialAssignments={assignments}
      organizationId={company.organizationId}
      initialTouchesToday={touchesToday}
      initialRatingsToday={ratingsToday}
      activeCampaigns={activeCampaigns}
      initialFunnel={funnel}
      initialTopRankings={topRankings}
      initialTimeline={timeline}
      initialInsights={insights}
      initialReviewGoalForecast={reviewGoal}
      initialCampaignTrend={campaignTrend}
      initialTopRecommendations={topRecommendations}
    />
  );
}
