import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { log } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/correlation";
import { ForbiddenError } from "@/lib/auth";

/**
 * API Pública v1 (Fase 9) — todo erro desta API segue um único envelope,
 * inspirado no da Stripe: `{ error: { code, message, request_id } }`. Nunca
 * o formato solto `{ error: "texto" }` já usado pelas rotas internas
 * (`lib/api-error.ts`) — um desenvolvedor terceiro precisa de um `code`
 * estável para tratar programaticamente (`if (error.code === "not_found")`),
 * não só uma mensagem legível por humano. As duas famílias de rota nunca se
 * misturam (ver ADR-036): `handleApiError` para `/api/**` interno,
 * `handleApiV1Error` só para `/api/v1/**`.
 */
export type ApiV1ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "rate_limited"
  | "idempotency_key_reused"
  | "conflict"
  | "internal_error";

const STATUS_BY_CODE: Record<ApiV1ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation_error: 422,
  rate_limited: 429,
  idempotency_key_reused: 409,
  conflict: 409,
  internal_error: 500,
};

export class ApiV1Error extends Error {
  code: ApiV1ErrorCode;
  details?: unknown;

  constructor(code: ApiV1ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiV1Error";
    this.code = code;
    this.details = details;
  }
}

/** O mesmo Request ID desta requisição (Observability Engine, Fase 8) —
 * assim, o `request_id` que um desenvolvedor recebe no erro é o mesmo que
 * aparece nos logs estruturados do servidor e no header `X-Request-Id`
 * (ver `lib/api-v1/handler.ts`), fechando o ciclo "erro → suporte → log". */
export function currentRequestId(): string {
  return `req_${(getRequestId() ?? randomUUID()).replace(/-/g, "")}`;
}

export function apiV1Error(code: ApiV1ErrorCode, message: string, details?: unknown): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
        request_id: currentRequestId(),
      },
    },
    { status: STATUS_BY_CODE[code] }
  );
}

/**
 * Envolve uma chamada de serviço que busca um recurso POR ID dentro da
 * empresa (ex.: `getCardForCompany`) — os serviços internos sinalizam "não
 * existe para este tenant" lançando `ForbiddenError` (a mesma classe usada
 * para uma restrição de acesso de verdade, uma distinção que nunca importou
 * para o dashboard interno). Um desenvolvedor terceiro, porém, precisa da
 * distinção certa: um `GET /cards/:id` para um id inexistente é 404, nunca
 * 403. Usar SÓ ao redor de get/update/delete por id — nunca ao redor de uma
 * chamada que pode falhar por uma regra de negócio genuína (ex.: limite de
 * plano em `createCard`), que deve continuar como 403 forbidden via o
 * fallback padrão abaixo.
 */
export async function notFoundIfMissing<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ForbiddenError) throw new ApiV1Error("not_found", error.message);
    throw error;
  }
}

/** Converte qualquer erro lançado dentro de um handler de rota v1 no
 * envelope padrão — o único lugar que decide esse formato, para nenhuma
 * rota inventar sua própria variação por engano. Um `ForbiddenError` que
 * NÃO passou por `notFoundIfMissing` acima vira 403 forbidden — o
 * significado literal da classe, o fallback correto para uma regra de
 * negócio genuína. */
export function handleApiV1Error(error: unknown): NextResponse {
  if (error instanceof ApiV1Error) {
    return apiV1Error(error.code, error.message, error.details);
  }
  if (error instanceof ForbiddenError) {
    return apiV1Error("forbidden", error.message);
  }
  if (error instanceof ZodError) {
    return apiV1Error("validation_error", "Os dados enviados não são válidos.", error.flatten());
  }

  log.error("api-v1", "Erro não tratado num handler da API pública", { error: String(error) });
  return apiV1Error("internal_error", "Erro interno do servidor.");
}
