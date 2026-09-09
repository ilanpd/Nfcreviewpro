import type { DomainEventType } from "@/domain/events/types";
import type { QueueName } from "@/lib/queues/definitions";

/**
 * Event Bus (Fase 8) — mapa estático de "quem quer saber de quê". Só isso
 * muda quando um novo efeito colateral assíncrono é adicionado a um evento
 * já existente — nenhum produtor precisa saber que uma fila nova passou a
 * escutar o evento que ele já publica. Ver ADR-032.
 */
// Fase 9 — todo evento com um nome público em `domain/api-v1/webhook-events.ts`
// (todos exceto ZonaAtualizada/MesaAtualizada, que ainda não têm um) também
// roteia para "webhooks", para poder alcançar os `WebhookEndpoint`s de um
// desenvolvedor terceiro. Isso NÃO significa que toda empresa recebe uma
// tempestade de webhooks a cada toque: o worker de webhooks só entrega a um
// endpoint que tenha assinado aquele evento explicitamente (`events` do
// `WebhookEndpoint`) — um cliente que nunca assina "card.tapped"/
// "redirect.resolved" nunca paga o custo de volume desses dois, mesmo eles
// passando pela fila. Ver ADR-036.
// Fase 11 — o motor de Playbooks (fila "playbooks") só escuta eventos que
// refletem COMPORTAMENTO REAL DO CLIENTE (um toque, uma avaliação, um
// feedback) — nunca um evento que o próprio motor de execução de playbooks
// produz (CampanhaCriada/CampanhaAtualizada/CampanhaEncerrada). Essa é a
// proteção estrutural contra um loop infinito de automação (aplicar um
// playbook cria/atualiza uma campanha → se isso reavaliasse gatilhos, um
// playbook poderia se auto-alimentar): a causa de reavaliação é sempre um
// evento gerado por um humano de fora do sistema, nunca por uma ação do
// próprio motor. Ver ADR-050 e o Architect Review de RELATORIO_FASE_11.md.
export const EVENT_SUBSCRIPTIONS: Record<DomainEventType, QueueName[]> = {
  NFCTocado: ["analytics", "webhooks"],
  RedirecionamentoResolvido: ["analytics", "webhooks", "playbooks"],
  CampanhaCriada: ["analytics", "webhooks"],
  CampanhaAtualizada: ["analytics", "webhooks"],
  CampanhaEncerrada: ["analytics", "webhooks"],
  FeedbackRecebido: ["webhooks", "whatsapp", "playbooks"],
  AvaliacaoPublicada: ["webhooks", "playbooks"],
  ZonaAtualizada: ["analytics"],
  MesaAtualizada: ["analytics"],
  OrganizacaoAtualizada: ["analytics", "webhooks"],
  // Eventos de saída do próprio motor de playbooks — só alimentam analytics/
  // auditoria, nunca a fila "playbooks" (essa seria a própria definição de
  // um loop).
  RecomendacaoGerada: ["analytics"],
  PlaybookExecutado: ["analytics"],
  PlaybookDesfeito: ["analytics"],
};
