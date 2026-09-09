"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Play, Rocket, Radio } from "lucide-react";
import { KpiCard, RecommendationCard, SmartBadge } from "@nfc-os/ui";
import { TableMapView } from "@/components/dashboard/table-map/table-map-view";
import { BrandProvider } from "@/components/white-label/brand-provider";
import { useLiveConnection } from "@/lib/live/use-live-connection";
import { toRecommendationCardData } from "@/domain/playbooks/present";
import { DemoTimeline } from "./demo-timeline";
import type { LiveEvent } from "@/domain/live/types";
import type { KpiValue, RoiSummary } from "@/domain/analytics/types";
import type { TableStatusAssignment } from "@/domain/table-map/status";
import type { TableCardItem, TableMapCampaignItem, BranchListItem, ZoneListItem } from "@/types";
import type { BrandConfig } from "@/domain/white-label/types";
import type { ScenarioDefinition, ScenarioId } from "@/domain/demo/types";

const DEMO_API_BASE = "/api/demo";

interface StoryBeat {
  id: string;
  narration: string;
  scenario?: ScenarioId;
  cycleBrand?: boolean;
}

const STORY: StoryBeat[] = [
  { id: "hero", narration: "A Bella Vista ganha vida." },
  { id: "map", narration: "O mapa reage — cada mesa é um cartão NFC real.", scenario: "restaurante-lotado" },
  { id: "events", narration: "Os eventos chegam ao vivo, um por um." },
  { id: "kpis", narration: "Os KPIs sobem em tempo real." },
  { id: "heatmap", narration: "O heatmap respira — mesas aquecendo, mesas esfriando." },
  { id: "playbooks", narration: "Os Playbooks percebem o padrão e recomendam.", scenario: "happy-hour" },
  { id: "autopilot", narration: "O AutoPilot age sozinho — com log completo e Desfazer.", scenario: "autopilot-trabalhando" },
  { id: "roi", narration: "O ROI muda — receita influenciada, ao vivo." },
  { id: "whitelabel", narration: "A mesma operação, quatro marcas diferentes.", cycleBrand: true },
];

interface DemoOSViewProps {
  cards: TableCardItem[];
  zones: ZoneListItem[];
  branches: BranchListItem[];
  trayCampaigns: TableMapCampaignItem[];
  initialAssignments: TableStatusAssignment[];
  organizationId: string | null;
  initialKpis: KpiValue[];
  initialRoi: RoiSummary;
  initialRecommendations: { id: string; headline: string; confidence: number; estimatedImpact: unknown; playbook: { category: string; estimatedDurationHours: number } }[];
  brands: BrandConfig[];
  scenarios: ScenarioDefinition[];
  /** Investor Mode reaproveita a mesma view, só forçando avanço automático
   * sem espera de clique e sem os controles manuais. */
  autoPlay?: boolean;
}

