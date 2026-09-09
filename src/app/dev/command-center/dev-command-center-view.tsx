"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Activity, Webhook, Sparkles, Database, Network as NetworkIcon, Waypoints } from "lucide-react";
import { AnalyticsCard, KpiCard, SmartBadge } from "@nfc-os/ui";
import { VisualEventFlow } from "@/components/dev/visual-event-flow";
import type { CommandCenterSnapshot } from "@/services/command-center.service";

const POLL_MS = 5000;
type Tab = "cockpit" | "state" | "network" | "flow";

const SCENARIO_LABEL: Record<string, string> = {
  "happy-hour": "Happy Hour",
  "restaurante-lotado": "Restaurante lotado",
  "avaliacoes-disparando": "Avaliações disparando",
  "zona-silenciosa": "Zona silenciosa",
  franquia: "Franquia",
  "falha-redis": "Falha de Redis",
  "autopilot-trabalhando": "AutoPilot trabalhando",
};

interface StateInspectorResult {
  card: { id: string; name: string; tags: string[] };
  status: { campaignName: string; campaignType: string } | null;
  history: { id: string; outcome: string; createdAt: string }[];
  lastInteractionAt: string | null;
  activePlaybooks: { id: string; headline: string }[];
  forecast: { message: string };
  roi: { configured: boolean; estimatedRevenue: number | null };
}

