"use client";

import { motion } from "framer-motion";
import { cn } from "cn";
import { Sparkles, Clock, TrendingUp, Info } from "lucide-react";
import { slideUp } from "@nfc-os/animations";
import { PremiumCardShell } from "./premium-card";
import { SmartBadge } from "./smart-badge";
import { Button } from "@/components/ui/button";
import { BorderBeam } from "@/components/ui/border-beam";

export type ConfidenceLevel = "baixa" | "média" | "alta";

const CONFIDENCE_COLOR: Record<ConfidenceLevel, string> = {
  baixa: "#F59E0B",
  média: "#6366F1",
  alta: "#22C55E",
};

export interface RecommendationCardData {
  id: string;
  headline: string;
  categoryLabel: string;
  confidence: number; // 0..1
  confidenceLevel: ConfidenceLevel;
  impactLabel: string;
  estimatedDurationHours: number;
}

interface RecommendationCardProps {
  recommendation: RecommendationCardData;
  onApply: () => void;
  onExplain: () => void;
  onIgnore: () => void;
  applying?: boolean;
  ignoring?: boolean;
  /** Versão reduzida — usada na coluna "Próximas melhores ações" do Command
   * Center, sem o botão "Ignorar" (o Command Center é observação, não gestão
   * completa — mesmo princípio já usado no Ghost Mode). */
  compact?: boolean;
  className?: string;
}

/**
 * Recommendation Center (Fase 11) — o cartão que transforma "o sistema
 * percebeu um padrão" em uma decisão de um clique. Explainability First
 * exige mostrar confiança e impacto SEMPRE visíveis no cartão, nunca
 * escondidos atrás de "Ver motivo" — o botão "Ver motivo" existe para o
 * DETALHE (dados/comparação/regra), não para revelar a confiança em si.
 */
export function RecommendationCard({ recommendation, onApply, onExplain, onIgnore, applying, ignoring, compact, className }: RecommendationCardProps) {
  const color = CONFIDENCE_COLOR[recommendation.confidenceLevel];

  return (
    <motion.div variants={slideUp}>
      <PremiumCardShell accentColor={color} className={cn("p-5", className)}>
        {/* Só durante a aplicação de verdade — nunca decorativo (Princípio 2
            do Manifesto): comunica "isto está processando agora". */}
        {applying ? <BorderBeam colorFrom="var(--brand)" colorTo={color} size={60} duration={3} /> : null}
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand [&_svg]:size-4">
            <Sparkles />
          </span>
          <div className="flex items-center gap-1.5">
            <SmartBadge label={recommendation.categoryLabel} tone="neutral" />
            <SmartBadge label={`Confiança ${recommendation.confidenceLevel}`} color={color} />
          </div>
        </div>

        <p className="mt-3 text-sm font-medium leading-snug text-foreground">{recommendation.headline}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="size-3.5" />
            {recommendation.impactLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {recommendation.estimatedDurationHours}h de duração estimada
          </span>
        </div>

        <div className={cn("mt-4 flex items-center gap-2", compact && "flex-wrap")}>
          <Button size="sm" onClick={onApply} disabled={applying} className="flex-1">
            {applying ? "Aplicando…" : "Aplicar"}
          </Button>
          <Button size="sm" variant="outline" onClick={onExplain}>
            <Info className="size-3.5" />
            Ver motivo
          </Button>
          {!compact ? (
            <Button size="sm" variant="ghost" onClick={onIgnore} disabled={ignoring}>
              {ignoring ? "…" : "Ignorar"}
            </Button>
          ) : null}
        </div>
      </PremiumCardShell>
    </motion.div>
  );
}
