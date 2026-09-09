import "server-only";
import { prisma } from "@/lib/prisma";
import type { AuthContext } from "@/lib/auth";
import { devRuntimeUserEmail } from "./config";

/**
 * Resolve o `AuthContext` do Dev Runtime a partir de um `User` REAL já
 * semeado (`prisma/seed.ts`), nunca um objeto fabricado em memória — Zero
 * Fake Demo se aplica aqui tanto quanto a qualquer tela: "logado como
 * desenvolvedor" continua sendo uma sessão sobre dados genuínos, com RBAC
 * genuíno (o papel/escopo do usuário no banco decide o que a sessão pode
 * fazer, exatamente como uma sessão Clerk real decidiria).
 *
 * `null` quando o usuário configurado não existe (banco não semeado, ou
 * `DEV_RUNTIME_EMAIL` aponta para algo inexistente) — nunca inventa um
 * contexto de fallback.
 */
export async function getDevRuntimeAuthContext(): Promise<AuthContext | null> {
  const email = devRuntimeUserEmail();
  const user = await prisma.user.findFirst({
    where: { email },
    select: {
      id: true,
      companyId: true,
      role: true,
      email: true,
      company: { select: { organizationId: true } },
      accessScopes: { select: { branchId: true, zoneId: true } },
    },
  });
  if (!user) return null;

  return {
    userId: user.id,
    companyId: user.companyId,
    organizationId: user.company.organizationId,
    role: user.role,
    email: user.email,
    accessScopes: user.accessScopes,
  };
}