export function DemoOSView({
  cards,
  zones,
  branches,
  trayCampaigns,
  initialAssignments,
  organizationId,
  initialKpis,
  initialRoi,
  initialRecommendations,
  brands,
  scenarios,
  autoPlay = false,
}: DemoOSViewProps) {
  const [brandIndex, setBrandIndex] = useState(0);
  const [kpis, setKpis] = useState(initialKpis);
  const [roi, setRoi] = useState(initialRoi);
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [feedCount, setFeedCount] = useState(0);
  const [storyIndex, setStoryIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const brand = brands[brandIndex % brands.length] ?? null;

  const handleEvent = useCallback((event: LiveEvent) => {
    setFeedCount((n) => n + 1);
    void event;
  }, []);
  const { status: connectionStatus } = useLiveConnection({ onEvent: handleEvent, apiBase: DEMO_API_BASE });

  const refreshKpis = useCallback(async () => {
    try {
      const res = await fetch(`${DEMO_API_BASE}/kpis`);
      if (!res.ok) return;
      const data = await res.json();
      setKpis(data.kpis);
      setRoi(data.roi);
    } catch {
      // mantém os últimos valores conhecidos
    }
  }, []);

  const refreshRecommendations = useCallback(async () => {
    try {
      const res = await fetch(`${DEMO_API_BASE}/playbooks`);
      if (!res.ok) return;
      const data = await res.json();
      setRecommendations(data.recommendations);
    } catch {
      // mantém os últimos valores conhecidos
    }
  }, []);

  const runScenario = useCallback(async (id: ScenarioId) => {
    try {
      await fetch(`${DEMO_API_BASE}/scenarios/${id}/run`, { method: "POST" });
    } catch {
      // a narração continua mesmo se a ação de servidor falhar (ex.: limite de taxa)
    }
  }, []);

  const advanceStory = useCallback(
    (index: number) => {
      if (index >= STORY.length) {
        setRunning(false);
        return;
      }
      setStoryIndex(index);
      const beat = STORY[index];

      (async () => {
        if (beat.scenario) await runScenario(beat.scenario);
        if (beat.cycleBrand) setBrandIndex((i) => i + 1);
        await refreshKpis();
        await refreshRecommendations();
      })();

      timeoutRef.current = setTimeout(() => advanceStory(index + 1), autoPlay ? 12_000 : 9_000);
    },
    [runScenario, refreshKpis, refreshRecommendations, autoPlay]
  );

  const startStory = useCallback(() => {
    setRunning(true);
    advanceStory(0);
  }, [advanceStory]);

  useEffect(() => {
    if (autoPlay) startStory();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quer disparar uma vez na montagem
  }, []);

  const currentBeat = storyIndex >= 0 ? STORY[storyIndex] : null;

  return (
    <BrandProvider brand={brand}>
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand-primary,var(--brand))_14%,var(--background))_0%,var(--background)_60%)]">
        <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-elevated [&_svg]:size-4">
              <Sparkles />
            </span>
            <span className="text-sm font-semibold text-foreground">NFC OS — Demo</span>
          </div>
          <div className="flex items-center gap-2">
            {!autoPlay ? (
              <a href="/demo/investor" className="hidden rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted sm:inline-flex">
                Modo Investidor
              </a>
            ) : null}
            <SmartBadge
              label={connectionStatus === "connected" ? `Ao vivo · ${feedCount} eventos` : "Conectando…"}
              tone={connectionStatus === "connected" ? "success" : "neutral"}
              pulse={connectionStatus === "connected"}
              icon={<Radio />}
            />
          </div>
        </header>

        {/* Hero */}
        <section className="relative z-10 mx-auto max-w-3xl px-6 pb-8 pt-6 text-center sm:pt-10">
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {brand?.name ?? "Bella Vista"} está funcionando agora.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Sem cadastro. Sem imaginar como seria em produção. Cada número abaixo nasce dos mesmos motores reais do NFC OS.
          </motion.p>
          {!running ? (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              onClick={startStory}
              className="brand-glow brand-ripple mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-elevated transition-transform hover:scale-[1.02]"
            >
              <Play className="size-4" /> Assistir a operação acontecer
            </motion.button>
          ) : null}
        </section>

        {/* Narração */}
        <div className="sticky top-0 z-20 flex justify-center px-4">
          <AnimatePresence mode="wait">
            {currentBeat ? (
              <motion.div
                key={currentBeat.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="mb-4 rounded-full border border-border/60 bg-card/90 px-4 py-2 text-xs font-medium text-foreground shadow-elevated backdrop-blur-md"
              >
                {currentBeat.narration}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <main className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.slice(0, 4).map((kpi) => (
              <KpiCard key={kpi.key} label={kpi.label} value={kpi.value.toLocaleString("pt-BR")} hint={kpi.hint} />
            ))}
          </div>

          <div className="h-[60vh] overflow-hidden rounded-2xl border border-border/60 shadow-elevated">
            <TableMapView
              initialCards={cards}
              zones={zones}
              branches={branches}
              campaigns={trayCampaigns}
              initialAssignments={initialAssignments}
              organizationId={organizationId}
              canEditLayout={false}
              canAssign={false}
              liveApiBase={DEMO_API_BASE}
              className="h-full"
            />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Próximas melhores ações</h2>
            {recommendations.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma recomendação agora — clique em &ldquo;Assistir a operação acontecer&rdquo; para gerar uma de verdade.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recommendations.map((r) => (
                  <RecommendationCard key={r.id} recommendation={toRecommendationCardData(r)} compact onApply={() => {}} onExplain={() => {}} onIgnore={() => {}} />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-md">
            <p className="text-xs text-muted-foreground">Receita influenciada estimada (30 dias)</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {roi.configured ? `R$ ${roi.estimatedRevenue!.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : "Configure o ROI para ver receita estimada"}
            </p>
          </div>

          {!autoPlay ? (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Linha do tempo</h2>
              <DemoTimeline apiBase={DEMO_API_BASE} />
            </div>
          ) : null}

          {!autoPlay ? (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Cenários</h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {scenarios.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => runScenario(s.id).then(refreshKpis).then(refreshRecommendations)}
                    className="rounded-xl border border-border/60 bg-card/60 p-4 text-left backdrop-blur-md transition-colors hover:bg-muted"
                  >
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <Rocket className="size-3.5" /> {s.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {s.systemsInvolved.map((sys) => (
                        <SmartBadge key={sys} label={sys} tone="neutral" />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!autoPlay ? (
            <div className="flex flex-wrap gap-2">
              {brands.map((b, i) => (
                <button
                  key={b.companyId}
                  onClick={() => setBrandIndex(i)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${i === brandIndex ? "border-brand bg-brand-subtle text-brand" : "border-border/60 text-muted-foreground hover:bg-muted"}`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          ) : null}
        </main>
      </div>
    </BrandProvider>
  );
}
