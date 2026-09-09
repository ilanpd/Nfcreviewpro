"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveEvent, LiveConnectionStatus } from "@/domain/live/types";

/**
 * Cliente do Live Mode (Fase 6). Consome `/api/live/stream` via
 * `EventSource` (SSE) — ver ADR-025 para por que SSE é o transporte real
 * hoje, com a arquitetura pronta para um WebSocket de verdade entrar no
 * lugar (mesmo hook, mesma API, só troca o que `connect()` abre) quando
 * existir um serviço de tempo real dedicado.
 *
 * Cada aba abre sua própria conexão — "sincronização entre múltiplas abas"
 * significa que todas recebem os mesmos eventos do servidor, não que exista
 * uma aba líder coordenando as outras. Mais simples e mais robusto; a
 * otimização de uma única conexão compartilhada via BroadcastChannel é um
 * ganho de eficiência, não de corretude, e fica para quando o número de
 * abas simultâneas por usuário for um problema real (não é, para uma equipe
 * de restaurante).
 */

const HEARTBEAT_TIMEOUT_MS = 30_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

interface UseLiveConnectionOptions {
  onEvent?: (event: LiveEvent) => void;
  enabled?: boolean;
  /** Prefixo completo da API a consumir, incluindo `/api` — permite este
   * mesmo hook alimentar tanto o Mapa de Mesas real (`/api/live/...`)
   * quanto o Command Center de demonstração em `/dev/ceo` (sem sessão
   * real, `/api/dev/demo/live/...`), sem duplicar nenhuma lógica de
   * conexão/reconexão. Ver ADR-027. */
  apiBase?: string;
}

export function useLiveConnection({ onEvent, enabled = true, apiBase = "/api" }: UseLiveConnectionOptions = {}) {
  const [status, setStatus] = useState<LiveConnectionStatus>(enabled ? "connecting" : "offline");
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const sourceRef = useRef<EventSource | null>(null);
  const sinceRef = useRef<string | null>(null);
  const reconnectDelayRef = useRef(1000);
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);
  const connectRef = useRef<() => void>(() => {});

  const armHeartbeatWatchdog = useCallback(() => {
    if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
    heartbeatTimerRef.current = setTimeout(() => {
      sourceRef.current?.close();
      setStatus("reconnecting");
      scheduleReconnect();
    }, HEARTBEAT_TIMEOUT_MS);
  }, []);

  function scheduleReconnect() {
    if (stoppedRef.current) return;
    const delay = reconnectDelayRef.current;
    reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => connectRef.current(), delay);
  }

  const connect = useCallback(() => {
    if (stoppedRef.current) return;
    setStatus((s) => (s === "connected" ? s : "connecting"));

    const url = new URL(`${apiBase}/live/stream`, window.location.origin);
    if (sinceRef.current) url.searchParams.set("since", sinceRef.current);
    const source = new EventSource(url.toString());
    sourceRef.current = source;

    source.addEventListener("connected", (e) => {
      setStatus("connected");
      reconnectDelayRef.current = 1000;
      armHeartbeatWatchdog();
      try {
        sinceRef.current = (JSON.parse((e as MessageEvent).data) as { since: string }).since;
      } catch {
        // ignora payload malformado — o polling do servidor continua funcionando com o `since` já conhecido
      }
    });

    source.addEventListener("live-event", (e) => {
      armHeartbeatWatchdog();
      try {
        const event = JSON.parse((e as MessageEvent).data) as LiveEvent;
        sinceRef.current = new Date(event.createdAt + 1).toISOString();
        setLastEventAt(Date.now());
        onEventRef.current?.(event);
      } catch (err) {
        console.error("[live] evento malformado", err);
      }
    });

    source.addEventListener("heartbeat", () => armHeartbeatWatchdog());

    source.addEventListener("reconnect", (e) => {
      try {
        sinceRef.current = (JSON.parse((e as MessageEvent).data) as { since: string }).since;
      } catch {
        // mantém o `since` já conhecido
      }
      source.close();
      // O servidor fechou por conta própria (orçamento de tempo da
      // function serverless, não uma falha) — reconecta na hora, sem
      // aplicar backoff, já que isso é esperado e acontece a cada ~50s.
      connectRef.current();
    });

    source.onerror = () => {
      source.close();
      if (stoppedRef.current) return;
      setStatus("reconnecting");
      scheduleReconnect();
    };
  }, [armHeartbeatWatchdog, apiBase]);

  connectRef.current = connect;

  useEffect(() => {
    stoppedRef.current = !enabled;
    if (!enabled) {
      setStatus("offline");
      sourceRef.current?.close();
      return;
    }

    connect();
    return () => {
      stoppedRef.current = true;
      sourceRef.current?.close();
      if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { status, lastEventAt };
}
