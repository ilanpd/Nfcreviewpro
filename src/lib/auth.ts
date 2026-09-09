import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "./prisma";
import { resolveOrClaimUser } from "@/services/team.service";
import { roleHasPermission, type Permission } from "@/domain/rbac/roles";
import { isWithinScope, type ScopeRestriction, type ScopeTargetCheck } from "@/domain/rbac/scope";
import { isDevRuntimeEnabled } from "@/lib/dev-runtime/config";
import { getDevRuntimeAuthContext } from "@/lib/dev-runtime/auth";
import type { Role } from "@/generated/prisma/client";

export class UnauthorizedError extends Error {
  constructor(message = "Não autenticado") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Sem permissão para esta ação") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export interface AuthContext {
  userId: string;
  companyId: string;
  organizationId: string | null;
  role: Role;
  email: string;
  /** Empty = unrestricted (default). One or more rows = allow-listed to
   * only those branches/zones — see domain/rbac/scope.ts. */
  accessScopes: ScopeRestriction[];
}

// One query, not two: the user row, its company's organizationId, and its
// access-scope restrictions all come back together via `include` — this is
// the single most-called auth path in the app (every dashboard request),
// so avoiding a second round trip here is the highest-leverage place in the
// whole codebase to avoid an N+1.
const AUTH_USER_SELECT = {
  id: true,
  companyId: true,
  role: true,
  email: true,
  company: { select: { organizationId: true } },
  accessScopes: { select: { branchId: true, zoneId: true } },
} as const;

function toAuthContext(user: {
  id: string;
  companyId: string;
  role: Role;
  email: string;
  company: { organizationId: string | null };
  accessScopes: { branchId: string | null; zoneId: string | null }[];
}): AuthContext {
  return {
    userId: user.id,
    companyId: user.companyId,
    organizationId: user.company.organizationId,
    role: user.role,
    email: user.email,
    accessScopes: user.accessScopes,
  };
}

/**
 * Resolves the signed-in Clerk user to their NFC Review Pro tenant record.
 * Every dashboard API route and server component must go through this —
 * it is the single place that turns a Clerk session into a companyId,
 * which is then used to scope every Prisma query for that request.
 *
 * Dev Runtime (Fase 12): quando `DEV_RUNTIME=1` (nunca em produção — ver
 * `lib/dev-runtime/config.ts`), esta função nunca chama `auth()` do Clerk —
 * resolve direto para um `User` real já semeado. Isso é o que elimina, de
 * vez, a necessidade de editar `middleware.ts`/remover `<ClerkProvider>`
 * para testar (ver ADR-052) — o único ponto de decisão vive aqui, uma vez.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  if (isDevRuntimeEnabled()) {
    return getDevRuntimeAuthContext();
  }

  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  let user = await prisma.user.findUnique({ where: { clerkId }, select: AUTH_USER_SELECT });

  // Fast path misses only on a brand-new sign-in: fall back to claiming a
  // pending invite that matches this Clerk account's email (one-time cost —
  // every later request hits the findUnique above directly).
  if (!user) {
    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress;
    if (email) {
      const claimed = await resolveOrClaimUser(clerkId, email);
      if (claimed) {
        user = await prisma.user.findUnique({ where: { id: claimed.id }, select: AUTH_USER_SELECT });
      }
    }
  }

  if (!user) return null;
  return toAuthContext(user);
}

export async function requireAuthContext(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}

/** Legacy role-list check — still valid wherever a flat role list is enough
 * (e.g. "only OWNER/ADMIN"). requirePermission() below is for anything RBAC
 * v2 (Phase 4) actually needs to reason about by capability, not identity. */
export function requireRole(ctx: AuthContext, roles: Role[]) {
  if (!roles.includes(ctx.role)) throw new ForbiddenError();
}

export function requirePermission(ctx: AuthContext, permission: Permission) {
  if (!roleHasPermission(ctx.role, permission)) throw new ForbiddenError();
}

/** Throws unless the acting user's access scopes (if any) cover the target
 * branch/zone. A user with zero access-scope rows always passes — see
 * domain/rbac/scope.ts for why that's the correct default, not a gap. */
export function requireScopeAccess(ctx: AuthContext, target: ScopeTargetCheck) {
  if (!isWithinScope(ctx.accessScopes, target)) {
    throw new ForbiddenError("Você não tem acesso a esta unidade ou zona");
  }
}
