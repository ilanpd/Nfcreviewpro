"use client";

import { SmartBadge } from "./smart-badge";

export type ConnectionIndicatorStatus = "connecting" | "connected" | "reconnecting" | "offline";

const STATUS_LABEL: Record<ConnectionIndicatorStatus, string> = {
  connecting: "Conectando…",
  connected: "Ao vivo",
  reconnecting: "Reconectando…",
  offline: "Offline",
};

const STATUS_TONE: Record<ConnectionIndicatorStatus, "success" | "warning" | "neutral"> = {
  connecting: "warning",
  connected: "success",
  reconnecting: "warning",
  offline: "neutral",
};

interface ConnectionIndicatorProps {
  status: ConnectionIndicatorStatus;
  className?: string;
}

/**
 * Indicador de conexão do Live Mode (Fase 6) — mostra o estado real do
 * transporte (SSE hoje, WebSocket quando existir um serviço dedicado; ver
 * ADR-025) sem expor esse detalhe de infraestrutura ao usuário: o gerente só
 * precisa saber se o salão está "ao vivo" agora ou não. O ponto pulsante é
 * reservado só para "connected" — o único estado que representa atividade
 * de verdade, não apenas uma tentativa (ver MANIFESTO_DO_DESIGN.md: cor e
 * animação têm significado, nunca são decoração).
 */
export function ConnectionIndicator({ status, className }: ConnectionIndicatorProps) {
  return (
    <SmartBadge
      label={STATUS_LABEL[status]}
      tone={STATUS_TONE[status]}
      pulse={status === "connected"}
      className={className}
    />
  );
}
