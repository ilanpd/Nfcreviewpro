/**
 * SDK oficial do NFC OS (Fase 9) — tipos compartilhados por todo recurso.
 * Este pacote NUNCA importa nada do app Next.js (`@/...`) — ele fala só o
 * contrato HTTP público de `/api/v1/**`, exatamente o que um desenvolvedor
 * terceiro instalando isto de fora deste monorepo teria. Ver ADR-036.
 */
export interface Page<T> {
  data: T[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface PageParams {
  cursor?: string;
  limit?: number;
}

export interface NFCOSErrorBody {
  code: string;
  message: string;
  request_id: string;
  details?: unknown;
}

export class NFCOSApiError extends Error {
  readonly code: string;
  readonly requestId: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, body: NFCOSErrorBody) {
    super(body.message);
    this.name = "NFCOSApiError";
    this.code = body.code;
    this.requestId = body.request_id;
    this.status = status;
    this.details = body.details;
  }
}

export type CampaignType =
  | "URL_REDIRECT"
  | "GOOGLE_REVIEWS"
  | "INSTAGRAM"
  | "TIKTOK"
  | "DIGITAL_MENU"
  | "LANDING_PAGE"
  | "WHATSAPP"
  | "COUPON"
  | "AI_MENU";

export type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
export type TargetScope = "ORGANIZATION" | "COMPANY" | "BRANCH" | "ZONE" | "CARD";
export type RankingType = "CAMPAIGN" | "ZONE" | "CARD" | "EMPLOYEE" | "HOUR" | "DAY_OF_WEEK";

export interface NFCCard {
  id: string;
  companyId: string;
  uniqueCode: string;
  name: string;
  tags: string[];
  active: boolean;
  branchId: string | null;
  zoneId: string | null;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface Campaign {
  id: string;
  companyId: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  displayStatus?: string;
  priority: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface CampaignAssignment {
  id: string;
  campaignId: string;
  scope: TargetScope;
  organizationId: string | null;
  branchId: string | null;
  zoneId: string | null;
  cardId: string | null;
  createdAt: string;
}

export interface Zone {
  id: string;
  companyId: string;
  name: string;
  branchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  companyId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  companies?: { id: string; name: string; slug: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface PrivateFeedback {
  id: string;
  companyId: string;
  name: string | null;
  phone: string | null;
  message: string;
  resolved: boolean;
  createdAt: string;
}

export interface DomainEvent {
  id: string;
  type: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface WebhookEndpoint {
  id: string;
  companyId: string;
  url: string;
  description: string | null;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WebhookDeliveryStatus = "PENDING" | "SUCCESS" | "FAILED" | "EXHAUSTED";

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventId: string;
  eventType: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  responseCode: number | null;
  errorMessage: string | null;
  lastAttemptAt: string | null;
  createdAt: string;
}
