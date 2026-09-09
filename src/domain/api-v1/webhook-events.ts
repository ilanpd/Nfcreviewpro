import type { DomainEventType } from "@/domain/events/types";

/**
 * API Pública v1 (Fase 9) — traduz os 10 eventos internos do Event Bus
 * (Fase 8, em português) para o contrato PÚBLICO de webhooks (em inglês,
 * dot-case), exatamente os 8 nomes pedidos. Esse desacoplamento é
 * deliberado: renomear ou reestruturar um evento interno nunca deveria
 * quebrar a assinatura de um webhook de um cliente — os dois nomes evoluem
 * de forma independente, e só este arquivo sabe traduzir de um para o
 * outro. Ver ADR-036.
 *
 * `ZonaAtualizada`/`MesaAtualizada` deliberadamente NÃO têm um nome público
 * ainda (`null`) — dois dos 10 eventos internos, de menor valor para um
 * integrador externo hoje, ficam de fora do contrato público desta fase. Um
 * evento com nome público `null` nunca é entregue a nenhum
 * `WebhookEndpoint`, mesmo que ele esteja inscrito em "*" — ver
 * `lib/workers/processors.ts`.
 */
export const PUBLIC_WEBHOOK_EVENT_MAP: Record<DomainEventType, string | null> = {
  NFCTocado: "card.tapped",
  RedirecionamentoResolvido: "redirect.resolved",
  CampanhaCriada: "campaign.created",
  CampanhaAtualizada: "campaign.updated",
  CampanhaEncerrada: "campaign.ended",
  FeedbackRecebido: "feedback.received",
  AvaliacaoPublicada: "review.published",
  ZonaAtualizada: null,
  MesaAtualizada: null,
  OrganizacaoAtualizada: "organization.updated",
  // Smart Campaign Playbooks (Fase 11) — deliberadamente sem nome público
  // ainda, mesmo precedente de ZonaAtualizada/MesaAtualizada: um contrato de
  // webhook para recomendações/execuções de playbook é uma superfície nova
  // o bastante para merecer seu próprio desenho quando houver um pedido real
  // de integração externa, não uma tradução apressada agora.
  RecomendacaoGerada: null,
  PlaybookExecutado: null,
  PlaybookDesfeito: null,
};

export const PUBLIC_WEBHOOK_EVENT_TYPES = Object.values(PUBLIC_WEBHOOK_EVENT_MAP).filter(
  (v): v is string => v !== null
);

export function toPublicWebhookEventType(internalType: DomainEventType): string | null {
  return PUBLIC_WEBHOOK_EVENT_MAP[internalType];
}
