import type { CampaignRoi, RoiSummary } from "./types";

interface RoiConfig {
  avgTicket: number | null;
  returnRate: number | null;
  newCustomerValue: number | null;
}

/**
 * ROI Mode (Fase 7) — transforma toques/conversões em dinheiro estimado,
 * mas só quando o empresário configurou os três parâmetros em Configurações
 * (ticket médio, taxa de retorno, valor de novo cliente). Nunca estima com
 * valores parciais/padrão inventados — "não configurado" é um estado
 * honesto e explícito na UI, não um número chutado. Ver ADR-029.
 *
 * Modelo (deliberadamente simples e auditável, documentado aqui e exposto
 * na UI como a fórmula exata, nunca uma caixa-preta):
 *   receita_estimada = interações_qualificadas × ticket_médio × taxa_de_retorno
 * `interações_qualificadas` é o total de toques reais (RedirectLog) no
 * período — cada toque representa uma interação física real com o cliente
 * que o produto influenciou, e `taxa_de_retorno` é a probabilidade estimada
 * (informada pelo próprio empresário, não inferida) de que essa interação
 * gere uma visita de retorno de valor `ticket_médio`.
 */
export function computeRoiSummary(config: RoiConfig, qualifyingInteractions: number): RoiSummary {
  const configured = config.avgTicket !== null && config.returnRate !== null && config.newCustomerValue !== null;
  return {
    configured,
    estimatedRevenue: configured ? qualifyingInteractions * config.avgTicket! * config.returnRate! : null,
    avgTicket: config.avgTicket,
    returnRate: config.returnRate,
    newCustomerValue: config.newCustomerValue,
    qualifyingInteractions,
  };
}

/**
 * ROI por campanha — só calcula `roiPercent`/`costPerConversion` quando a
 * própria campanha tem `estimatedCost` configurado (não existe integração
 * de gasto de anúncio neste produto; o custo é auto-declarado). Sem custo,
 * mostra a receita estimada normalmente mas deixa os dois campos de retorno
 * como `null` — nunca divide por um custo inventado.
 */
export function computeCampaignRoi(
  campaignId: string,
  campaignName: string,
  touches: number,
  conversions: number,
  estimatedCost: number | null,
  config: RoiConfig
): CampaignRoi {
  const configured = config.avgTicket !== null && config.returnRate !== null;
  const estimatedRevenue = configured ? touches * config.avgTicket! * config.returnRate! : null;

  return {
    campaignId,
    campaignName,
    estimatedRevenue,
    estimatedCost,
    roiPercent: estimatedRevenue !== null && estimatedCost !== null && estimatedCost > 0 ? ((estimatedRevenue - estimatedCost) / estimatedCost) * 100 : null,
    costPerConversion: estimatedCost !== null && conversions > 0 ? estimatedCost / conversions : null,
  };
}
