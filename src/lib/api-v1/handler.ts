import "server-only";
import { after } from "next/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withCorrelation } from "@/lib/observability/correlation";
import { requireApiKey, type ApiKeyContext } from "./auth";
import { rateLimit } from "@/lib/rate-limit";
import { ApiV1Error, handleApiV1Error, currentRequestId } from "./errors";
import { recordApiRequest } from "./request-log";
import { claimIdempotencyKey, storeIdempotentResponse } from "./idempotency";
import type { ApiScope } from "@/domain/api-v1/scopes";

/**
 * API Pública v1 (Fase 9) — o único ponto de entrada de toda rota
 * `/api/v1/**`. Toda rota é uma função fina que só sabe sua própria lógica
 * de negócio (reaproveitando os serviços internos já existentes — nunca
 * duplicando regra de negócio); autenticação, escopo, rate limit,
 * idempotência, log de requisição e o envelope de erro padrão vivem uma
 * única vez, aqui. Ver ADR-036 e a Platform First Review em
 * `RELATORIO_FASE_9.md`.
 */
export interface ApiV1RouteContext<P = Record<string, string>> {
  params: P;
  apiKey: ApiKeyContext;
}

type ApiV1Handler<P = Record<string, string>> = (req: NextRequest, ctx: ApiV1RouteContext<P>) => Promise<NextResponse>;

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export function withApiV1<P = Record<string, string>>(handler: ApiV1Handler<P>, options: { scopes?: ApiScope[] } = {}) {
  return async (req: NextRequest, routeCtx: { params: Promise<P> }): Promise<NextResponse> => {
    return withCorrelation(async () => {
      const startedAt = Date.now();
      const path = new URL(req.url).pathname;
      let companyId: string | null = null;
      let apiKeyId: string | null = null;
      let response: NextResponse;

      try {
        const apiKey = await requireApiKey(req, options.scopes ?? []);
        companyId = apiKey.companyId;
        apiKeyId = apiKey.apiKeyId;

        const { success } = await rateLimit("apiV1", apiKey.apiKeyId);
        if (!success) {
          throw new ApiV1Error("rate_limited", "Limite de requisições excedido para esta chave de API. Tente novamente em instantes.");
        }

        const params = await routeCtx.params;
        const idempotencyKey = MUTATING_METHODS.has(req.method) ? req.headers.get("idempotency-key") : null;

        if (idempotencyKey) {
          const claim = await claimIdempotencyKey(companyId, idempotencyKey);
          if (!claim.claimed && claim.cached) {
            response = NextResponse.json(claim.cached.body, { status: claim.cached.status });
            response.headers.set("Idempotency-Replayed", "true");
          } else if (!claim.claimed) {
            throw new ApiV1Error(
              "idempotency_key_reused",
              "Uma requisição com esta chave de idempotência já está em andamento — tente novamente em instantes."
            );
          } else {
            response = await handler(req, { params, apiKey });
            const body = await response
              .clone()
              .json()
              .catch(() => null);
            await storeIdempotentResponse(companyId, idempotencyKey, { status: response.status, body });
          }
        } else {
          response = await handler(req, { params, apiKey });
        }
      } catch (error) {
        response = handleApiV1Error(error);
      }

      response.headers.set("X-Request-Id", currentRequestId());

      const latencyMs = Date.now() - startedAt;
      const statusCode = response.status;
      const method = req.method;
      const loggedCompanyId = companyId;
      const loggedApiKeyId = apiKeyId;
      if (loggedCompanyId) {
        after(() => {
          recordApiRequest({ companyId: loggedCompanyId, apiKeyId: loggedApiKeyId, method, path, statusCode, latencyMs }).catch(() => {});
        });
      }

      return response;
    });
  };
}
