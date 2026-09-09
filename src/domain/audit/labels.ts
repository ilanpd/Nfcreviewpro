import type { AuditAction } from "@/generated/prisma/client";

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  CAMPAIGN_CREATED: "Criou a campanha",
  CAMPAIGN_UPDATED: "Editou a campanha",
  CAMPAIGN_ARCHIVED: "Arquivou a campanha",
  CAMPAIGN_DELETED: "Excluiu a campanha",
  CAMPAIGN_ASSIGNED: "Atribuiu a campanha",
  CAMPAIGN_UNASSIGNED: "Removeu a atribuição",
  TEAM_MEMBER_INVITED: "Convidou um membro",
  TEAM_MEMBER_ROLE_CHANGED: "Alterou o cargo de um membro",
  TEAM_MEMBER_REMOVED: "Removeu um membro",
  ACCESS_SCOPE_GRANTED: "Restringiu o acesso de um membro",
  ACCESS_SCOPE_REVOKED: "Removeu uma restrição de acesso",
  COMPANY_SETTINGS_UPDATED: "Atualizou as configurações da empresa",
  ORGANIZATION_CREATED: "Criou a organização",
  RECOMMENDATION_APPLIED: "Aplicou uma recomendação de Playbook",
  RECOMMENDATION_IGNORED: "Ignorou uma recomendação de Playbook",
  PLAYBOOK_EXECUTION_UNDONE: "Desfez a execução de um Playbook",
  AUTOPILOT_LEVEL_CHANGED: "Alterou o nível de AutoPilot",
};
