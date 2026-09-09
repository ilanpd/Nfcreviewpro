import type { NFCOSClient } from "../client";
import { autoPaginate } from "../paginate";
import type { Campaign, CampaignAssignment, CampaignStatus, CampaignType, Page, PageParams, TargetScope } from "../types";

export interface CreateCampaignInput {
  name: string;
  description?: string;
  type: CampaignType;
  priority?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  config: Record<string, unknown>;
}

export type UpdateCampaignInput = Partial<CreateCampaignInput> & { status?: CampaignStatus };

export interface AssignCampaignInput {
  scope: TargetScope;
  organizationId?: string | null;
  branchId?: string | null;
  zoneId?: string | null;
  cardId?: string | null;
}

export class CampaignsResource {
  constructor(private readonly client: NFCOSClient) {}

  list(params?: PageParams): Promise<Page<Campaign>> {
    return this.client.request("GET", "/campaigns", { query: params });
  }

  get(id: string): Promise<Campaign> {
    return this.client.request("GET", `/campaigns/${id}`);
  }

  create(input: CreateCampaignInput, options?: { idempotencyKey?: string }): Promise<Campaign> {
    return this.client.request("POST", "/campaigns", { body: input, idempotencyKey: options?.idempotencyKey });
  }

  update(id: string, input: UpdateCampaignInput): Promise<Campaign> {
    return this.client.request("PATCH", `/campaigns/${id}`, { body: input });
  }

  delete(id: string): Promise<{ id: string; deleted: true }> {
    return this.client.request("DELETE", `/campaigns/${id}`);
  }

  /** Açúcar para `update(id, { status: "ACTIVE" })` — a forma mais comum de
   * mudar uma campanha de DRAFT/PAUSED para o ar. */
  activate(id: string): Promise<Campaign> {
    return this.update(id, { status: "ACTIVE" });
  }

  /** Açúcar para `update(id, { status: "PAUSED" })`. */
  pause(id: string): Promise<Campaign> {
    return this.update(id, { status: "PAUSED" });
  }

  autoPaginate(params?: Omit<PageParams, "cursor">) {
    return autoPaginate((cursor) => this.list({ ...params, cursor }));
  }

  assignments = {
    list: (campaignId: string): Promise<{ data: CampaignAssignment[] }> =>
      this.client.request("GET", `/campaigns/${campaignId}/assignments`),

    create: (campaignId: string, input: AssignCampaignInput): Promise<CampaignAssignment> =>
      this.client.request("POST", `/campaigns/${campaignId}/assignments`, { body: input }),

    delete: (campaignId: string, assignmentId: string): Promise<{ id: string; deleted: true }> =>
      this.client.request("DELETE", `/campaigns/${campaignId}/assignments/${assignmentId}`),
  };
}
