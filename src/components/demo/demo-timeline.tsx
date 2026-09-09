"use client";

import { useCallback, useState } from "react";
import { Play, Pause, RotateCcw, Gauge } from "lucide-react";
import { usePlayback } from "@/lib/live/use-playback";
import type { LiveEvent } from "@/domain/live/types";

const SPEEDS = [1, 2, 5] as const;
/** "Momentos importantes" — os tipos de evento com maior sinal narrativo
 * (uma avaliação, um feedback) viram marcadores clicáveis na régua; um
 * simples toque não vira marcador, senão a régua ficaria ilegível de tão
 * cheia. */
const KEY_MOMENT_KINDS: LiveEvent["kind"][] = ["RATING", "FEEDBACK"];

/**
 * Demo Timeline (Fase 12) — "voltar 24h, reproduzir, pausar, acelerar,
 * saltar momentos importantes", reaproveitando o MESMO Event Bus/histórico
 * do Playback Mode (Fase 6, `usePlayback` e a rota `live/history`) — nunca
 * um histórico paralelo. Mostra o replay como um feed cronológico com uma
 * régua de progresso e marcadores nos eventos de maior sinal.
 */
export function DemoTimeline({ apiBase }: { apiBase: string }) {
  const [recent, setRecent] = useState<LiveEvent[]>([]);
  const handleEvent = useCallback((event: LiveEvent) => {
    setRecent((prev) => [event, ...prev].slice(0, 20));
  }, []);

  const { playing, paused, progress, speed, setSpeed, events, play, pause, resume, jumpTo } = usePlayback(handleEvent, apiBase);

  const keyMoments = events
    .map((e, i) => ({ event: e, index: i }))
    .filter(({ event }) => KEY_MOMENT_KINDS.includes(event.kind));

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => (playing ? (paused ? resume() : pause()) : play(24 * 60))}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground"
        >
          {playing && !paused ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {playing ? (paused ? "Retomar" : "Pausar") : "Voltar 24h e reproduzir"}
        </button>
        <button onClick={() => play(24 * 60)} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
          <RotateCcw className="size-3.5" /> Reiniciar
        </button>
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Gauge className="size-3.5" />
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rounded-full px-2 py-1 font-medium ${speed === s ? "bg-brand-subtle text-brand" : "hover:bg-muted"}`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-4 h-2 w-full rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        {keyMoments.map(({ index }) => (
          <button
            key={index}
            title="Momento importante"
            onClick={() => jumpTo(index)}
            className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-card bg-amber-500"
            style={{ left: `${(index / Math.max(1, events.length)) * 100}%` }}
          />
        ))}
      </div>

      {recent.length > 0 ? (
        <ul className="mt-4 max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
          {recent.map((e) => (
            <li key={e.id} className="truncate">
              {e.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">Clique em &ldquo;Voltar 24h e reproduzir&rdquo; para ver o histórico real acontecer de novo.</p>
      )}
    </div>
  );
}
