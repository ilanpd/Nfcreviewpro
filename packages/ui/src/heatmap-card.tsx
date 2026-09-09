"use client";

import { AnalyticsCard } from "./premium-card";

export interface HeatmapCell {
  label: string;
  value: number;
}

interface HeatmapCardProps {
  title: string;
  description?: string;
  /** Uma linha por grupo (ex.: uma zona), células em ordem (ex.: uma por hora). */
  rows: { label: string; cells: HeatmapCell[] }[];
  className?: string;
}

/**
 * Heatmap Card genérico — preparado para a Fase 6 (Live Mode + Heatmap),
 * usado desde já aqui como componente do Design System. A intensidade de
 * cada célula é normalizada contra o valor máximo de toda a matriz (não por
 * linha), para que comparar duas linhas visualmente signifique algo.
 */
export function HeatmapCard({ title, description, rows, className }: HeatmapCardProps) {
  const max = Math.max(1, ...rows.flatMap((r) => r.cells.map((c) => c.value)));

  return (
    <AnalyticsCard title={title} description={description} className={className}>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">{row.label}</span>
            <div className="flex flex-1 gap-1">
              {row.cells.map((cell, i) => {
                const intensity = cell.value / max;
                return (
                  <div
                    key={i}
                    title={`${row.label} · ${cell.label}: ${cell.value}`}
                    className="h-5 flex-1 rounded-sm transition-colors"
                    style={{
                      backgroundColor: intensity === 0 ? "var(--muted)" : `color-mix(in oklch, var(--brand) ${Math.round(intensity * 90 + 10)}%, var(--muted))`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </AnalyticsCard>
  );
}
