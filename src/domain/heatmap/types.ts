/**
 * Heatmap Engine (Fase 6) — deliberadamente seu próprio módulo de domínio,
 * separado de `resolution-engine` e de `domain/table-map`. O Heatmap LÊ
 * dados que o Resolution Engine já grava (`RedirectLog`, `RatingEvent`) mas
 * não conhece nada sobre como uma campanha é resolvida, e o Table Map não
 * sabe nada sobre como uma intensidade de heatmap é calculada — a única
 * coisa que os une é a tela que os renderiza junto. Ver ADR-025.
 */

export type HeatmapLayer =
  | "APPROACHES"
  | "CONVERSIONS"
  | "GOOGLE_REVIEWS"
  | "INSTAGRAM"
  | "CURRENT_CAMPAIGN"
  | "LAST_INTERACTION";

export const HEATMAP_LAYER_LABEL: Record<HeatmapLayer, string> = {
  APPROACHES: "Aproximações",
  CONVERSIONS: "Conversões",
  GOOGLE_REVIEWS: "Google Reviews",
  INSTAGRAM: "Instagram",
  CURRENT_CAMPAIGN: "Campanha atual",
  LAST_INTERACTION: "Última interação",
};

export const HEATMAP_LAYER_DESCRIPTION: Record<HeatmapLayer, string> = {
  APPROACHES: "Todo toque no cartão, qualquer resultado — de RedirectLog.",
  CONVERSIONS: "Avaliações de 4-5 estrelas que foram para o Google (a única conversão de fato verificável nos dados hoje).",
  GOOGLE_REVIEWS: "Toques que resolveram para o Google — via campanha do tipo Google Reviews ou pelo fluxo padrão.",
  INSTAGRAM: "Toques que resolveram para uma campanha do tipo Instagram.",
  CURRENT_CAMPAIGN: "Qual campanha está vencendo agora para cada mesa — reaproveita o preview de status do Mapa de Mesas (Fase 5), não recalcula.",
  LAST_INTERACTION: "Quão recente foi o último toque — decai com o tempo.",
};

/** Contagem bruta por cartão, antes de normalizar em intensidade — o que os
 * serviços de agregação retornam. */
export interface HeatmapRawCount {
  cardId: string;
  count: number;
}

/** Intensidade normalizada 0-1 por cartão, pronta para colorir o Table Map. */
export interface HeatmapCellIntensity {
  cardId: string;
  intensity: number;
  /** Valor bruto por trás da intensidade, para tooltip (ex.: "12 toques"). */
  rawValue: number;
}
