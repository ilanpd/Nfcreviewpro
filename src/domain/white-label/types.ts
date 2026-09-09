/** White Label (Fase 10) — a forma completa de "marca de uma empresa,"
 * lida por `BrandProvider`, pelo Theme Studio, pelas rotas de favicon/OG/
 * manifest, e pela tela de login. Um único formato, nunca cada consumidor
 * montando seu próprio subconjunto de campos de `Company`. */
export interface BrandConfig {
  companyId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  domain: string | null;
  domainVerifiedAt: Date | null;
  loginHeadline: string | null;
  loginBackgroundUrl: string | null;
}

export const DEFAULT_BRAND_NAME = "NFC OS";
export const DEFAULT_PRIMARY_COLOR = "#0F172A";

interface BrandableCompany {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  domain: string | null;
  domainVerifiedAt: Date | null;
  loginHeadline: string | null;
  loginBackgroundUrl: string | null;
}

/** O único conversor `Company` (ou uma projeção dela) → `BrandConfig` —
 * usado tanto pelo `DomainResolver` (`lib/white-label/resolve-brand.ts`)
 * quanto pelo layout do dashboard (marca da própria empresa autenticada),
 * para as duas fontes nunca poderem montar o formato de forma diferente. */
export function companyToBrandConfig(company: BrandableCompany): BrandConfig {
  return {
    companyId: company.id,
    name: company.name,
    slug: company.slug,
    logoUrl: company.logoUrl,
    faviconUrl: company.faviconUrl,
    primaryColor: company.primaryColor,
    secondaryColor: company.secondaryColor,
    domain: company.domain,
    domainVerifiedAt: company.domainVerifiedAt,
    loginHeadline: company.loginHeadline,
    loginBackgroundUrl: company.loginBackgroundUrl,
  };
}
