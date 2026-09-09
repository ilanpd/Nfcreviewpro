import type { InsightCard } from "./types";
import { percentDelta, safeDivide } from "./math";

/**
 * Insights Automáticos (Fase 7) — "AI-like" no sentido pedido (frases em
 * português geradas a partir dos próprios dados, nunca fixas), mas
 * deliberadamente NÃO é uma chamada a um LLM: é um motor de regras
 * determinístico, com limiares explícitos de tamanho de amostra e
 * significância, sobre números já agregados pelo Analytics/Ranking Engine.
 * A escolha é consciente — cada frase é auditável (a `evidence` que a
 * acompanha são os números exatos usados), reproduzível, sem custo/latência
 * de API externa, e sem risco de alucinar um número que não existe nos
 * dados. Ver ADR-030.
 *
 * Amostra mínima antes de qualquer comparação — sem isso, uma zona com 1
 * toque e 1 conversão (100% de conversão) "venceria" uma zona madura com
 * 200 toques e 40% de conversão, o que seria estatisticamente sem sentido
 * e mina a confiança em todos os outros insights.
 *
 * Um limite estrutural importante, descoberto ao desenhar este arquivo: uma
 * campanha (WhatsApp, Instagram, Google Reviews direto, etc.) redireciona o
 * cliente para fora do produto instantaneamente — ela nunca passa pelo
 * fluxo de estrelas (`RatingEvent`). Ou seja, **nenhuma campanha consegue,
 * honestamente, "gerar uma avaliação"** neste modelo de dados; só o fluxo
 * padrão (sem campanha ativa no momento do toque) gera avaliações. Por
 * isso o insight de campanha compara **toques** (o quanto cada campanha é
 * de fato usada), nunca avaliações — e zona/mesa/funcionário, que SÃO
 * atribuíveis a um `RatingEvent.cardId` real, continuam comparados por
 * conversão de verdade.
 */
const MIN_SAMPLE_SIZE = 5;
/** Diferença mínima para uma comparação virar insight — variações pequenas
 * (2-3%) são ruído, não uma frase que vale a atenção do empresário. */
const MIN_SIGNIFICANT_DELTA_PERCENT = 15;

export interface ZoneComparisonInput {
  id: string;
  label: string;
  touches: number;
  conversions: number;
}

export interface CampaignPerformanceInput {
  id: string;
  label: string;
  /** Toques (RedirectLog), não avaliações — uma campanha (WhatsApp,
   * Instagram, Google Reviews direto, etc.) redireciona o cliente para fora
   * do produto instantaneamente, sem nunca passar pelo fluxo de estrelas.
   * "Avaliação gerada por campanha" não é um dado que este produto consegue
   * medir honestamente hoje — só quantas vezes cada campanha foi de fato
   * servida. Ver a nota grande no topo deste arquivo e ADR-030. */
  touches: number;
}

export interface CardPeakHourInput {
  id: string;
  label: string;
  conversions: number;
  peakHourStart: number;
  peakHourEnd: number;
}

function zoneConversionRateInsight(zones: ZoneComparisonInput[]): InsightCard | null {
  const qualifying = zones.filter((z) => z.touches >= MIN_SAMPLE_SIZE);
  if (qualifying.length < 2) return null;

  const ranked = [...qualifying].sort((a, b) => safeDivide(b.conversions, b.touches) - safeDivide(a.conversions, a.touches));
  const [best, second] = ranked;
  const bestRate = safeDivide(best.conversions, best.touches);
  const secondRate = safeDivide(second.conversions, second.touches);
  const delta = percentDelta(bestRate, secondRate);
  if (delta === null || delta < MIN_SIGNIFICANT_DELTA_PERCENT) return null;

  return {
    id: `zone-comparison:${best.id}:${second.id}`,
    message: `A ${best.label} converte ${delta.toFixed(0)}% melhor que ${second.label}.`,
    severity: "positive",
    evidence: {
      [`${best.label} — toques`]: best.touches,
      [`${best.label} — conversões`]: best.conversions,
      [`${second.label} — toques`]: second.touches,
      [`${second.label} — conversões`]: second.conversions,
    },
  };
}

function campaignUsageInsight(campaigns: CampaignPerformanceInput[]): InsightCard | null {
  if (campaigns.length < 2) return null;
  const ranked = [...campaigns].sort((a, b) => b.touches - a.touches);
  const [best, ...rest] = ranked;
  if (best.touches < MIN_SAMPLE_SIZE) return null;

  const restAverage = rest.reduce((sum, c) => sum + c.touches, 0) / rest.length;
  const extra = Math.round(best.touches - restAverage);
  if (extra <= 0) return null;

  return {
    id: `campaign-usage:${best.id}`,
    message: `${best.label} foi acionada ${extra} vez(es) a mais que a média das outras campanhas.`,
    severity: "positive",
    evidence: { [`${best.label} — toques`]: best.touches, "Média das outras campanhas": Math.round(restAverage) },
  };
}

/** Alerta inteligente (Command Center) — só dispara para uma queda real,
 * nunca uma variação normal de dia a dia. O limiar é mais alto que o das
 * comparações "positivas" (30% em vez de 15%) porque um alerta de queda tem
 * um custo de atenção diferente: falsos positivos aqui desgastam a
 * confiança no sistema mais rápido que um insight positivo perdido. */
const MIN_DROP_ALERT_PERCENT = 30;

function touchDropAlert(today: number, yesterday: number): InsightCard | null {
  if (yesterday < MIN_SAMPLE_SIZE) return null;
  const delta = percentDelta(today, yesterday);
  if (delta === null || delta > -MIN_DROP_ALERT_PERCENT) return null;

  return {
    id: "touch-drop-alert",
    message: `Aproximações caíram ${Math.abs(delta).toFixed(0)}% em relação a ontem.`,
    severity: "attention",
    evidence: { Hoje: today, Ontem: yesterday },
  };
}

function peakHourInsight(card: CardPeakHourInput | null): InsightCard | null {
  if (!card || card.conversions < MIN_SAMPLE_SIZE) return null;
  return {
    id: `peak-hour:${card.id}`,
    message: `${card.label} apresenta o maior engajamento entre ${card.peakHourStart}h e ${card.peakHourEnd}h.`,
    severity: "neutral",
    evidence: { [`${card.label} — conversões`]: card.conversions, "Início do pico": `${card.peakHourStart}h`, "Fim do pico": `${card.peakHourEnd}h` },
  };
}

export function generateInsights(input: {
  zones: ZoneComparisonInput[];
  campaigns: CampaignPerformanceInput[];
  topCard: CardPeakHourInput | null;
  touchesToday: number;
  touchesYesterday: number;
}): InsightCard[] {
  return [
    touchDropAlert(input.touchesToday, input.touchesYesterday),
    zoneConversionRateInsight(input.zones),
    campaignUsageInsight(input.campaigns),
    peakHourInsight(input.topCard),
  ].filter((insight): insight is InsightCard => insight !== null);
}
