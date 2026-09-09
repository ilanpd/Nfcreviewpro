import "server-only";
import { getCorrelationId, getRequestId } from "./correlation";

/**
 * Observability Engine (Fase 8) — logger estruturado (JSON, uma linha por
 * evento) em vez de `console.error("[módulo] mensagem", err)" espalhado à
 * mão. Toda linha carrega o Correlation ID/Request ID ambiente (quando
 * existe) automaticamente, sem o chamador precisar buscar/passar isso.
 *
 * Escopo desta fase: usado nos módulos NOVOS da Fase 8 (Event Bus, Queue
 * Engine, Worker Engine, Chaos Engine) — não uma migração retroativa de
 * todo `console.error` já existente no produto (um diff enorme e
 * desproporcional só para trocar a formatação de log de fases já
 * entregues e funcionando). Ver ADR-032 para o porquê dessa fronteira.
 */
type LogLevel = "debug" | "info" | "warn" | "error";

interface LogFields {
  [key: string]: unknown;
}

function emit(level: LogLevel, module: string, message: string, fields?: LogFields) {
  const entry = {
    level,
    module,
    message,
    correlationId: getCorrelationId(),
    requestId: getRequestId(),
    timestamp: new Date().toISOString(),
    ...fields,
  };

  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (module: string, message: string, fields?: LogFields) => emit("debug", module, message, fields),
  info: (module: string, message: string, fields?: LogFields) => emit("info", module, message, fields),
  warn: (module: string, message: string, fields?: LogFields) => emit("warn", module, message, fields),
  error: (module: string, message: string, fields?: LogFields) => emit("error", module, message, fields),
};
