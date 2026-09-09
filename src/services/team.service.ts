import "server-only";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth";
import { roleHasPermission } from "@/domain/rbac/roles";
import type { CreateAccessScopeInput, InviteMemberInput, UpdateMemberInput } from "@/lib/validations/team";
import type { Role } from "@/generated/prisma/client";

export function listMembers(companyId: string) {
  return prisma.user.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });
}

export async function inviteMember(companyId: string, input: InviteMemberInput) {
  const existing = await prisma.user.findUnique({
    where: { companyId_email: { companyId, email: input.email } },
  });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      companyId,
      email: input.email,
      name: input.name,
      role: input.role,
      status: "PENDING",
    },
  });
}

export async function updateMemberRole(companyId: string, memberId: string, input: UpdateMemberInput) {
  const member = await prisma.user.findFirst({ where: { id: memberId, companyId } });
  if (!member) throw new ForbiddenError("Membro não encontrado nesta empresa");
  return prisma.user.update({ where: { id: memberId }, data: { role: input.role } });
}

export async function removeMember(companyId: string, memberId: string, actingRole: Role) {
  const member = await prisma.user.findFirst({ where: { id: memberId, companyId } });
  if (!member) throw new ForbiddenError("Membro não encontrado nesta empresa");
  if (member.role === "OWNER") throw new ForbiddenError("Não é possível remover o proprietário");
  if (!roleHasPermission(actingRole, "team:write")) throw new ForbiddenError("Sem permissão para remover membros");
  await prisma.user.delete({ where: { id: memberId } });
}

// --- Access scopes (Phase 4 / RBAC v2) ---
// Opt-in restriction, not a grant — see domain/rbac/scope.ts and ADR-015.

export function listAccessScopes(companyId: string, userId: string) {
  return prisma.userAccessScope.findMany({
    where: { companyId, userId },
    include: {
      branch: { select: { id: true, name: true } },
      zone: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function grantAccessScope(companyId: string, userId: string, input: CreateAccessScopeInput) {
  const member = await prisma.user.findFirst({ where: { id: userId, companyId } });
  if (!member) throw new ForbiddenError("Membro não encontrado nesta empresa");
  if (member.role === "OWNER") throw new ForbiddenError("Não é possível restringir o acesso do proprietário");

  if (input.branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: input.branchId, companyId } });
    if (!branch) throw new ForbiddenError("Unidade não encontrada nesta empresa");
  }
  if (input.zoneId) {
    const zone = await prisma.zone.findFirst({ where: { id: input.zoneId, companyId } });
    if (!zone) throw new ForbiddenError("Zona não encontrada nesta empresa");
  }

  const existing = await prisma.userAccessScope.findFirst({
    where: { userId, branchId: input.branchId ?? null, zoneId: input.zoneId ?? null },
  });
  if (existing) throw new ForbiddenError("Essa restrição já existe para este membro");

  return prisma.userAccessScope.create({
    data: {
      companyId,
      userId,
      branchId: input.branchId ?? null,
      zoneId: input.zoneId ?? null,
    },
    include: {
      branch: { select: { id: true, name: true } },
      zone: { select: { id: true, name: true } },
    },
  });
}

export async function revokeAccessScope(companyId: string, userId: string, scopeId: string) {
  const scope = await prisma.userAccessScope.findFirst({ where: { id: scopeId, companyId, userId } });
  if (!scope) throw new ForbiddenError("Restrição não encontrada");
  await prisma.userAccessScope.delete({ where: { id: scopeId } });
}

/**
 * Links a freshly-signed-in Clerk account to its tenant record: either an
 * existing membership (already claimed), a pending invite matching the
 * account's email (claimed on first sign-in), or nothing — in which case
 * the caller should route the user to onboarding to create a new company.
 */
export async function resolveOrClaimUser(clerkId: string, email: string) {
  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  const pendingInvite = await prisma.user.findFirst({
    where: { email, status: "PENDING", clerkId: null },
  });
  if (pendingInvite) {
    return prisma.user.update({
      where: { id: pendingInvite.id },
      data: { clerkId, status: "ACTIVE" },
    });
  }

  return null;
}
