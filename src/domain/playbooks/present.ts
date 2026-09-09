import type { RecommendationCardData, ConfidenceLevel } from "@nfc-os/ui";

/**
 * Apresentação compartilhada entre `/dashboard/playbooks` e a coluna
 * "Próximas melhores ações" do Command Center (Fase 11) — as DUAS telas
 * mostram o mesmo tipo de cartão, então convertem uma `PlaybookRecommendation`
 * (com `playbook` incluído) para `RecommendationCardData` exatamente da mesma
 * forma, nunca duas fórmulas de rótulo/confiança divergentes.
 */
export const PLAYBOOK_CATEGORY_LABEL: Record<string, string> = {
  REVENUE: "Receita",
  REPUTATION: "Reputação",
  ENGAGEMENT: "Engajamento",
  CAPACITY: "Capacidade",
};

export function confidenceLevelFromScore(score: number): ConfidenceLevel {
  return score >= 0.75 ? "alta" : score >= 0.5 ? "média" : "baixa";
}

export interface RecommendationForCard {
  id: string;
  headline: string;
  confidence: number;
  estimatedImpact: unknown;
  playbook: { category: string; estimatedDurationHours: number };
}

export function toRecommendationCardData(r: RecommendationForCard): RecommendationCardData {
  const impact = r.estimatedImpact as { label?: string } | null;
  return {
    id: r.id,
    headline: r.headline,
    categoryLabel: PLAYBOOK_CATEGORY_LABEL[r.playbook.category] ?? r.playbook.category,
    confidence: r.confidence,
    confidenceLevel: confidenceLevelFromScore(r.confidence),
    impactLabel: impact?.label ?? "Estimativa indisponível",
    estimatedDurationHours: r.playbook.estimatedDurationHours,
  };
}
