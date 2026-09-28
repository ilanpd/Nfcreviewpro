import type { FunnelStage } from "./types";

/**
 * O Funil Inteligente (Fase 7) é escopado ao fluxo público do cartão (o único
 * caminho deste produto com múltiplas etapas rastreáveis) — um toque
 * resolvido para uma campanha (Instagram, WhatsApp, etc.) é um redirect
 * instantâneo para fora do produto, sem uma segunda etapa própria para
 * medir. Colocar toques de campanha no mesmo funil faria "página aberta"
 * cair artificialmente para eles, parecendo uma falha que não existe —
 * então o funil conta apenas `RedirectLog` com `outcome=REVIEW_FLOW_FALLBACK`
 * como o topo, e a contagem de toques de campanha aparece como um KPI
 * separado, honesto sobre o que mede. Ver ADR-030.
 *
 * Três estágios, não cinco (auditoria de 28/09/2026, corrige a ADR-080): a
 * versão anterior tinha "Clique (avaliação enviada)" e "Avaliação publicada"
 * como estágios à parte, de quando a tela pública fazia o cliente dar uma
 * nota antes de decidir se seguia para o Google (ADR-075). Desde a ADR-080
 * (C6) essa tela não existe mais — o botão principal (o destino do dono)
 * aparece direto, sem etapa de nota no meio — então não há mais um evento
 * distinto entre "abriu a página" e "converteu" para contar; repetir a
 * mesma contagem sob dois nomes diferentes seria inventar um dado que a
 * ADR-075 já tinha decidido nunca fazer. "Conversão" é o sinal único de
 * `lib/analytics/conversion.ts`.
 */
export function buildReviewFunnel(counts: { approaches: number; pageOpens: number; conversions: number }): FunnelStage[] {
  const stages: { key: FunnelStage["key"]; label: string; count: number }[] = [
    { key: "APPROACH", label: "Aproximação", count: counts.approaches },
    { key: "PAGE_OPENED", label: "Página aberta", count: counts.pageOpens },
    { key: "CONVERSION", label: "Conversão (clicou no destino)", count: counts.conversions },
  ];

  return stages.map((stage, i) => ({
    ...stage,
    dropoffFromPrevious: i === 0 ? null : stages[i - 1].count > 0 ? (stage.count / stages[i - 1].count) * 100 : 0,
  }));
}
