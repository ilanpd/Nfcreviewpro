import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { isDevRuntimeEnabled } from "@/lib/dev-runtime/config";

/**
 * Painel Admin (Fase 16) — identidade do super-admin (dono da marca, nunca
 * um papel dentro de uma empresa cliente) vem de uma allowlist de e-mails
 * em `SUPER_ADMIN_EMAILS` (separados por vírgula), nunca de um campo no
 * banco de uma empresa — o super-admin não pertence a nenhuma `Company`.
 * Mesmo padrão de fail-closed já usado em `lib/dev/gate.ts`: env var
 * ausente = ninguém é super-admin, nunca um usuário-padrão liberado por
 * engano.
 */
function getSuperAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** E-mail de quem está agindo como super-admin, para registrar na auditoria. */
export async function getSuperAdminEmail(): Promise<string> {
  if (isDevRuntimeEnabled()) return "dev-runtime";
  const user = await currentUser();
  return user?.primaryEmailAddress?.emailAddress ?? "desconhecido";
}

export async function isSuperAdmin(): Promise<boolean> {
  // Self-Healing Development (ADR-052) — sem isto, toda rota de escrita do
  // Admin fica permanentemente intestável fora do Clerk real de Produção,
  // já que `currentUser()` nunca resolve sob Dev Runtime. Mesmo duplo
  // portão já usado em todo o resto do Dev Runtime (`isDevRuntimeEnabled`
  // exige `NODE_ENV !== "production"` E `DEV_RUNTIME=1` explícito) — nunca
  // verdadeiro em Produção real, onde nenhuma das duas condições se aplica.
  if (isDevRuntimeEnabled()) return true;

  const allowlist = getSuperAdminEmails();
  if (allowlist.length === 0) return false;

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!email) return false;

  return allowlist.includes(email);
}
