/**
 * O e-mail só serve como IDENTIDADE se foi verificado.
 *
 * Quatro decisões do sistema tratam o e-mail do Clerk como prova de quem a pessoa
 * é: quem é super-admin (allowlist `SUPER_ADMIN_EMAILS`), qual convite pendente de
 * equipe a pessoa herda (`resolveOrClaimUser`), qual empresa convidada ela
 * "reivindica" (`claimGuestCompany`, que traz cartões e histórico de um comprador)
 * e a recuperação de acesso. Se o Clerk estiver configurado para aceitar um e-mail
 * NÃO verificado no cadastro, qualquer pessoa poderia se registrar com o e-mail de
 * um administrador, de um convidado ou de um comprador e herdar o acesso dele.
 * Aqui o código não depende dessa configuração: sem `verification.status ===
 * "verified"`, o e-mail não vale como identidade.
 */
export interface ClerkUserWithEmail {
  primaryEmailAddress?: {
    emailAddress?: string | null;
    verification?: { status?: string | null } | null;
  } | null;
}

/** O e-mail principal, só se verificado (OAuth do Google/Apple também chega como "verified"); senão `null`. */
export function verifiedPrimaryEmail(user: ClerkUserWithEmail | null | undefined): string | null {
  const primary = user?.primaryEmailAddress;
  const email = primary?.emailAddress?.trim();
  if (!email) return null;
  return primary?.verification?.status === "verified" ? email : null;
}

/** O e-mail principal, com ou sem verificação, só para EXIBIR (nunca para decidir acesso). */
export function displayPrimaryEmail(user: ClerkUserWithEmail | null | undefined): string | null {
  return user?.primaryEmailAddress?.emailAddress?.trim() || null;
}
