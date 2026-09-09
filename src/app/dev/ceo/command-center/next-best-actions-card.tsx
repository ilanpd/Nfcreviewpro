"use client";

import { useState } from "react";
import { AnalyticsCard, RecommendationCard, EmptyState } from "@nfc-os/ui";
import { Sparkles } from "lucide-react";
import { toRecommendationCardData } from "@/domain/playbooks/present";
import { ExplainabilityPanel, type ExplainabilityData } from "@/components/dashboard/playbooks/explainability-panel";

interface RecommendationItem {
  id: string;
  headline: string;
  confidence: number;
  confidenceFactors: unknown;
  estimatedImpact: unknown;
  evidence: unknown;
  playbook: { name: string; description: string; category: string; estimatedDurationHours: number };
}

/**
 * Executive Copilot (Fase 11) — "Próximas melhores ações" no Command
 * Center. Aplicar aqui é a ÚNICA escrita que `/dev/ceo` já teve (ver
 * ADR-051) — deliberado, não um descuido: sem aplicar de verdade, o roteiro
 * de demonstração (insight → playbook → aplicar → KPIs reagem) não existe.
 * "Agora" é o único modo de agendamento aqui — Depois/Repetir continuam
 * exclusivos do dashboard real (`/dashboard/playbooks`), que tem uma sessão
 * de verdade por trás para o Scheduler Inteligente fazer sentido.
 */
export function NextBestActionsCard({ initialRecommendations }: { initialRecommendations: RecommendationItem[] }) {
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [explainData, setExplainData] = useState<ExplainabilityData | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);

  async function handleApply(id: string) {
    setApplyingId(id);
    try {
      await fetch(`/api/dev/demo/playbooks/${id}/apply`, { method: "POST" });
      const res = await fetch("/api/dev/demo/playbooks");
      const data = await res.json();
      setRecommendations(data.recommendations);
    } finally {
      setApplyingId(null);
    }
  }

  function handleExplain(r: RecommendationItem) {
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

  return (
    <AnalyticsCard title="Próximas melhores ações" description="O que o sistema recomenda agora, com um clique de distância.">
      {recommendations.length === 0 ? (
        <EmptyState icon={<Sparkles />} title="Nada a recomendar agora" description="Assim que um padrão real aparecer, a ação sugerida surge aqui." />
      ) : (
        <div className="space-y-2">
          {recommendations.map((r) => (
            <RecommendationCard
              key={r.id}
              recommendation={toRecommendationCardData(r)}
              compact
              applying={applyingId === r.id}
              onApply={() => handleApply(r.id)}
              onExplain={() => handleExplain(r)}
              onIgnore={() => {}}
            />
          ))}
        </div>
      )}
      <ExplainabilityPanel open={explainOpen} onOpenChange={setExplainOpen} data={explainData} />
    </AnalyticsCard>
  );
}
