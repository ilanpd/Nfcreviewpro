"use client";

import { useCallback, useState } from "react";
import { LiveEventFeed, ConnectionIndicator, type LiveFeedEntry } from "@nfc-os/ui";
import { useLiveConnection } from "@/lib/live/use-live-connection";
import type { LiveEvent } from "@/domain/live/types";

const MAX_ENTRIES = 50;

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/**
 * Fase 19.2 — Timeline Viva do Centro de Operações. Mesmo hook/componente
 * já usados no Command Center (`useLiveConnection` + `LiveEventFeed`),
 * apontando pro stream global do Admin (`apiBase: "/api/admin"`) em vez do
 * por-empresa — nenhuma lógica de conexão/reconexão duplicada.
 */
export function OperationsTimeline() {
  const [entries, setEntries] = useState<LiveFeedEntry[]>([]);

  const handleEvent = useCallback((event: LiveEvent) => {
    setEntries((prev) => [{ id: event.id, kind: event.kind, message: event.message, timestamp: formatClock(event.createdAt) }, ...prev].slice(0, MAX_ENTRIES));
  }, []);

  const { status } = useLiveConnection({ onEvent: handleEvent, apiBase: "/api/admin" });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Linha do tempo</h3>
        <ConnectionIndicator status={status} />
      </div>
      <div className="max-h-96 overflow-y-auto">
        <LiveEventFeed entries={entries} />
      </div>
    </div>
  );
}
