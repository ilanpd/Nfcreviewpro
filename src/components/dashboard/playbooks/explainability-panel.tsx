"use client";

import { PremiumDrawer } from "@nfc-os/ui";
import { Eye } from "lucide-react";

interface ConfidenceFactor {
  label: string;
  value: number;
  weight: number;
}

export interface ExplainabilityData {
  headline: string;
  playbookName: string;
  playbookDescription: string;
  confidence: number;
  confidenceFactors: ConfidenceFactor[];
  evidence: Record<string, string | number | boolean | null>;
  estimatedImpactLabel: string;
}

/**
 * Explainability Panel (Fase 11) — "nenhuma recomendação pode parecer
 * mágica." Mostra exatamente os quatro elementos exigidos: quais dados
 * usou (evidence, os mesmos números que geraram o cartão — nada resumido
 * ou reformulado), qual regra disparou (o nome/descrição do Playbook), qual
 * confiança possui (com o detalhamento fator a fator do Confidence Engine,
 * não só o número final), e qual ação será tomada (o impacto estimado, que
 * já é a mesma ação do botão Aplicar). Sem IA inventando justificativa —
 * tudo aqui vem direto de `PlaybookRecommendation`, nunca gerado na hora
 * pela UI.
 */
export function ExplainabilityPanel({ open, onOpenChange, data }: { open: boolean; onOpenChange: (v: boolean) => void; data: ExplainabilityData | null }) {
  return (
    <PremiumDrawer open={open} onOpenChange={onOpenChange} icon={Eye} title="Por que essa recomendação?" description={data?.headline}>
      {!data ? null : (
        <div className="space-y-5 py-4 text-sm">
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Regra disparada</h4>
            <p className="mt-1 font-medium text-foreground">{data.playbookName}</p>
            <p className="text-xs text-muted-foreground">{data.playbookDescription}</p>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dados usados</h4>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {Object.entries(data.evidence).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-border/60 bg-muted/40 p-2">
                  <p className="truncate text-[11px] text-muted-foreground">{humanizeKey(key)}</p>
                  <p className="text-sm font-semibold text-foreground">{String(value)}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nível de confiança — {(data.confidence * 100).toFixed(0)}%
            </h4>
            <div className="mt-2 space-y-2">
              {data.confidenceFactors.map((factor) => (
                <div key={factor.label}>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{factor.label}</span>
                    <span>{(factor.value * 100).toFixed(0)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(factor.value * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ação que será tomada</h4>
            <p className="mt-1 text-xs text-foreground">{data.estimatedImpactLabel}</p>
          </section>
        </div>
      )}
    </PremiumDrawer>
  );
}

function humanizeKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}
