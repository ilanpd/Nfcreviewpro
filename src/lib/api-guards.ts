import { NextResponse, type NextRequest } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";
import { MUTATING_METHODS, exceedsBodyLimit, isCrossSiteMutation, isGuardedApiPath, rateClassFor } from "@/lib/request-guards";

/**
 * A cadeia de guardas de `/api/*` (ADR-096), na ordem em que custa menos recusar:
 *   1) corpo grande demais  -> 413   (nem lê o corpo)
 *   2) requisição de OUTRO site que altera dado (CSRF) -> 403
 *   3) limite de taxa pela classe da rota -> 429 (com `Retry-After` e `RateLimit-*`)
 * Devolve a resposta que recusa, ou `null` para deixar a requisição seguir.
 *
 * Fica fora do `middleware.ts` para ser testável de ponta a ponta (o middleware inteiro
 * depende do Clerk) e roda no runtime Edge: nada de `node:*` aqui.
 *
 * `getUserId` é preguiçoso: só se chama o Clerk quando a rota tem limite por usuário.
 */
export async function runApiGuards(req: NextRequest, getUserId: () => Promise<string | null>): Promise<NextResponse | null> {
  const { pathname } = req.nextUrl;
  if (!isGuardedApiPath(pathname)) return null;

  const method = req.method.toUpperCase();
  const mutating = MUTATING_METHODS.has(method);

  if (mutating && exceedsBodyLimit(req.headers.get("content-length"), pathname)) {
    return NextResponse.json({ error: "Requisição grande demais." }, { status: 413 });
  }

  if (
    isCrossSiteMutation({
      method,
      origin: req.headers.get("origin"),
      secFetchSite: req.headers.get("sec-fetch-site"),
      host: req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
    })
  ) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  const rateClass = rateClassFor(method, pathname);
  if (!rateClass) return null;

  const userId = await getUserId();
  const ip = getClientIp(req.headers);
  const result = await rateLimit(rateClass, userId ?? ip);
  if (!result.success) return tooManyRequestsResponse(result);

  // Quem tem conta também tem um teto por IP: criar várias contas não multiplica o limite.
  if (userId && rateClass === "authMutation") {
    const byIp = await rateLimit("authMutationIp", ip);
    if (!byIp.success) return tooManyRequestsResponse(byIp);
  }
  return null;
}
