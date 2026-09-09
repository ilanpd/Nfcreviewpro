import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * Observability Engine (Fase 8) — Correlation ID / Request ID ambientes via
 * `AsyncLocalStorage`, para que qualquer código no meio de uma requisição
 * (o Resolution Engine, o Event Bus, um worker de fila) consiga se
 * correlacionar com a mesma requisição de origem sem precisar receber o ID
 * como parâmetro explícito em cada função — a alternativa (roscar um
 * `correlationId` por toda assinatura de função do produto) tocaria
 * centenas de call-sites já existentes só para isso.
 */
interface CorrelationContext {
  correlationId: string;
  requestId: string;
}

const storage = new AsyncLocalStorage<CorrelationContext>();

/** Roda `fn` dentro de um novo contexto de correlação — chamar uma vez por
 * requisição/job, o mais cedo possível (middleware, início de uma rota,
 * início do processamento de um job de fila). */
export function withCorrelation<T>(fn: () => T, existingCorrelationId?: string): T {
  const context: CorrelationContext = {
    correlationId: existingCorrelationId ?? randomUUID(),
    requestId: randomUUID(),
  };
  return storage.run(context, fn);
}

/** `null` fora de qualquer contexto de correlação (ex.: um script standalone)
 * — nunca lança, para nunca ser o motivo de uma falha em código que só
 * queria logar algo. */
export function getCorrelationId(): string | null {
  return storage.getStore()?.correlationId ?? null;
}

export function getRequestId(): string | null {
  return storage.getStore()?.requestId ?? null;
}

/** Gera um novo Correlation ID — usado quando não há um contexto ambiente
 * (ex.: o primeiro evento de uma cadeia, iniciado fora de uma requisição
 * HTTP, como um job de fila agendado). */
export function newCorrelationId(): string {
  return randomUUID();
}
