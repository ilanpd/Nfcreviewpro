"use client";

import { useEffect, useState } from "react";
import { PremiumModal } from "@nfc-os/ui";
import { Rocket } from "lucide-react";

export interface ScheduleChoice {
  mode: "now" | "later" | "repeat";
  runAt?: Date;
  recurrence?: "DAILY" | "WEEKLY";
}

interface PreviewData {
  scopeLabel: string;
  affectedCount: number;
  recentApproaches: number;
  reversalDescription: string;
}

interface PlaybookApplyDialogProps {
  open: boolean;
  headline: string;
  impactLabel: string;
  fetchPreview: () => Promise<PreviewData>;
  onConfirm: (schedule: ScheduleChoice) => void;
  onCancel: () => void;
  confirming: boolean;
}

/**
 * One-Tap Execution (Fase 11) — "reutilizar Ghost Mode; mostrar Preview
 * Inteligente; calcular impacto; permitir Desfazer. Nunca executar
 * silenciosamente." Este diálogo é o análogo direto do
 * `GhostModePreviewDialog` do Mapa de Mesas (Fase 5/6): busca a estimativa
 * de impacto ANTES de qualquer mudança acontecer, e só aplica depois de uma
 * confirmação explícita — nunca no clique do cartão em si.
 */
export function PlaybookApplyDialog({ open, headline, impactLabel, fetchPreview, onConfirm, onCancel, confirming }: PlaybookApplyDialogProps) {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<ScheduleChoice["mode"]>("now");
  const [runAt, setRunAt] = useState("");
  const [recurrence, setRecurrence] = useState<"DAILY" | "WEEKLY">("DAILY");

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setScheduleMode("now");
      return;
    }
    setLoading(true);
    fetchPreview()
      .then(setPreview)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchPreview é recriado por render; só queremos rodar ao abrir
  }, [open]);

  function handleConfirm() {
    if (scheduleMode === "later") {
      onConfirm({ mode: "later", runAt: runAt ? new Date(runAt) : undefined });
      return;
    }
    if (scheduleMode === "repeat") {
      onConfirm({ mode: "repeat", recurrence });
      return;
    }
    onConfirm({ mode: "now" });
  }

  return (
    <PremiumModal
      open={open}
      onOpenChange={(v) => !v && onCancel()}
      icon={Rocket}
      title="Aplicar recomendação"
      description={headline}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming || loading || (scheduleMode === "later" && !runAt)}
            className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground shadow-subtle disabled:opacity-50"
          >
            {confirming ? "Aplicando…" : "Confirmar"}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {loading || !preview ? (
          <p className="text-xs text-muted-foreground">Calculando impacto…</p>
        ) : (
          <>
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Escopo afetado</p>
              <p className="font-medium text-foreground">{preview.scopeLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {preview.affectedCount} {preview.affectedCount === 1 ? "cartão NFC" : "cartões NFC"} · {preview.recentApproaches} toques nas últimas 24h
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Impacto estimado (nunca uma promessa)</p>
              <p className="font-medium text-foreground">{impactLabel}</p>
            </div>
            <div className="rounded-lg border border-dashed border-border/60 p-3">
              <p className="text-xs text-muted-foreground">Como desfazer</p>
              <p className="text-xs text-foreground">{preview.reversalDescription}</p>
            </div>
          </>
        )}

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Quando aplicar</p>
          <div className="flex flex-wrap gap-2">
            {(["now", "later", "repeat"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setScheduleMode(mode)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  scheduleMode === mode ? "border-brand bg-brand-subtle text-brand" : "border-border/60 text-muted-foreground hover:bg-muted"
                }`}
              >
                {mode === "now" ? "Agora" : mode === "later" ? "Depois" : "Repetir"}
              </button>
            ))}
          </div>
          {scheduleMode === "later" ? (
            <input
              type="datetime-local"
              value={runAt}
              onChange={(e) => setRunAt(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-xs"
            />
          ) : null}
          {scheduleMode === "repeat" ? (
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as "DAILY" | "WEEKLY")}
              className="mt-2 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-xs"
            >
              <option value="DAILY">Diariamente</option>
              <option value="WEEKLY">Semanalmente</option>
            </select>
          ) : null}
        </div>
      </div>
    </PremiumModal>
  );
}
