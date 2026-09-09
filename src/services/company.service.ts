import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { invalidateCompany } from "@/lib/resolution-engine/cache";
import { invalidateBrandHostCache } from "@/lib/white-label/resolve-brand";
import { lookupTxtRecord } from "@/lib/white-label/dns";
import { getRootDomain } from "@/domain/white-label/host";
import { ForbiddenError } from "@/lib/auth";
import { slugify } from "@/lib/slugify";
import type { OnboardingInput, UpdateCompanyInput } from "@/lib/validations/company";

export async function getCompanyById(companyId: string) {
  return prisma.company.findUniqueOrThrow({ where: { id: companyId } });
}

function subdomainHost(slug: string): string {
  return `${slug}.${getRootDomain()}`;
}

/** Invalida os dois hosts pelos quais esta empresa pode ser resolvida — o
 * subdomínio (sempre) e o domínio customizado (se houver um configurado no
 * momento da chamada). Chamado depois de qualquer edição que mude o que
 * `DomainResolver` devolveria para algum desses hosts. */
async function invalidateCompanyBrandCaches(company: { slug: string; domain: string | null }) {
  await invalidateBrandHostCache([subdomainHost(company.slug), company.domain]);
}

export async function updateCompany(companyId: string, input: UpdateCompanyInput) {
  const company = await prisma.company.update({ where: { id: companyId }, data: input });
  await invalidateCompany(companyId);
  await invalidateCompanyBrandCaches(company);
  return company;
}

// --- White Label (Fase 10): domínio customizado ---
// Ver lib/white-label/resolve-brand.ts para por que branding só resolve
// depois de `domainVerifiedAt` preenchido, e ADR-042 para o desenho
// completo da verificação.

export async function claimDomain(companyId: string, domain: string) {
  const existing = await prisma.company.findUnique({ where: { domain } });
  if (existing && existing.id !== companyId) {
    throw new ForbiddenError("Este domínio já está em uso por outra empresa.");
  }

  const domainVerificationToken = randomBytes(16).toString("hex");
  const company = await prisma.company.update({
    where: { id: companyId },
    data: { domain, domainVerificationToken, domainVerifiedAt: null },
  });
  await invalidateCompany(companyId);
  await invalidateCompanyBrandCaches(company);
  return company;
}

export async function removeDomain(companyId: string) {
  const company = await prisma.company.update({
    where: { id: companyId },
    data: { domain: null, domainVerificationToken: null, domainVerifiedAt: null },
  });
  await invalidateCompany(companyId);
  await invalidateCompanyBrandCaches({ ...company, domain: null });
  return company;
}

export interface DomainVerificationResult {
  verified: boolean;
  reason?: string;
}

export async function verifyDomainOwnership(companyId: string): Promise<DomainVerificationResult> {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  if (!company.domain || !company.domainVerificationToken) {
    throw new ForbiddenError("Nenhum domínio pendente de verificação para esta empresa.");
  }

  const records = await lookupTxtRecord(`_nfcos-challenge.${company.domain}`);
  const verified = records.includes(company.domainVerificationToken);
  if (!verified) {
    return { verified: false, reason: "Registro TXT ainda não encontrado ou não corresponde. A propagação de DNS pode levar alguns minutos." };
  }

  await prisma.company.update({ where: { id: companyId }, data: { domainVerifiedAt: new Date() } });
  await invalidateCompanyBrandCaches(company);
  return { verified: true };
}

/** Creates a company for a brand-new Clerk user and makes them its OWNER. */
export async function createCompanyForNewUser(params: {
  clerkId: string;
  email: string;
  input: OnboardingInput;
}) {
  const { clerkId, email, input } = params;

  const baseSlug = slugify(input.name, { fallback: "empresa" });
  let slug = baseSlug;
  let attempt = 0;
  while (await prisma.company.findUnique({ where: { slug } })) {
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: input.name,
        slug,
        whatsapp: input.whatsapp,
        googleReviewUrl: input.googleReviewUrl,
        primaryColor: input.primaryColor,
      },
    });

    await tx.user.create({
      data: {
        clerkId,
        companyId: company.id,
        email,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    return company;
  });
}
