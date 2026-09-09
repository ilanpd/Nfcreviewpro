"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCw } from "lucide-react";
import { PremiumDrawer, SmartBadge } from "@nfc-os/ui";

interface EventLogRow {
  id: string;
  type: string;
  version: number;
  companyId: string | null;
  organizationId: string | null;
  correlationId: string;
  payload: unknown;
  createdAt: string | Date;
}

export function EventExplorerView({ initialEvents }: { initialEvents: EventLogRow[] }) {
  const [events] = useState(initialEvents);
  const [selected, setSelected] = useState<EventLogRow | null>(null);
  const [correlated, setCorrelated] = useState<EventLogRow[]>([]);
  const [replaying, setReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<string | null>(null);

  async function open(event: EventLogRow) {
    setSelected(event);
    setReplayResult(null);
    try {
      const res = await fetch(`/api/dev/events/${event.id}`);
      const data = await res.json();
      setCorrelated(data.correlated ?? []);
    } catch {
      setCorrelated([]);
    }
  }

  async function replay(event: EventLogRow) {
    setReplaying(true);
    try {
      const res = await fetch("/api/dev/replay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: event.id }) });
      const data = await res.json();
      setReplayResult(`Reenfileirado: ${data.result?.replayed ?? 0}/${data.result?.matched ?? 0}`);
    } catch {
      setReplayResult("Falha ao reenfileirar");
    } finally {
      setReplaying(false);
    }
  }

  const origin = correlated[0];
  const durationMs = selected && origin ? new Date(selected.createdAt).getTime() - new Date(origin.createdAt).getTime() : null;

  return (
    <div className="min-h-screen p-4 pb-12 sm:p-6">
      <Link href="/dev/command-center" className="flex items-center gap-1 text-xs text-muted-foreground hover:underline">
        <ArrowLeft className="size-3" /> Dev Command Center
      </Link>
      <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Event Explorer</h1>
      <p className="text-xs text-muted-foreground">Cada linha é um evento real do Event Bus (EventLog, Fase 8). Clique para abrir.</p>

      <div className="mt-4 divide-y divide-border/60 rounded-2xl border border-border/60">
        {events.map((e) => (
          <button key={e.id} onClick={() => open(e)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs hover:bg-muted">
            <span className="font-mono text-foreground">{e.type}</span>
            <span className="text-muted-foreground">{new Date(e.createdAt).toLocaleString("pt-BR")}</span>
          </button>
        ))}
        {events.length === 0 ? <p className="p-4 text-xs text-muted-foreground">Nenhum evento gravado ainda.</p> : null}
      </div>

      <PremiumDrawer open={!!selected} onOpenChange={(v) => !v && setSelected(null)} title={selected?.type ?? ""} description={selected ? `Correlation ID: ${selected.correlationId}` : undefined}>
        {selected ? (
          <div className="space-y-4 py-4 text-xs">
            <div>
              <p className="font-semibold text-muted-foreground">Origem → Destino</p>
              <p className="mt-1 text-foreground">
                Empresa: {selected.companyId ?? "—"} {selected.organizationId ? `· Organização: ${selected.organizationId}` : ""}
              </p>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground">Duração desde o início da correlação</p>
              <p className="mt-1 text-foreground">{durationMs !== null ? `${durationMs}ms` : "este é o primeiro evento da sequência"}</p>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground">Sequência correlacionada ({correlated.length})</p>
              <div className="mt-1 space-y-1">
                {correlated.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <SmartBadge label={c.type} tone={c.id === selected.id ? "brand" : "neutral"} />
                    <span className="text-muted-foreground">{new Date(c.createdAt).toLocaleTimeString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground">Payload</p>
              <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-muted p-2 text-[11px]">{JSON.stringify(selected.payload, null, 2)}</pre>
            </div>
            <button
              onClick={() => replay(selected)}
              disabled={replaying}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground disabled:opacity-50"
            >
              <RotateCw className="size-3.5" /> {replaying ? "Reenfileirando…" : "Reenfileirar para consumidores"}
            </button>
            {replayResult ? <p className="text-muted-foreground">{replayResult}</p> : null}
          </div>
        ) : null}
      </PremiumDrawer>
    </div>
  );
}
