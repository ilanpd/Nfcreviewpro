/**
 * Event Bus (Fase 8) — os 10 contratos de evento de domínio pedidos,
 * tipados de ponta a ponta. Nomes em português, exatamente como pedido, e
 * armazenados como `string` em `EventLog.type` (não um enum do Postgres —
 * ver o comentário do modelo em schema.prisma) para que um novo tipo de
 * evento nunca precise de migração de schema.
 *
 * Cada evento carrega `version` — o contrato pode evoluir (novos campos)
 * sem quebrar um consumidor ou um replay antigo, que podem checar a versão
 * e decidir como lidar com um payload de formato anterior. Nenhum produtor
 * conhece OU importa de um consumidor — só publica um evento tipado; ver
 * `lib/event-bus/publish.ts`. Isso é o que "preparar para Kafka no futuro
 * sem reescrever produtores" significa na prática: trocar o transporte por
 * baixo de `publishEvent` (BullMQ hoje, tópicos Kafka amanhã) nunca exige
 * tocar em quem chama `publishEvent`. Ver ADR-032.
 */

export type DomainEventType =
  | "NFCTocado"
  | "RedirecionamentoResolvido"
  | "CampanhaCriada"
  | "CampanhaAtualizada"
  | "CampanhaEncerrada"
  | "FeedbackRecebido"
  | "AvaliacaoPublicada"
  | "ZonaAtualizada"
  | "MesaAtualizada"
  | "OrganizacaoAtualizada"
  // --- Smart Campaign Playbooks (Fase 11) ---
  | "RecomendacaoGerada"
  | "PlaybookExecutado"
  | "PlaybookDesfeito";

export interface DomainEventPayloads {
  NFCTocado: { cardId: string; uniqueCode: string };
  RedirecionamentoResolvido: {
    cardId: string;
    campaignId: string | null;
    variantId: string | null;
    outcome: "CAMPAIGN" | "REVIEW_FLOW_FALLBACK";
    resolvedFromCache: boolean;
  };
  CampanhaCriada: { campaignId: string; name: string; type: string };
  CampanhaAtualizada: { campaignId: string; changedFields: string[] };
  CampanhaEncerrada: { campaignId: string; reason: "ARCHIVED" | "DELETED" };
  FeedbackRecebido: { feedbackId: string; ratingEventId: string; cardId: string; stars: number };
  AvaliacaoPublicada: { ratingEventId: string; cardId: string; stars: number };
  ZonaAtualizada: { zoneId: string; action: "CREATED" | "UPDATED" | "DELETED" };
  MesaAtualizada: { cardId: string; action: "CREATED" | "UPDATED" | "DELETED" };
  OrganizacaoAtualizada: { organizationId: string; action: "CREATED" | "UPDATED" };
  // --- Smart Campaign Playbooks (Fase 11) ---
  RecomendacaoGerada: { recommendationId: string; playbookKey: string; confidence: number };
  PlaybookExecutado: { executionId: string; recommendationId: string; playbookKey: string; triggeredBy: "USER" | "AUTOPILOT" };
  PlaybookDesfeito: { executionId: string; recommendationId: string; playbookKey: string };
}

/** O envelope que todo evento publicado carrega, além do payload
 * específico do seu tipo — o que `EventLog` de fato persiste. */
export interface DomainEvent<T extends DomainEventType = DomainEventType> {
  id: string;
  type: T;
  version: number;
  companyId: string | null;
  organizationId: string | null;
  correlationId: string;
  payload: DomainEventPayloads[T];
  occurredAt: Date;
}

/** Contexto mínimo que todo publicador precisa fornecer — nunca o evento
 * inteiro montado à mão, para `publishEvent` ser o único lugar que decide
 * o formato do envelope. */
export interface PublishContext {
  companyId?: string | null;
  organizationId?: string | null;
  correlationId?: string;
}
