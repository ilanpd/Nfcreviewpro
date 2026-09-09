import type { FunnelStage } from "./types";

/**
 * O Funil Inteligente (Fase 7) é escopado ao fluxo de avaliação (o único
 * caminho deste produto com múltiplas etapas rastreáveis) — um toque
 * resolvido para uma campanha (Instagram, WhatsApp, etc.) é um redirect
 * instantâneo para fora do produto, sem uma segunda etapa própria para
 * medir. Colocar toques de campanha no mesmo funil faria "página aberta"
 * cair artificialmente para eles, parecendo uma falha que não existe —
 * então o funil conta apenas `RedirectLog` com `outcome=REVIEW_FLOW_FALLBACK`
 * como o topo, e a contagem de toques de campanha aparece como um KPI
 * separado, honesto sobre o que mede. Ver ADR-030.
 *
 * "Conversão" e "Avaliação publicada" compartilham a mesma contagem —
 * `RatingEvent.redirectedGoogle = true` — porque não existe confirmação de
 * que a avaliação foi de fato publicada no Google (nenhum webhook do
 * Google Meu Negócio está integrado); o produto só sabe que redirecionou o
 * cliente para publicar. Mostrar os dois estágios com números diferentes
 * seria inventar um dado. O segundo estágio carrega essa nota como
 * `caption` em vez de escondida.
 */
export function buildReviewFunnel(counts: {
  approaches: number;
  pageOpens: number;
  clicks: number;
  conversions: number;
}): FunnelStage[] {
  const stages: { key: FunnelStage["key"]; label: string; count: number; caption?: string }[] = [
    { key: "APPROACH", label: "Aproximação", count: counts.approaches },
    { key: "PAGE_OPENED", label: "Página aberta", count: counts.pageOpens },
    { key: "CLICK", label: "Clique (avaliação enviada)", count: counts.clicks },
    { key: "CONVERSION", label: "Conversão (redirecionado ao Google)", count: counts.conversions },
    {
      key: "REVIEW_PUBLISHED",
      label: "Avaliação publicada",
      count: counts.conversions,
      caption: "Estimado como igual ao redirecionamento ao Google — não há confirmação de publicação real (sem webhook do Google Meu Negócio).",
    },
  ];

  return stages.map((stage, i) => ({
    ...stage,
    dropoffFromPrevious: i === 0 ? null : stages[i - 1].count > 0 ? (stage.count / stages[i - 1].count) * 100 : 0,
  }));
}
