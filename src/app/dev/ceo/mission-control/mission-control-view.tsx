"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertOctagon, HeartPulse } from "lucide-react";
import { SmartBadge } from "@nfc-os/ui";
import { TableMapView } from "@/components/dashboard/table-map/table-map-view";
import type { TableStatusAssignment } from "@/domain/table-map/status";
import type { TableCardItem, TableMapCampaignItem, BranchListItem, ZoneListItem } from "@/types";
import type { ReliabilitySnapshot } from "@/services/reliability.service";
import type { QueueName } from "@/lib/queues/definitions";

const DEMO_API_BASE = "/api/dev/demo";
const POLL_MS = 5000;

const QUEUE_LABELS: Record<QueueName, string> = {
  analytics: "Analytics",
  webhooks: "Webhooks",
  whatsapp: "WhatsApp",
  emails: "E-mails",
  exports: "Exportações",
  heavy: "Processamento",
  playbooks: "Playbooks",
};

interface MissionControlViewProps {
  cards: TableCardItem[];
  zones: ZoneListItem[];
  branches: BranchListItem[];
  trayCampaigns: TableMapCampaignItem[];
  initialAssignments: TableStatusAssignment[];
  organizationId: string | null;
  initialReliability: ReliabilitySnapshot;
}

function StatRow({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "success" | "warning" | "danger" | "neutral" }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 py-2 text-sm last:border-0">
      <span className="text-white/60">{label}</span>
      {tone ? <SmartBadge label={String(value)} tone={tone} /> : <span className="font-mono text-white">{value}</span>}
    </div>
  );
}

export function MissionControlView({
  cards,
  zones,
  branches,
  trayCampaigns,
  initialAssignments,
  organizationId,
  initialReliability,
}: MissionControlViewProps) {
  const [reliability, setReliability] = useState(initialReliability);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/dev/reliability");
        if (!res.ok) return;
        const { snapshot } = await res.json();
        setReliability(snapshot);
      } catch {
        // best-effort — próximo tick tenta de novo
      }
    }, POLL_MS);
    return () => {
      clearInterval(clock);
      clearInterval(poll);
    };
  }, []);

  const totalDead = reliability.queues.reduce((sum, q) => sum + (q.deadLetterCount ?? 0), 0);
  const anyChaosActive = Object.values(reliability.chaos).some(Boolean);
  const resolutionCache = reliability.cache.find((c) => c.namespace === "resolution");

  return (
    <div className="flex h-screen flex-col bg-noc-surface text-white">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/dev/ceo" className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80">
            <ArrowLeft className="size-3" /> Modo CEO
          </Link>
          <h1 className="text-sm font-semibold uppercase tracking-widest text-white/90">Mission Control</h1>
        </div>
        <div className="flex items-center gap-3">
          {anyChaosActive && <SmartBadge label="Chaos Mode ativo" tone="danger" pulse icon={<AlertOctagon className="size-3" />} />}
          <SmartBadge label={reliability.overallHealthy ? "Sistema saudável" : "Atenção"} tone={reliability.overallHealthy ? "success" : "danger"} pulse={reliability.overallHealthy} />
          <span className="font-mono text-xs text-white/60">{now.toLocaleTimeString("pt-BR")}</span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-white/10 lg:grid-cols-[1fr_360px]">
        <div className="min-h-0 bg-noc-surface">
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

        <aside className="flex min-h-0 flex-col gap-px overflow-y-auto bg-white/10">
          <section className="bg-noc-surface p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/50">
              <HeartPulse className="size-3.5" /> Redis
            </p>
            <StatRow
              label="REST (cache/rate-limit)"
              value={!reliability.redis.restConfigured ? "N/config" : reliability.redis.restHealthy ? "OK" : "Falhou"}
              tone={!reliability.redis.restConfigured ? "neutral" : reliability.redis.restHealthy ? "success" : "danger"}
            />
            <StatRow
              label="TCP (BullMQ)"
              value={!reliability.redis.queueConfigured ? "N/config" : reliability.redis.queueHealthy ? "OK" : "Falhou"}
              tone={!reliability.redis.queueConfigured ? "neutral" : reliability.redis.queueHealthy ? "success" : "danger"}
            />
          </section>

          <section className="bg-noc-surface p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">Filas</p>
            {reliability.queues.map((q) => (
              <StatRow
                key={q.name}
                label={QUEUE_LABELS[q.name]}
                value={!q.available ? "—" : `${q.counts?.waiting ?? 0} esp. / ${q.counts?.active ?? 0} ativo`}
                tone={!q.available ? "neutral" : q.worker.healthy ? "success" : "warning"}
              />
            ))}
            {totalDead > 0 && <StatRow label="Dead-letter (total)" value={totalDead} tone="danger" />}
          </section>

          <section className="bg-noc-surface p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">Event Bus &amp; Observabilidade</p>
            <StatRow label="Eventos/min" value={reliability.events.lastMinute} />
            <StatRow label="Eventos (5min)" value={reliability.events.last5Minutes} />
            <StatRow label="Conexões SSE" value={reliability.sseConnections ?? "—"} />
            <StatRow label="Spans (~2min)" value={reliability.recentSpanCount ?? "—"} />
            <StatRow
              label="Cache resolução"
              value={resolutionCache?.hitRate !== null && resolutionCache?.hitRate !== undefined ? `${Math.round(resolutionCache.hitRate * 100)}%` : "—"}
            />
          </section>

          <section className="bg-noc-surface p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">Chaos Mode</p>
            {Object.entries(reliability.chaos).map(([flag, active]) => (
              <StatRow key={flag} label={flag} value={active ? "Ativo" : "Off"} tone={active ? "danger" : "neutral"} />
            ))}
            <Link href="/dev/ceo/reliability" className="mt-3 block text-center text-xs text-white/50 underline hover:text-white/80">
              Controlar no Painel de Saúde →
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
