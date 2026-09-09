"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveEvent } from "@/domain/live/types";

const STEP_MS = 350;

/**
 * Playback Mode (Fase 6, opcional): reproduz os últimos N minutos de
 * atividade do salão em velocidade acelerada, disparando o mesmo `onEvent`
 * que o Live Mode de verdade usa — as mesas acendem exatamente como
 * aconteceu, sem nenhum caminho de renderização separado. "Grande poder de
 * demonstração" com zero lógica nova de visualização.
 *
 * Demo Timeline (Fase 12) — estendido com controle de velocidade e pausa
 * (mantendo `speed=1` como padrão, o mesmo ritmo de sempre — nenhum
 * consumidor existente, como o Time Machine do Mapa de Mesas, muda de
 * comportamento) e a lista de eventos carregada exposta, para uma UI poder
 * desenhar marcadores de "momentos importantes" sem uma segunda busca.
 */
export function usePlayback(onEvent: (event: LiveEvent) => void, apiBase = "/api") {
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const indexRef = useRef(0);
  const speedRef = useRef(1);
  speedRef.current = speed;

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setPlaying(false);
    setPaused(false);
  }, []);

  useEffect(() => stop, [stop]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const current = events[indexRef.current];
      if (!current) {
        stop();
        return;
      }
      onEvent(current);
      indexRef.current += 1;
      setProgress(indexRef.current / events.length);
      if (indexRef.current >= events.length) stop();
    }, STEP_MS / speedRef.current);
  }, [events, onEvent, stop]);

  const play = useCallback(
    async (minutes = 30) => {
      stop();
      try {
        const res = await fetch(`${apiBase}/live/history?minutes=${minutes}`);
        if (!res.ok) return;
        const { events: loaded } = (await res.json()) as { events: LiveEvent[] };
        if (loaded.length === 0) return;

        setEvents(loaded);
        indexRef.current = 0;
        setProgress(0);
        setPlaying(true);
        setPaused(false);
      } catch {
        // Sem eventos para reproduzir — silencioso, o botão simplesmente não faz nada visível.
      }
    },
    [stop, apiBase]
  );

  // Reinicia o timer sempre que `events` (uma nova carga) muda, ou quando
  // despausado — nunca durante uma pausa.
  useEffect(() => {
    if (playing && !paused && events.length > 0) startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só recriar quando o conjunto de eventos ou o estado pausado muda
  }, [events, paused]);

  const pause = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (!playing) return;
    setPaused(false);
    startTimer();
  }, [playing, startTimer]);

  /** Saltar direto para o evento de índice `i` (um "momento importante"
   * marcado na timeline) — publica todos os eventos até lá de uma vez, para
   * o estado visual (mapa/heatmap) ficar coerente com o ponto saltado. */
  const jumpTo = useCallback(
    (i: number) => {
      const target = Math.max(0, Math.min(events.length, i));
      for (let k = indexRef.current; k < target; k++) onEvent(events[k]);
      indexRef.current = target;
      setProgress(target / Math.max(1, events.length));
    },
    [events, onEvent]
  );

  return { playing, paused, progress, speed, setSpeed, events, play, stop, pause, resume, jumpTo };
}
