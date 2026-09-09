"use client";

import { useEffect, useState } from "react";
import type { CampaignType } from "@/generated/prisma/client";
import type { TableStatus } from "@/domain/table-map/status";

interface TimeMachineTopTable {
  cardId: string;
  cardName: string;
  conversions: number;
}

interface TimeMachineSummary {
  totalTouches: number;
  topTables: TimeMachineTopTable[];
}

interface SnapshotRow {
  cardId: string;
  campaignId: string | null;
  campaignName: string | null;
  campaignType: CampaignType | null;
}

/**
 * Consome `/api/table-map/time-machine` e devolve o resultado já no formato
 * `Map<string, TableStatus | null>` que `Canvas`/`TableNode` já sabem
 * renderizar (Fase 5) — o Mapa de Mesas não precisa saber que está olhando
 * para o passado, só recebe um "status map" diferente. `at === null`
 * significa "Time Machine desligado", tratado pelo chamador.
 */
export function useTimeMachine(at: Date | null, apiBase = "/api") {
  const [statusMap, setStatusMap] = useState<Map<string, TableStatus | null>>(new Map());
  const [summary, setSummary] = useState<TimeMachineSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!at) {
      setStatusMap(new Map());
      setSummary(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`${apiBase}/table-map/time-machine?at=${encodeURIComponent(at.toISOString())}&windowMinutes=30`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { snapshot: SnapshotRow[]; summary: TimeMachineSummary }) => {
        if (cancelled) return;
        const map = new Map<string, TableStatus | null>();
        for (const row of data.snapshot) {
          map.set(
            row.cardId,
            row.campaignId && row.campaignType
              ? { campaignId: row.campaignId, campaignName: row.campaignName ?? "", campaignType: row.campaignType, hasConflict: false, competingCount: 1 }
              : null
          );
        }
        setStatusMap(map);
        setSummary(data.summary);
      })
      .catch(() => {
        // Mantém o snapshot anterior — uma falha pontual não deveria apagar
        // o que já estava na tela.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [at, apiBase]);

  return { statusMap, summary, loading };
}
