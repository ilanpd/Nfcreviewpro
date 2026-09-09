"use client";

import { useEffect, useState } from "react";
import { normalizeCounts, intensityFromRecency } from "@/domain/heatmap/compute";
import type { HeatmapLayer, HeatmapRawCount } from "@/domain/heatmap/types";

const REFRESH_MS = 10_000;
const DEFAULT_WINDOW_HOURS = 24;

export type HeatmapTrend = "aquecendo" | "esfriando" | "estável";

/**
 * Estado da camada de heatmap escolhida no Mapa de Mesas (Fase 6).
 * `layer === null` significa "modo Status" (a coloração por campanha vencedora
 * do Fase 5, inalterada). `CURRENT_CAMPAIGN` é tratado à parte pelo próprio
 * `table-map-view.tsx` — reaproveita o `statusMap` que já existe ali, então
 * este hook nunca busca dados para ele (ver domain/heatmap/types.ts).
 *
 * Repete a busca a cada 10s enquanto uma camada estiver ativa, para a
 * visualização acompanhar o salão "ao vivo" sem depender só dos eventos
 * pontuais do Live Mode — uma camada de heatmap é uma agregação de janela,
 * não um evento discreto.
 *
 * Heatmap Preditivo (Fase 11) — além da intensidade atual, busca também a
 * janela anterior (últimas 24-48h) na MESMA rota já existente
 * (`/api/heatmap`, só com `hours=48`), sem nenhum endpoint novo: a contagem
 * da janela anterior é `total(48h) - total(24h)`. Comparar as duas janelas
 * produz uma tendência por mesa — "aquecendo"/"esfriando"/"estável" — nunca
 * uma previsão de IA, só aritmética sobre o mesmo dado real que já
 * alimentava o heatmap. Só se aplica às camadas de contagem (não a
 * LAST_INTERACTION/CURRENT_CAMPAIGN, que não são cumulativas por janela).
 */
export function useHeatmapLayer(apiBase = "/api") {
  const [layer, setLayer] = useState<HeatmapLayer | null>(null);
  const [intensities, setIntensities] = useState<Map<string, number>>(new Map());
  const [trends, setTrends] = useState<Map<string, HeatmapTrend>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!layer || layer === "CURRENT_CAMPAIGN") {
      setIntensities(new Map());
      setTrends(new Map());
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        if (layer === "LAST_INTERACTION") {
          const res = await fetch(`${apiBase}/heatmap?layer=${layer}&hours=${DEFAULT_WINDOW_HOURS}`);
          if (!res.ok || cancelled) return;
          const data = await res.json();
          const now = new Date();
          const next = new Map<string, number>();
          for (const [cardId, iso] of Object.entries<string>(data.lastInteraction ?? {})) {
            next.set(cardId, intensityFromRecency(new Date(iso), now));
          }
          if (!cancelled) {
            setIntensities(next);
            setTrends(new Map());
          }
          return;
        }

        const [currentRes, extendedRes] = await Promise.all([
          fetch(`${apiBase}/heatmap?layer=${layer}&hours=${DEFAULT_WINDOW_HOURS}`),
          fetch(`${apiBase}/heatmap?layer=${layer}&hours=${DEFAULT_WINDOW_HOURS * 2}`),
        ]);
        if (!currentRes.ok || !extendedRes.ok || cancelled) return;
        const currentData = await currentRes.json();
        const extendedData = await extendedRes.json();

        const currentCounts = (currentData.counts ?? []) as HeatmapRawCount[];
        const extendedCounts = (extendedData.counts ?? []) as HeatmapRawCount[];
        const cells = normalizeCounts(currentCounts);
        const currentByCard = new Map(currentCounts.map((c) => [c.cardId, c.count]));
        const extendedByCard = new Map(extendedCounts.map((c) => [c.cardId, c.count]));

        const nextTrends = new Map<string, HeatmapTrend>();
        for (const cardId of new Set([...currentByCard.keys(), ...extendedByCard.keys()])) {
          const current = currentByCard.get(cardId) ?? 0;
          const previous = Math.max(0, (extendedByCard.get(cardId) ?? 0) - current);
          nextTrends.set(cardId, classifyTrend(current, previous));
        }

        if (!cancelled) {
          setIntensities(new Map(cells.map((c) => [c.cardId, c.intensity])));
          setTrends(nextTrends);
        }
      } catch {
        // Mantém a última intensidade/tendência conhecida — uma falha de rede
        // pontual não deveria apagar o heatmap da tela, só deixar de atualizá-lo.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [layer, apiBase]);

  return { layer, setLayer, intensities, trends, loading };
}

function classifyTrend(current: number, previous: number): HeatmapTrend {
  if (current === 0 && previous === 0) return "estável";
  const deltaPercent = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
  if (deltaPercent >= 20) return "aquecendo";
  if (deltaPercent <= -20) return "esfriando";
  return "estável";
}
