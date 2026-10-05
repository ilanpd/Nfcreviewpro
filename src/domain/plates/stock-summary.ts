import { derivePlateStage, STAGE_ORDER, type PlateStage, type PlateStatusValue } from "./status";

/**
 * Estoque de placas (ADR-092) — contagens por modelo. Função pura: recebe as
 * linhas já buscadas e devolve só números, para o painel, o radar e os testes
 * contarem exatamente do mesmo jeito.
 */

export interface PlateRow {
  modelId: string;
  status: PlateStatusValue;
  cardId: string | null;
}

export type StageCounts = Record<PlateStage, number>;

export function emptyCounts(): StageCounts {
  return Object.fromEntries(STAGE_ORDER.map((stage) => [stage, 0])) as StageCounts;
}

export function summarizeByModel(rows: PlateRow[]): Record<string, StageCounts> {
  const byModel: Record<string, StageCounts> = {};
  for (const row of rows) {
    const counts = (byModel[row.modelId] ??= emptyCounts());
    counts[derivePlateStage(row)] += 1;
  }
  return byModel;
}

export interface LowStockEntry {
  modelId: string;
  modelName: string;
  inStock: number;
  minStock: number;
  /** Placas ainda sem dono que estão sendo produzidas (geradas ou na gráfica). */
  incoming: number;
}

/**
 * Modelos ativos com menos placas em estoque do que o mínimo definido. Um
 * modelo com mínimo 0 nunca alerta (é como o dono desliga o controle de um
 * modelo). `incoming` não esconde o item — o painel mostra "20 a caminho" —
 * mas o radar só dispara quando nem o que vem a caminho cobre o mínimo.
 */
export function findLowStock(
  models: { id: string; name: string; minStock: number; active: boolean }[],
  byModel: Record<string, StageCounts>
): LowStockEntry[] {
  const low: LowStockEntry[] = [];
  for (const model of models) {
    if (!model.active || model.minStock <= 0) continue;
    const counts = byModel[model.id] ?? emptyCounts();
    if (counts.IN_STOCK >= model.minStock) continue;
    low.push({
      modelId: model.id,
      modelName: model.name,
      inStock: counts.IN_STOCK,
      minStock: model.minStock,
      incoming: counts.GENERATED + counts.IN_PRODUCTION,
    });
  }
  return low;
}
