/**
 * Regras de proteção aplicadas UMA vez, no middleware, a todo `/api/*`.
 * Tudo puro e sem `node:*` (roda no runtime Edge): o middleware só liga estas
 * decisões às respostas. Ver `middleware.ts` e ADR-096.
 */

export const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// Rotas que NÃO passam pelas guardas gerais, cada uma por um motivo:
//  - webhook do Stripe: servidor a servidor, autenticado por assinatura HMAC;
//    descartar uma entrega legítima de pagamento seria pior que não limitar;
//  - API pública v1: autenticada por chave de API, com limite próprio por chave;
//  - agendamentos (cron): chamados pela infraestrutura, protegidos por CRON_SECRET.
// Comparação EXATA (só a API v1 é um prefixo): um prefixo deixaria uma rota nova de nome parecido
// (ex.: /api/queues/process-x) escapar de todas as guardas sem ninguém perceber.
const UNGUARDED_EXACT = new Set(["/api/stripe/webhook", "/api/queues/process", "/api/playbooks/evaluate", "/api/return/reengagement"]);
const UNGUARDED_PREFIXES = ["/api/v1/"];

export function isGuardedApiPath(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  if (UNGUARDED_EXACT.has(pathname)) return false;
  return !UNGUARDED_PREFIXES.some((p) => pathname.startsWith(p));
}

// ---------------------------------------------------------------------------
// Tamanho do corpo
// ---------------------------------------------------------------------------

/** Teto padrão do corpo de uma requisição à API (todo JSON do produto cabe com folga). */
export const API_MAX_BODY_BYTES = 1_000_000;

// Exceções explícitas. A Vercel já corta em ~4,5 MB; o upload da arte da placa
// (só super-admin) precisa de mais que o padrão.
const BODY_LIMIT_OVERRIDES: readonly (readonly [string, number])[] = [["/api/admin/plates/models/", 4_400_000]];

export function bodyLimitFor(pathname: string): number {
  return BODY_LIMIT_OVERRIDES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? API_MAX_BODY_BYTES;
}

/**
 * O `Content-Length` declarado passa do teto? Só se vê o que foi declarado: um corpo
 * em partes (`chunked`) não traz o tamanho, e aí o limite é o da própria Vercel.
 * Um `Content-Length` que não é número válido é tratado como excesso (requisição malformada).
 */
export function exceedsBodyLimit(contentLength: string | null, pathname: string): boolean {
  if (contentLength === null) return false;
  if (!/^\d+$/.test(contentLength.trim())) return true;
  return Number(contentLength) > bodyLimitFor(pathname);
}

// ---------------------------------------------------------------------------
// Requisição vinda de outro site (CSRF)
// ---------------------------------------------------------------------------

export interface MutationOrigin {
  method: string;
  origin: string | null;
  secFetchSite: string | null;
  /** O host que o navegador usou para chegar aqui (inclui domínios personalizados). */
  host: string | null;
}

/**
 * Uma requisição que ALTERA dado e veio de uma página de OUTRO site?
 *
 * Os navegadores mandam `Sec-Fetch-Site` e `Origin` em toda requisição que altera
 * dado, e uma página alheia não consegue forjá-los. O cookie de sessão do Clerk já é
 * `SameSite=Lax`, o que barra o caso comum; isto fecha o resto (e protege se um
 * cookie mudar de atributo). Cliente que não é navegador (curl, servidor, app) não
 * manda esses cabeçalhos, e também não carrega o cookie de ninguém: passa.
 */
export function isCrossSiteMutation({ method, origin, secFetchSite, host }: MutationOrigin): boolean {
  if (!MUTATING_METHODS.has(method.toUpperCase())) return false;

  const site = secFetchSite?.toLowerCase() ?? null;
  if (site === "same-origin" || site === "none") return false;

  if (origin !== null) {
    if (origin === "null") return true; // contexto isolado/opaco: nunca é o nosso site
    try {
      return !!host && new URL(origin).host !== host;
    } catch {
      return true; // Origin ilegível
    }
  }

  // sem Origin: se o navegador declara que veio de outro site, recusa; sem nenhum dos dois, não é navegador
  return site === "cross-site" || site === "same-site";
}

// ---------------------------------------------------------------------------
// Classes de limite de taxa (a política, num lugar só)
// ---------------------------------------------------------------------------

export type RateClass = "authMutation" | "apiRead" | "publicData" | "publicImage" | "personalLink" | "exportHeavy";

// Rotas AUTENTICADAS caras: gerar CSV/PDF/arquivo pesa no banco e na CPU.
const HEAVY_EXACT = new Set(["/api/analytics/export", "/api/company/export", "/api/admin/orders/export", "/api/export/feedback"]);

function isHeavyExport(pathname: string): boolean {
  if (HEAVY_EXACT.has(pathname)) return true;
  if (/^\/api\/admin\/plates\/batches\/[^/]+\/export\//.test(pathname)) return true;
  if (/^\/api\/cards\/[^/]+\/print$/.test(pathname)) return true;
  return false;
}

/**
 * Que classe de limite vale para esta requisição? A classe escolhe os números em
 * `lib/rate-limit.ts`. Rotas fora das guardas gerais devolvem `null`.
 */
export function rateClassFor(method: string, pathname: string): RateClass | null {
  if (!isGuardedApiPath(pathname)) return null;
  const m = method.toUpperCase();

  if (pathname.startsWith("/api/meu-cartao/")) return "personalLink"; // token no caminho: nunca deixar adivinhar em massa
  if (MUTATING_METHODS.has(m)) return isHeavyExport(pathname) ? "exportHeavy" : "authMutation";

  if (isHeavyExport(pathname)) return "exportHeavy";
  if (pathname.startsWith("/api/demo/")) return "publicData"; // dados da demonstração, sem login e com consulta ao banco
  if (pathname.startsWith("/api/qr/") || pathname.startsWith("/api/brand/")) return "publicImage"; // imagens geradas na hora
  return "apiRead";
}
