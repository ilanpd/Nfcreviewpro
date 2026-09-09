import "server-only";
import { prisma } from "@/lib/prisma";
import { companyToBrandConfig } from "@/domain/white-label/types";

const DEMO_COMPANY_SLUG = "bella-vista";

/**
 * Resolve a empresa de demonstração usada pelo Command Center (Fase 6) em
 * `/dev/ceo` — sempre a mesma empresa fixa (o slug nunca vem de fora), então
 * não existe uma superfície de "escolher outra empresa" por onde vazar dado
 * de um tenant real. Toda rota que chama isto também deve checar
 * `process.env.NODE_ENV === "production"` ela mesma antes — ver ADR-027.
 */
export async function getDemoCompany() {
  return prisma.company.findUnique({ where: { slug: DEMO_COMPANY_SLUG } });
}

/** White Label Live Switch (Fase 12) — um conjunto FIXO de slugs, nunca
 * aceito de fora, mesmo espírito de `getDemoCompany()`. Cada uma é um
 * `Company` real (ver `prisma/seed.ts`) — a troca de marca no Demo OS lê
 * cores/nome genuínos, nunca inventados na hora pela UI. */
const WHITE_LABEL_DEMO_SLUGS = ["bella-vista", "sushi-house-demo", "nova-steakhouse-demo"] as const;

export async function listWhiteLabelDemoBrands() {
  const companies = await prisma.company.findMany({ where: { slug: { in: [...WHITE_LABEL_DEMO_SLUGS] } } });
  const bySlug = new Map(companies.map((c) => [c.slug, c]));
  return WHITE_LABEL_DEMO_SLUGS.map((slug) => bySlug.get(slug)).filter((c) => c !== undefined).map(companyToBrandConfig);
}
