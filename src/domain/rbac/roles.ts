import type { Role } from "@/generated/prisma/client";

/**
 * A closed set of named permissions, not a free-form string — every
 * permission actually checked somewhere in the app must be declared here,
 * so `ROLE_PERMISSIONS` below can be exhaustively type-checked against it
 * (TypeScript will error if a role's permission set typos a value this
 * union doesn't contain).
 */
export type Permission =
  | "settings:write"
  | "organization:write"
  | "team:write"
  | "access-scope:write"
  | "campaign:write"
  | "campaign:assign"
  | "card:write"
  | "feedback:resolve"
  | "audit:read"
  | "developers:manage"
  | "automation:manage";

/**
 * Reads as a permission matrix, not a role hierarchy — OWNER/ADMIN aren't
 * "MANAGER plus more" in the code, they're each an explicit list, so adding
 * a permission later means touching this table deliberately for every role
 * instead of relying on an implicit "higher roles inherit lower ones" rule
 * that's easy to get wrong at the edges. See RELATORIO_FASE_4.md for the full
 * matrix with rationale per role.
 */
const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  OWNER: new Set<Permission>([
    "settings:write",
    "organization:write",
    "team:write",
    "access-scope:write",
    "campaign:write",
    "campaign:assign",
    "card:write",
    "feedback:resolve",
    "audit:read",
    "developers:manage",
    "automation:manage",
  ]),
  ADMIN: new Set<Permission>([
    "settings:write",
    "organization:write",
    "team:write",
    "access-scope:write",
    "campaign:write",
    "campaign:assign",
    "card:write",
    "feedback:resolve",
    "audit:read",
    "developers:manage",
    "automation:manage",
  ]),
  MARKETING: new Set<Permission>(["campaign:write", "campaign:assign"]),
  MANAGER: new Set<Permission>(["campaign:write", "campaign:assign", "card:write", "feedback:resolve"]),
  OPERATOR: new Set<Permission>(["feedback:resolve"]),
  READ_ONLY: new Set<Permission>([]),
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  MARKETING: "Marketing",
  MANAGER: "Gerente",
  OPERATOR: "Operador",
  READ_ONLY: "Somente leitura",
};

export const PERMISSION_LABEL: Record<Permission, string> = {
  "settings:write": "Editar configurações da empresa",
  "organization:write": "Criar/renomear organização",
  "team:write": "Gerenciar equipe",
  "access-scope:write": "Restringir acesso por unidade/zona",
  "campaign:write": "Criar/editar campanhas",
  "campaign:assign": "Atribuir campanhas",
  "card:write": "Editar cartões e layout do mapa",
  "feedback:resolve": "Resolver feedbacks privados",
  "audit:read": "Ver log de auditoria",
  // API Pública v1 (Fase 9) — deliberadamente restrito a OWNER/ADMIN, nunca
  // reaproveitando "settings:write": uma ApiKey/WebhookEndpoint pode ler ou
  // escrever qualquer coisa que seus escopos permitam em toda a empresa —
  // mais sensível que a maioria das configurações, merece sua própria
  // permissão auditável em vez de andar de carona com outra.
  "developers:manage": "Gerenciar chaves de API e webhooks",
  // Smart Campaign Playbooks (Fase 11) — deliberadamente restrito a
  // OWNER/ADMIN, nunca reaproveitando "campaign:assign": aplicar UMA
  // recomendação com um clique é do mesmo tamanho de risco de atribuir uma
  // campanha manualmente (por isso reaproveita "campaign:assign"), mas
  // LIGAR o AutoPilot é decidir que o sistema pode agir sozinho em N
  // recomendações futuras sem confirmação — um limite de segurança maior,
  // que merece sua própria permissão auditável (Autonomy Review).
  "automation:manage": "Configurar o nível de AutoPilot dos Playbooks",
};

/** Todos os papéis, na ordem em que devem aparecer em qualquer visualização
 * (do mais amplo ao mais restrito) — usado pela Permission Matrix em
 * Configurações. */
export const ALL_ROLES: Role[] = ["OWNER", "ADMIN", "MARKETING", "MANAGER", "OPERATOR", "READ_ONLY"];

export const ALL_PERMISSIONS: Permission[] = [
  "settings:write",
  "organization:write",
  "team:write",
  "access-scope:write",
  "campaign:write",
  "campaign:assign",
  "card:write",
  "feedback:resolve",
  "audit:read",
  "developers:manage",
  "automation:manage",
];

/** Roles an OWNER/ADMIN can assign to someone else. Nobody can grant OWNER
 * through the invite/role-change flow — there's exactly one path to that
 * (creating the company), matching the existing onboarding invariant. */
export const ASSIGNABLE_ROLES: Role[] = ["ADMIN", "MARKETING", "MANAGER", "OPERATOR", "READ_ONLY"];
