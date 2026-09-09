import "server-only";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { cachedOrLoad } from "@/lib/resolution-engine/cache";
import { classifyHost } from "@/domain/white-label/host";
import { companyToBrandConfig } from "@/domain/white-label/types";
import type { BrandConfig } from "@/domain/white-label/types";

/**
 * White Label (Fase 10) — o `DomainResolver`: resolve um `Host` header para
 * a marca de uma empresa, ANTES do resto do sistema carregar — chamado
 * direto de dentro das páginas de login/cadastro (Server Components,
 * runtime Node), NUNCA do middleware (Edge Runtime, não sustenta o Prisma
 * — ver a nota em `middleware.ts` e ADR-042). Deliberadamente separado de
 * `services/company.service.ts` (autenticado, por `companyId`, sem cache):
 * este caminho é público, chaveado por `Host`, e cacheável — a mesma
 * separação já estabelecida entre `resolution-engine/data.ts` e
 * `card.service.ts` desde a Fase 1 (ADR-001). Nunca resolve um domínio
 * customizado NÃO verificado — ver a checagem em `loadByVerifiedDomain`.
 */
const TTL_SECONDS = 120;

function cacheKey(host: string) {
  return `brand:host:v1:${host}`;
}

const BRAND_SELECT = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  faviconUrl: true,
  primaryColor: true,
  secondaryColor: true,
  domain: true,
  domainVerifiedAt: true,
  loginHeadline: true,
  loginBackgroundUrl: true,
} as const;

async function loadBySlug(slug: string): Promise<BrandConfig | null> {
  const company = await prisma.company.findUnique({ where: { slug }, select: BRAND_SELECT });
  return company ? companyToBrandConfig(company) : null;
}

// Um domínio customizado só resolve branding depois de verificado — sem
// isso, uma empresa poderia digitar o domínio de outra pessoa em
// Configurações e, mesmo sem provar posse via DNS, fazer nosso produto
// responder com a marca dela para quem quer que visite aquele domínio
// (o próprio DNS de terceiros nunca apontaria para nós sem cooperação do
// dono real, mas a checagem existe para nunca depender só disso).
async function loadByVerifiedDomain(hostname: string): Promise<BrandConfig | null> {
  const company = await prisma.company.findFirst({
    where: { domain: hostname, domainVerifiedAt: { not: null } },
    select: BRAND_SELECT,
  });
  return company ? companyToBrandConfig(company) : null;
}

/** `null` = domínio raiz do produto (usa a identidade padrão do NFC OS) OU
 * nenhuma empresa encontrada para este host — os dois casos tratados da
 * mesma forma pelo chamador (mostrar o padrão), nunca um erro. */
export async function resolveBrandByHost(hostHeader: string | null | undefined): Promise<BrandConfig | null> {
  if (!hostHeader) return null;
  const classification = classifyHost(hostHeader);
  if (classification.kind === "root") return null;

  const key = cacheKey(hostHeader.toLowerCase());
  const { value } = await cachedOrLoad(key, TTL_SECONDS, () =>
    classification.kind === "subdomain" ? loadBySlug(classification.slug) : loadByVerifiedDomain(classification.hostname)
  );
  return value;
}

/** Chamado depois de qualquer edição de marca/domínio — best-effort, nunca
 * lança. `null`/`undefined` são filtrados, então chamar com
 * `[company.domain, `${company.slug}.${root}`]` é seguro mesmo quando
 * `domain` é `null`. */
export async function invalidateBrandHostCache(hosts: (string | null | undefined)[]): Promise<void> {
  if (!redis) return;
  await Promise.all(
    hosts
      .filter((h): h is string => Boolean(h))
      .map((h) => redis!.del(cacheKey(h.toLowerCase())).catch(() => {}))
  );
}
