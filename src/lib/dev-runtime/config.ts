/**
 * Dev Runtime (Fase 12) — a infraestrutura permanente que substitui o
 * harness descartável usado nas Fases 9-11 (editar `middleware.ts`/remover
 * `<ClerkProvider>` de `layout.tsx` a cada verificação interativa, sempre
 * restaurado depois). Regra permanente "Self-Healing Development": nenhuma
 * fase futura deveria precisar editar esses dois arquivos de novo.
 *
 * Ativado por UMA variável de ambiente explícita — nunca automático, nunca
 * uma heurística de terceiro (o Clerk 7 tem um modo "keyless" próprio para
 * dev, mas depende de detectar sozinho se o ambiente é "automatizado", uma
 * lógica que não controlamos nem podemos auditar — ver ADR-052). Dois
 * portões, sempre juntos: nunca em produção (`NODE_ENV !== "production"`,
 * o mesmo gate que já protege toda a árvore `/dev/*` desde a Fase 2), e só
 * quando explicitamente ligado (`DEV_RUNTIME=1`).
 */
export function isDevRuntimeEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_RUNTIME === "1";
}

/** E-mail do usuário semeado que o Dev Runtime assume como "logado" —
 * sempre um usuário REAL da empresa de demonstração (nunca um objeto
 * fabricado em memória), para que toda a cadeia de RBAC/escopo continue
 * genuína. Configurável para apontar a um usuário diferente sem tocar
 * código. */
export function devRuntimeUserEmail(): string {
  return process.env.DEV_RUNTIME_EMAIL ?? "owner@demo.com";
}
