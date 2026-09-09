"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NAME_PREVIEW_LIMIT = 8;

interface GhostModePreviewDialogProps {
  open: boolean;
  campaignName: string;
  /** Rótulo do alvo já pronto para exibição — "12 mesas selecionadas",
   * "toda a zona Salão Principal", "toda a empresa". */
  scopeLabel: string;
  affectedCardIds: string[];
  affectedNames: string[];
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
  /** Mesmo prefixo de rota que `TableMapView.liveApiBase` — mantém a
   * estimativa de impacto consistente com de onde os outros dados de
   * leitura desta instância vêm (dashboard real vs. Command Center). */
  apiBase?: string;
}

/**
 * Ghost Mode Evolution (Fase 6) — "Preview Inteligente": antes de confirmar
 * uma mudança em massa (uma zona inteira, a empresa inteira, ou um grupo
 * marcado de mesas), mostra exatamente o que vai mudar e uma estimativa real
 * de impacto, não um número inventado. A estimativa busca as aproximações
 * (RedirectLog) das últimas 24h para exatamente esses cartões, reaproveitando
 * a mesma rota `/api/heatmap` que a camada de heatmap "Aproximações" já usa —
 * nenhuma agregação nova.
 */
export function GhostModePreviewDialog({
  open,
  campaignName,
  scopeLabel,
  affectedCardIds,
  affectedNames,
  onConfirm,
  onCancel,
  confirming,
  apiBase = "/api",
}: GhostModePreviewDialogProps) {
  const [impact, setImpact] = useState<{ touches: number } | "loading" | "unavailable">("loading");

  useEffect(() => {
    if (!open) return;
    setImpact("loading");
    const affectedSet = new Set(affectedCardIds);

    fetch(`${apiBase}/heatmap?layer=APPROACHES&hours=24`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { counts: { cardId: string; count: number }[] }) => {
        const touches = data.counts.filter((c) => affectedSet.has(c.cardId)).reduce((sum, c) => sum + c.count, 0);
        setImpact({ touches });
      })
      .catch(() => setImpact("unavailable"));
  }, [open, affectedCardIds, apiBase]);

  const previewNames = affectedNames.slice(0, NAME_PREVIEW_LIMIT);
  const remaining = affectedNames.length - previewNames.length;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aplicar &ldquo;{campaignName}&rdquo;?</DialogTitle>
          <DialogDescription>
            Esta ação vai atribuir a campanha a <strong>{scopeLabel}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {previewNames.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {previewNames.map((name) => (
                <span key={name} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {name}
                </span>
              ))}
              {remaining > 0 ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">+{remaining} mais</span>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            {impact === "loading" ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" /> Calculando impacto estimado…
              </span>
            ) : impact === "unavailable" ? (
              "Não foi possível estimar o impacto agora."
            ) : (
              <>
                Essas mesas somaram <strong>{impact.touches}</strong> aproximação(ões) nas últimas 24h — uma referência de
                quanto essa mudança tende a impactar por dia.
              </>
            )}
          </div>

          {affectedCardIds.length >= 20 ? (
            <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              Isso afeta {affectedCardIds.length} mesas de uma vez. Você pode desfazer logo após confirmar.
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={confirming}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={confirming}>
            {confirming ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
