/**
 * API Pública v1 (Fase 9) — os escopos que uma `ApiKey` pode carregar.
 * Puramente aditivo à RBAC v2 (Fase 4): uma chave de API não tem `role` nem
 * `accessScopes` de usuário — ela representa a EMPRESA inteira, autorizada
 * por capacidade explícita, nunca por identidade de um humano. Uma string
 * simples (não um enum do Postgres), pelo mesmo motivo de `EventLog.type`
 * (Fase 8): um escopo novo nunca deve exigir uma migração de schema.
 */
export const API_SCOPES = [
  "cards:read",
  "cards:write",
  "campaigns:read",
  "campaigns:write",
  "zones:read",
  "zones:write",
  "branches:read",
  "branches:write",
  "organizations:read",
  "organizations:write",
  "analytics:read",
  "events:read",
  "feedback:read",
  "feedback:write",
  "webhooks:manage",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export function isApiScope(value: string): value is ApiScope {
  return (API_SCOPES as readonly string[]).includes(value);
}

/** Rótulo curto em português para a UI do Dashboard de Desenvolvedor — nunca
 * usado em payload de API (o contrato de fio sempre usa a string em inglês). */
export const API_SCOPE_LABELS: Record<ApiScope, string> = {
  "cards:read": "Ler cartões/mesas",
  "cards:write": "Criar e editar cartões/mesas",
  "campaigns:read": "Ler campanhas",
  "campaigns:write": "Criar, editar e atribuir campanhas",
  "zones:read": "Ler zonas",
  "zones:write": "Criar e editar zonas",
  "branches:read": "Ler unidades",
  "branches:write": "Criar e editar unidades",
  "organizations:read": "Ler organização",
  "organizations:write": "Criar e renomear organização",
  "analytics:read": "Ler KPIs, funil e rankings",
  "events:read": "Ler eventos de domínio (EventLog)",
  "feedback:read": "Ler feedbacks privados",
  "feedback:write": "Marcar feedbacks como resolvidos",
  "webhooks:manage": "Gerenciar endpoints de webhook",
};