export function DevCommandCenterView({ initialSnapshot, cards }: { initialSnapshot: CommandCenterSnapshot; cards: { id: string; name: string }[] }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [tab, setTab] = useState<Tab>("cockpit");
  const [selectedCardId, setSelectedCardId] = useState(cards[0]?.id ?? "");
  const [inspectorResult, setInspectorResult] = useState<StateInspectorResult | null>(null);
  const [networkLogs, setNetworkLogs] = useState<{ id: string; method: string; path: string; statusCode: number; latencyMs: number; createdAt: string }[]>([]);
  const [networkSummary, setNetworkSummary] = useState<{ requestsLast24h: number; avgLatencyMs: number | null } | null>(null);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/dev/command-center");
        if (!res.ok) return;
        const { snapshot: next } = await res.json();
        setSnapshot(next);
      } catch {
        // mantém o último snapshot conhecido
      }
    }, POLL_MS);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    if (tab !== "state" || !selectedCardId) return;
    fetch(`/api/dev/state-inspector/${selectedCardId}`)
      .then((r) => r.json())
      .then((d) => setInspectorResult(d.state ?? null))
      .catch(() => setInspectorResult(null));
  }, [tab, selectedCardId]);

  useEffect(() => {
    if (tab !== "network") return;
    fetch("/api/dev/network-inspector")
      .then((r) => r.json())
      .then((d) => {
        setNetworkLogs(d.logs ?? []);
        setNetworkSummary(d.summary ?? null);
      })
      .catch(() => {});
  }, [tab]);

  const r = snapshot.reliability;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_10%,var(--background))_0%,var(--background)_55%)] p-4 pb-12 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link href="/dev/ceo" className="flex items-center gap-1 text-xs text-muted-foreground hover:underline">
            <ArrowLeft className="size-3" /> Modo CEO
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Dev Command Center v2</h1>
        </div>
        <SmartBadge
          label={snapshot.currentScenario ? `Cenário: ${SCENARIO_LABEL[snapshot.currentScenario.scenarioId] ?? snapshot.currentScenario.scenarioId}` : "Nenhum cenário ativo"}
          tone={snapshot.currentScenario ? "brand" : "neutral"}
          icon={<Sparkles />}
        />
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto">
        {([
          ["cockpit", "Cockpit", Activity],
          ["state", "State Inspector", Database],
          ["network", "Network Inspector", NetworkIcon],
          ["flow", "Visual Event Flow", Waypoints],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === id ? "border-brand bg-brand-subtle text-brand" : "border-border/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "cockpit" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Eventos/min" value={r.events.lastMinute} icon={<Activity />} />
            <KpiCard label="Conexões SSE" value={r.sseConnections ?? 0} icon={<Waypoints />} />
            <KpiCard label="Webhooks 24h" value={`${snapshot.webhooks.successLast24h}/${snapshot.webhooks.deliveriesLast24h}`} icon={<Webhook />} hint="sucesso/total" />
            <KpiCard label="Requests 24h (API v1)" value={snapshot.apiUsage.requestsLast24h} icon={<NetworkIcon />} hint={snapshot.apiUsage.avgLatencyMs ? `${snapshot.apiUsage.avgLatencyMs}ms médio` : undefined} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <AnalyticsCard title="Filas" description="Queue Engine (Fase 8) — waiting/active/failed/dead-letter">
              <div className="space-y-1.5 text-xs">
                {r.queues.map((q) => (
                  <div key={q.name} className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{q.name}</span>
                    <span className="text-muted-foreground">
                      {q.available ? `${q.counts?.waiting ?? 0} esperando · ${q.counts?.active ?? 0} ativos · ${q.deadLetterCount ?? 0} dead-letter` : "indisponível"}
                    </span>
                  </div>
                ))}
              </div>
            </AnalyticsCard>

            <AnalyticsCard title="Cache Enterprise" description="Resolution Engine + Analytics">
              <div className="space-y-1.5 text-xs">
                {r.cache.map((c) => (
                  <div key={c.namespace} className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{c.namespace}</span>
                    <span className="text-muted-foreground">{c.hitRate !== null ? `${Math.round(c.hitRate * 100)}% hit rate` : "sem dado ainda"}</span>
                  </div>
                ))}
              </div>
            </AnalyticsCard>

            <AnalyticsCard title="Playbooks & AutoPilot" description="Fase 11">
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nível de AutoPilot</span>
                  <SmartBadge label={snapshot.automation.autoPilotLevel} tone="brand" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Recomendações pendentes</span>
                  <span className="font-medium text-foreground">{snapshot.automation.pendingRecommendations}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Aplicadas (24h)</span>
                  <span className="font-medium text-foreground">{snapshot.automation.appliedLast24h}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Auto-executadas (24h)</span>
                  <span className="font-medium text-foreground">{snapshot.automation.autoExecutedLast24h}</span>
                </div>
              </div>
            </AnalyticsCard>

            <AnalyticsCard title="Webhooks" description="Fase 9">
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Endpoints ativos</span>
                  <span className="font-medium text-foreground">
                    {snapshot.webhooks.activeEndpoints}/{snapshot.webhooks.totalEndpoints}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Falhas (24h)</span>
                  <span className="font-medium text-foreground">{snapshot.webhooks.failedLast24h}</span>
                </div>
              </div>
            </AnalyticsCard>
          </div>

          <Link href="/dev/command-center/events" className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline">
            Abrir o Event Explorer →
          </Link>
        </div>
      ) : null}

      {tab === "state" ? (
        <div className="space-y-4">
          <select value={selectedCardId} onChange={(e) => setSelectedCardId(e.target.value)} className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm">
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {inspectorResult ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <AnalyticsCard title="Estado atual">
                <p className="text-xs text-muted-foreground">{inspectorResult.status ? `Campanha: ${inspectorResult.status.campaignName} (${inspectorResult.status.campaignType})` : "Sem campanha vencendo agora"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Última interação: {inspectorResult.lastInteractionAt ? new Date(inspectorResult.lastInteractionAt).toLocaleString("pt-BR") : "nunca"}</p>
              </AnalyticsCard>
              <AnalyticsCard title="Playbooks ativos">
                {inspectorResult.activePlaybooks.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum</p> : inspectorResult.activePlaybooks.map((p) => <p key={p.id} className="text-xs text-foreground">{p.headline}</p>)}
              </AnalyticsCard>
              <AnalyticsCard title="Histórico recente">
                {inspectorResult.history.map((h) => (
                  <p key={h.id} className="text-xs text-muted-foreground">
                    {new Date(h.createdAt).toLocaleTimeString("pt-BR")} · {h.outcome}
                  </p>
                ))}
              </AnalyticsCard>
              <AnalyticsCard title="Previsão & ROI">
                <p className="text-xs text-muted-foreground">{inspectorResult.forecast.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{inspectorResult.roi.configured ? `ROI estimado: R$ ${inspectorResult.roi.estimatedRevenue?.toFixed(0)}` : "ROI não configurado"}</p>
              </AnalyticsCard>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Selecione uma mesa.</p>
          )}
        </div>
      ) : null}

      {tab === "network" ? (
        <div className="space-y-4">
          {networkSummary ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard label="Requests (24h)" value={networkSummary.requestsLast24h} />
              <KpiCard label="Latência média" value={networkSummary.avgLatencyMs ? `${networkSummary.avgLatencyMs}ms` : "—"} />
            </div>
          ) : null}
          <AnalyticsCard title="Chamadas recentes" description="ApiRequestLog (Fase 9)">
            <div className="space-y-1 text-xs">
              {networkLogs.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma chamada registrada ainda.</p>
              ) : (
                networkLogs.map((l) => (
                  <div key={l.id} className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">
                    <span className="font-mono text-foreground">
                      {l.method} {l.path}
                    </span>
                    <span className={l.statusCode >= 400 ? "text-red-500" : "text-muted-foreground"}>
                      {l.statusCode} · {l.latencyMs}ms
                    </span>
                  </div>
                ))
              )}
            </div>
          </AnalyticsCard>
        </div>
      ) : null}

      {tab === "flow" ? <VisualEventFlow /> : null}
    </div>
  );
}
