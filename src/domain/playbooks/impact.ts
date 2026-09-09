import { computeRoiSummary } from "@/domain/analytics/roi";
import type { EstimatedImpact } from "./types";

interface RoiConfig {
  avgTicket: number | null;
  returnRate: number | null;
  newCustomerValue: number | null;
}

/**
 * ROI Antes da Execução (Fase 11) — "nunca prometer resultado, sempre
 * rotular como estimativa". Reaproveita EXATAMENTE a fórmula do ROI Mode
 * (Fase 7, `domain/analytics/roi.ts`) em vez de inventar uma segunda
 * matemática de "quanto isso vale" — a mesma garantia de honestidade
 * (`revenueConfigured=false` quando a empresa não configurou ROI Mode) se
 * aplica aqui, ponto a ponto.
 */
export function estimateImpact(
  projectedTouchesDelta: number,
  projectedConversionsDelta: number,
  roiConfig: RoiConfig
): EstimatedImpact {
  const touches = Math.max(0, Math.round(projectedTouchesDelta));
  const conversions = Math.max(0, Math.round(projectedConversionsDelta));
  const roi = computeRoiSummary(roiConfig, touches);

  const label = roi.configured
    ? `Estimativa: +${touches} toques, +${conversions} avaliações, ~R$ ${roi.estimatedRevenue!.toFixed(0)} em receita influenciada`
    : `Estimativa: +${touches} toques, +${conversions} avaliações (configure ticket médio e taxa de retorno em Configurações para ver receita estimada)`;

  return {
    label,
    expectedTouchesDelta: touches,
    expectedConversionsDelta: conversions,
    expectedRevenue: roi.estimatedRevenue,
    revenueConfigured: roi.configured,
  };
}
