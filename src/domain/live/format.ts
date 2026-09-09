import type { CampaignType, AuditAction } from "@/generated/prisma/client";
import { DESTINATION_META } from "@/domain/campaign/destination";
import { AUDIT_ACTION_LABEL } from "@/domain/audit/labels";
import type { LiveEvent } from "./types";

/**
 * Transforma uma linha crua de `RedirectLog` num evento de feed legível —
 * "Mesa 18 abriu Instagram" é literalmente `campaignType` traduzido por
 * `DESTINATION_META`, nada inventado nem uma segunda fonte de rótulos.
 * `cardId` viaja em cada evento (não só o nome) porque é o que o Table Map
 * usa para saber qual mesa pulsar — ver Live Presence em table-map-view.tsx.
 */
export function formatRedirectEvent(row: {
  id: string;
  cardId: string;
  cardName: string;
  campaignType: CampaignType | null;
  createdAt: Date;
}): LiveEvent {
  const label = row.campaignType ? DESTINATION_META[row.campaignType].label : "avaliação padrão";
  return {
    id: `redirect:${row.id}`,
    kind: "REDIRECT",
    cardId: row.cardId,
    message: `${row.cardName} abriu ${label}`,
    createdAt: row.createdAt.getTime(),
  };
}

export function formatRatingEvent(row: {
  id: string;
  cardId: string;
  cardName: string;
  stars: number;
  redirectedGoogle: boolean;
  createdAt: Date;
}): LiveEvent {
  const stars = "⭐".repeat(row.stars);
  const suffix = row.redirectedGoogle ? " e foi para o Google" : "";
  return {
    id: `rating:${row.id}`,
    kind: "RATING",
    cardId: row.cardId,
    message: `${row.cardName} avaliou com ${stars}${suffix}`,
    createdAt: row.createdAt.getTime(),
  };
}

export function formatFeedbackEvent(row: { id: string; cardId: string; cardName: string; createdAt: Date }): LiveEvent {
  return {
    id: `feedback:${row.id}`,
    kind: "FEEDBACK",
    cardId: row.cardId,
    message: `${row.cardName} deixou um feedback privado`,
    createdAt: row.createdAt.getTime(),
  };
}

/** Eventos de auditoria de atribuição não têm um cartão único necessariamente
 * (uma atribuição pode ser de zona/empresa inteira) — `cardId` fica `null` de
 * propósito; o cliente reage a este tipo de evento re-buscando o status de
 * todo o mapa, não pulsando uma mesa específica. */
export function formatAssignmentAuditEvent(row: { id: string; action: AuditAction; createdAt: Date }): LiveEvent {
  return {
    id: `audit:${row.id}`,
    kind: "ASSIGNMENT_CHANGED",
    cardId: null,
    message: AUDIT_ACTION_LABEL[row.action],
    createdAt: row.createdAt.getTime(),
  };
}
