"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { staggerContainer } from "@nfc-os/animations";
import { RecommendationCard, AnalyticsCard, EmptyState, SmartBadge } from "@nfc-os/ui";
import { Sparkles, Clock, Pause, Play, X, Undo2 } from "lucide-react";
import { PlaybookApplyDialog, type ScheduleChoice } from "./playbook-apply-dialog";
import { ExplainabilityPanel, type ExplainabilityData } from "./explainability-panel";
import { AutoPilotSelector } from "./autopilot-selector";
import { toRecommendationCardData } from "@/domain/playbooks/present";

interface RawRecommendation {
  id: string;
  headline: string;
  confidence: number;
  confidenceFactors: unknown;
  estimatedImpact: unknown;
  evidence: unknown;
  status: string;
  playbook: { name: string; description: string; category: string; estimatedDurationHours: number };
  execution: { id: string; status: string; scheduledFor: string | Date | null; recurrence: unknown } | null;
}

interface PlaybooksViewProps {
  initialRecommendations: RawRecommendation[];
  autoPilotLevel: "MANUAL" | "RECOMMENDED" | "SEMI_AUTOMATIC" | "AUTOMATIC";
  canApply: boolean;
  canManageAutomation: boolean;
}

export function PlaybooksView({ initialRecommendations, autoPilotLevel, canApply, canManageAutomation }: PlaybooksViewProps) {
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [applyTargetId, setApplyTargetId] = useState<string | null>(null);
  const [explainData, setExplainData] = useState<ExplainabilityData | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);
  const [busyIds, setBusyIds] = useState<Record<string, "applying" | "ignoring">>({});
  const [confirming, setConfirming] = useState(false);

  const pending = useMemo(() => recommendations.filter((r) => r.status === "PENDING"), [recommendations]);
  const history = useMemo(() => recommendations.filter((r) => r.status !== "PENDING").slice(0, 10), [recommendations]);
  const scheduled = useMemo(
    () => recommendations.filter((r) => r.execution && ["SCHEDULED", "PAUSED"].includes(r.execution.status)),
    [recommendations]
  );

  const refetch = useCallback(async () => {
    const res = await fetch("/api/playbooks");
    if (!res.ok) return;
    const data = await res.json();
    setRecommendations(data.recommendations);
  }, []);

  function openExplain(r: RawRecommendation) {
    setExplainData({
      headline: r.headline,
      playbookName: r.playbook.name,
      playbookDescription: r.playbook.description,
      confidence: r.confidence,
      confidenceFactors: (r.confidenceFactors as ExplainabilityData["confidenceFactors"]) ?? [],
      evidence: (r.evidence as ExplainabilityData["evidence"]) ?? {},
      estimatedImpactLabel: (r.estimatedImpact as { label?: string })?.label ?? "",
    });
    setExplainOpen(true);
  }

  async function handleIgnore(id: string) {
    setBusyIds((prev) => ({ ...prev, [id]: "ignoring" }));
    try {
      await fetch(`/api/playbooks/${id}/ignore`, { method: "POST" });
      await refetch();
    } finally {
      setBusyIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  async function handleConfirmApply(schedule: ScheduleChoice) {
    if (!applyTargetId) return;
    setConfirming(true);
    try {
      const body =
        schedule.mode === "now"
          ? { mode: "now" }
          : schedule.mode === "later"
            ? { mode: "later", runAt: schedule.runAt }
            : { mode: "repeat", recurrence: schedule.recurrence };
      await fetch(`/api/playbooks/${applyTargetId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setApplyTargetId(null);
      await refetch();
    } finally {
      setConfirming(false);
    }
  }

  async function handleExecutionAction(executionId: string, action: "pause" | "resume" | "cancel" | "undo") {
    await fetch(`/api/playbooks/executions/${executionId}/${action}`, { method: "POST" });
    await refetch();
  }

  const applyTarget = recommendations.find((r) => r.id === applyTargetId) ?? null;

  return (
    <div className="space-y-6 p-6 sm:p-10">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Playbooks</h1>
        <p className="text-sm text-muted-foreground">O sistema observa seu movimento e sugere a próxima melhor ação — nunca uma promessa, sempre com o motivo à vista.</p>
      </div>

      <AutoPilotSelector initialLevel={autoPilotLevel} canManage={canManageAutomation} />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Recomendações agora ({pending.length})</h2>
        {pending.length === 0 ? (
          <EmptyState icon={<Sparkles />} title="Nada para recomendar ainda" description="Quando um padrão real (horário, zona, campanha) aparecer nos seus dados, a recomendação surge aqui." />
        ) : (
          <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((r) => (
              <RecommendationCard
                key={r.id}
                recommendation={toRecommendationCardData(r)}
                onApply={() => canApply && setApplyTargetId(r.id)}
                onExplain={() => openExplain(r)}
                onIgnore={() => canApply && handleIgnore(r.id)}
                applying={busyIds[r.id] === "applying"}
                ignoring={busyIds[r.id] === "ignoring"}
              />
            ))}
          </motion.div>
        )}
      </section>

      {scheduled.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Agendadas</h2>
          <div className="space-y-2">
            {scheduled.map((r) => (
              <AnalyticsCard key={r.id} title={r.headline} description={r.playbook.name}>
                <div className="flex items-center justify-between">
                  <SmartBadge
                    label={r.execution!.status === "PAUSED" ? "Pausada" : "Agendada"}
                    tone={r.execution!.status === "PAUSED" ? "warning" : "info"}
                    icon={<Clock />}
                  />
                  <div className="flex gap-1.5">
                    {r.execution!.status === "SCHEDULED" ? (
                      <button onClick={() => handleExecutionAction(r.execution!.id, "pause")} className="rounded-lg border border-border/60 p-1.5 hover:bg-muted" title="Pausar">
                        <Pause className="size-3.5" />
                      </button>
                    ) : (
                      <button onClick={() => handleExecutionAction(r.execution!.id, "resume")} className="rounded-lg border border-border/60 p-1.5 hover:bg-muted" title="Retomar">
                        <Play className="size-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleExecutionAction(r.execution!.id, "cancel")} className="rounded-lg border border-border/60 p-1.5 hover:bg-muted" title="Cancelar">
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              </AnalyticsCard>
            ))}
          </div>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Histórico recente</h2>
          <div className="space-y-2">
            {history.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-xs">
                <div>
                  <p className="font-medium text-foreground">{r.headline}</p>
                  <p className="text-muted-foreground">{r.playbook.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <SmartBadge label={r.status === "APPLIED" ? "Aplicada" : r.status === "IGNORED" ? "Ignorada" : "Expirada"} tone={r.status === "APPLIED" ? "success" : "neutral"} />
                  {r.status === "APPLIED" && r.execution && r.execution.status === "COMPLETED" ? (
                    <button onClick={() => handleExecutionAction(r.execution!.id, "undo")} className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 hover:bg-muted">
                      <Undo2 className="size-3.5" />
                      Desfazer
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <PlaybookApplyDialog
        open={!!applyTarget}
        headline={applyTarget?.headline ?? ""}
        impactLabel={(applyTarget?.estimatedImpact as { label?: string })?.label ?? ""}
        fetchPreview={async () => {
          const res = await fetch(`/api/playbooks/${applyTargetId}/preview`);
          const data = await res.json();
          return data.preview;
        }}
        onConfirm={handleConfirmApply}
        onCancel={() => setApplyTargetId(null)}
        confirming={confirming}
      />

      <ExplainabilityPanel open={explainOpen} onOpenChange={setExplainOpen} data={explainData} />
    </div>
  );
}
