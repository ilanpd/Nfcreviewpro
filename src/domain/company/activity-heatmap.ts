import type { HeatmapCell } from "@nfc-os/ui";

export interface HeatmapRow {
  label: string;
  cells: HeatmapCell[];
}

/**
 * Fase 19.4 — heatmap de atividade por zona × dia, para a ficha de empresa
 * do Admin. Não existe hoje nenhum agregador "atividade por zona" no
 * produto (o heatmap do Mapa de Mesas agrega por `cardId`, não por zona) —
 * função pura nova, reaproveitando só o padrão de bucket por `cardId` já
 * estabelecido em `services/heatmap.service.ts`.
 */

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WINDOW_DAYS = 7;

export interface ActivityEvent {
  cardId: string;
  createdAt: Date;
}

export function buildZoneActivityHeatmap(
  cardZones: { cardId: string; zoneName: string | null }[],
  events: ActivityEvent[],
  now: Date = new Date()
): HeatmapRow[] {
  const zoneByCard = new Map(cardZones.map((c) => [c.cardId, c.zoneName ?? "Sem zona"]));

  // Últimos 7 dias, do mais antigo pro mais recente, para o heatmap ler da
  // esquerda pra direita como uma semana normal.
  const days: { key: string; label: string }[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({ key: d.toDateString(), label: DAY_LABELS[d.getDay()] });
  }

  const counts = new Map<string, Map<string, number>>();
  for (const event of events) {
    const zone = zoneByCard.get(event.cardId) ?? "Sem zona";
    const dayKey = event.createdAt.toDateString();
    if (!counts.has(zone)) counts.set(zone, new Map());
    const zoneCounts = counts.get(zone)!;
    zoneCounts.set(dayKey, (zoneCounts.get(dayKey) ?? 0) + 1);
  }

  const zoneNames = [...new Set(cardZones.map((c) => c.zoneName ?? "Sem zona"))];
  if (zoneNames.length === 0) return [];

  return zoneNames.map((zoneName) => ({
    label: zoneName,
    cells: days.map((day) => ({ label: day.label, value: counts.get(zoneName)?.get(day.key) ?? 0 })),
  }));
}
