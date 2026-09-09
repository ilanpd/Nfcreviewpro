import type { ForecastResult } from "./types";

/**
 * Forecast Inteligente (Fase 7) — projeção linear simples a partir da taxa
 * diária média recente, sempre rotulada como estimativa na UI (nunca como
 * previsão garantida). Deliberadamente não é um modelo estatístico
 * sofisticado (sem sazonalidade, sem regressão) — uma reta a partir da
 * média dos últimos N dias é honesta sobre o que é (extrapolação simples) e
 * fácil de explicar a um empresário, ao contrário de uma "IA prevendo o
 * futuro" que ninguém consegue auditar. Ver ADR-030.
 */
export function projectLinearForecast(metric: string, currentValue: number, targetValue: number, recentDailyCounts: number[]): ForecastResult {
  const daysWithData = recentDailyCounts.length;
  const dailyRate = daysWithData > 0 ? recentDailyCounts.reduce((sum, n) => sum + n, 0) / daysWithData : 0;

  const remaining = targetValue - currentValue;
  const estimatedDays = remaining <= 0 ? 0 : dailyRate > 0 ? Math.ceil(remaining / dailyRate) : null;

  const message =
    remaining <= 0
      ? `Meta de ${targetValue} ${metric} já alcançada.`
      : estimatedDays !== null
        ? `Mantendo o ritmo atual (~${dailyRate.toFixed(1)}/dia), a estimativa é alcançar ${targetValue} ${metric} em ${estimatedDays} dia(s).`
        : `Sem dados recentes suficientes para estimar quando ${targetValue} ${metric} será alcançado.`;

  return { metric, currentValue, targetValue, dailyRate, estimatedDays, message };
}
