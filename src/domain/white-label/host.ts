/**
 * White Label (Fase 10) — classifica um `Host` header em "domínio raiz do
 * produto," "subdomínio de uma empresa" (`{slug}.dominio-raiz`), ou
 * "domínio customizado" (qualquer outra coisa — resolvido contra
 * `Company.domain`). Puro, sem I/O — `services/branding.service.ts` decide
 * o que fazer com o resultado.
 */
export function getRootDomain(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").hostname;
  } catch {
    return "localhost";
  }
}

export type HostClassification = { kind: "root" } | { kind: "subdomain"; slug: string } | { kind: "custom"; hostname: string };

export function classifyHost(hostHeader: string): HostClassification {
  const hostname = hostHeader.split(":")[0].trim().toLowerCase();
  const root = getRootDomain();

  if (hostname === root || hostname === `www.${root}`) return { kind: "root" };
  if (hostname.endsWith(`.${root}`)) {
    const slug = hostname.slice(0, -(root.length + 1));
    return { kind: "subdomain", slug };
  }
  return { kind: "custom", hostname };
}
