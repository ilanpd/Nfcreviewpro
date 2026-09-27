/**
 * Fase 19.4 — Health Score de uma empresa (0–100). Função pura: recebe dado
 * já buscado, nunca busca sozinha. Explainability First — cada fator que
 * compõe o número é retornado junto, nunca só o total; um score opaco não é
 * aceitável quando decide prioridade de atenção comercial. Fórmula honesta
 * a partir de dado real (Zero Fake Demo): sem atividade real, o score cai
 * baixo de verdade, nunca um número neutro fingindo saúde.
 */

export interface HealthScoreInput {
  /** Toques (RedirectLog) + avaliações (RatingEvent) + feedbacks (PrivateFeedback) nos últimos 30 dias. */
  eventsLast30Days: number;
  /** Avaliações (RatingEvent) dos últimos 90 dias — total e quantas foram 4-5 estrelas. */
  ratingsTotal90Days: number;
  ratingsPositive90Days: number;
  /** Campanhas com status ACTIVE hoje. */
  activeCampaigns: number;
  /** Dias desde o último evento real (toque ou avaliação) — null se nunca houve nenhum. */
  daysSinceLastActivity: number | null;
}

export interface HealthScoreFactor {
  key: string;
  label: string;
  points: number;
  maxPoints: number;
  detail: string;
}

export interface HealthScoreResult {
  score: number;
  factors: HealthScoreFactor[];
}

// 60 toques/mês (~2 por dia) é o piso de "uso ativo saudável" assumido para
// um estabelecimento pequeno/médio — o mesmo patamar usado como referência
// em outras partes do produto para "campanha girando de verdade". Acima
// disso não ganha pontos extras (o score mede saúde mínima, não recorde).
const ACTIVITY_TARGET_EVENTS = 60;
const RECENCY_FULL_SCORE_DAYS = 0;
const RECENCY_ZERO_SCORE_DAYS = 30;

export function computeHealthScore(input: HealthScoreInput): HealthScoreResult {
  const activityPoints = Math.round(Math.min(40, (input.eventsLast30Days / ACTIVITY_TARGET_EVENTS) * 40));

  const hasRatings = input.ratingsTotal90Days > 0;
  const reviewPoints = hasRatings ? Math.round((input.ratingsPositive90Days / input.ratingsTotal90Days) * 25) : 13;

  const campaignPoints = input.activeCampaigns > 0 ? 20 : 0;

  let recencyPoints = 0;
  if (input.daysSinceLastActivity !== null) {
    const span = RECENCY_ZERO_SCORE_DAYS - RECENCY_FULL_SCORE_DAYS;
    const ratio = 1 - Math.min(1, Math.max(0, input.daysSinceLastActivity - RECENCY_FULL_SCORE_DAYS) / span);
    recencyPoints = Math.round(ratio * 15);
  }

  const factors: HealthScoreFactor[] = [
    {
      key: "activity",
      label: "Atividade recente",
      points: activityPoints,
      maxPoints: 40,
      detail: `${input.eventsLast30Days} toques/avaliações nos últimos 30 dias`,
    },
    {
      key: "reviews",
      label: "Avaliações positivas",
      points: reviewPoints,
      maxPoints: 25,
      detail: hasRatings
        ? `${input.ratingsPositive90Days} de ${input.ratingsTotal90Days} avaliações com 4-5 estrelas (90 dias)`
        : "Sem avaliações nos últimos 90 dias — pontuação neutra",
    },
    {
      key: "campaigns",
      label: "Campanhas ativas",
      points: campaignPoints,
      maxPoints: 20,
      detail: input.activeCampaigns > 0 ? `${input.activeCampaigns} campanha(s) ativa(s)` : "Nenhuma campanha ativa",
    },
    {
      key: "recency",
      label: "Recência",
      points: recencyPoints,
      maxPoints: 15,
      detail: input.daysSinceLastActivity === null ? "Nenhuma atividade registrada ainda" : `Último evento há ${input.daysSinceLastActivity} dia(s)`,
    },
  ];

  return { score: activityPoints + reviewPoints + campaignPoints + recencyPoints, factors };
}
