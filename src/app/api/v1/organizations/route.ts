import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiV1, ApiV1Error } from "@/lib/api-v1";
import { createOrganization, getOrganization, renameOrganization } from "@/services/organization.service";
import { createOrganizationSchema, renameOrganizationSchema } from "@/lib/validations/organization";

/**
 * Recurso singular, não uma lista: uma empresa pertence a no máximo uma
 * Organization (ver ADR-013) — mesma forma de `/api/organization` interno,
 * nunca `/organizations/:id` (não haveria como uma chave de API de uma
 * empresa escolher OUTRA organização para ler/editar).
 */
export const GET = withApiV1(
  async (_req, { apiKey }) => {
    const company = await prisma.company.findUniqueOrThrow({ where: { id: apiKey.companyId }, select: { organizationId: true } });
    if (!company.organizationId) return NextResponse.json(null);
    const organization = await getOrganization(company.organizationId);
    return NextResponse.json(organization);
  },
  { scopes: ["organizations:read"] }
);

export const POST = withApiV1(
  async (req, { apiKey }) => {
    const { name } = createOrganizationSchema.parse(await req.json());
    const organization = await createOrganization(apiKey.companyId, name);
    return NextResponse.json(organization, { status: 201 });
  },
  { scopes: ["organizations:write"] }
);

export const PATCH = withApiV1(
  async (req, { apiKey }) => {
    const company = await prisma.company.findUniqueOrThrow({ where: { id: apiKey.companyId }, select: { organizationId: true } });
    if (!company.organizationId) throw new ApiV1Error("not_found", "Esta empresa não pertence a uma organização.");
    const { name } = renameOrganizationSchema.parse(await req.json());
    const organization = await renameOrganization(company.organizationId, name);
    return NextResponse.json(organization);
  },
  { scopes: ["organizations:write"] }
);
