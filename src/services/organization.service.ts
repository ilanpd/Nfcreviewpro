import "server-only";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth";
import { invalidateCompany } from "@/lib/resolution-engine/cache";
import { slugify } from "@/lib/slugify";

/**
 * Wraps the acting company in a brand-new Organization — the moment a
 * single-location business formalizes into a franchise brand. The company
 * itself keeps every existing id/relation; only its organizationId changes.
 * See ADR-013.
 */
export async function createOrganization(companyId: string, name: string) {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  if (company.organizationId) throw new ForbiddenError("Esta empresa já pertence a uma organização");

  const baseSlug = slugify(name, { fallback: "organizacao" });
  let slug = baseSlug;
  let attempt = 0;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  const organization = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name, slug } });
    await tx.company.update({ where: { id: companyId }, data: { organizationId: org.id } });
    return org;
  });

  // The company's cached resolver info (PublicCompanyInfo) now carries a
  // stale organizationId=null — must be invalidated or the resolution
  // engine won't pick up ORGANIZATION-scope campaigns until the TTL expires.
  await invalidateCompany(companyId);
  return organization;
}

export function getOrganization(organizationId: string) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    include: { companies: { select: { id: true, name: true, slug: true } } },
  });
}

export async function renameOrganization(organizationId: string, name: string) {
  return prisma.organization.update({ where: { id: organizationId }, data: { name } });
}
