/**
 * Fase 19.5 — Estoque, versão honesta: sem SKU/fornecedor/lead-time (isso
 * é modelo de dado novo, registrado como fase futura), mas o contador
 * global (`SiteSettings.blankChipStock`) já é suficiente para responder a
 * pergunta que realmente importa — "quantos dias até acabar?" — em vez de
 * só mostrar o número cru. Função pura: recebe o consumo já contado
 * (`NFCCard` criados nos últimos 14 dias, em qualquer empresa — o estoque é
 * global), nunca busca sozinha.
 */

export interface StockForecast {
  daysRemaining: number | null;
  dailyConsumption: number;
}

const CONSUMPTION_WINDOW_DAYS = 14;

export function computeStockForecast(currentStock: number, cardsCreatedInWindow: number): StockForecast {
  const dailyConsumption = cardsCreatedInWindow / CONSUMPTION_WINDOW_DAYS;
  if (dailyConsumption <= 0) return { daysRemaining: null, dailyConsumption: 0 };
  return { daysRemaining: Math.floor(currentStock / dailyConsumption), dailyConsumption };
}
