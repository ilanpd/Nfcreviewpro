import type { NFCOSClient } from "../client";
import type { Page, PageParams, WebhookDelivery, WebhookEndpoint } from "../types";

export interface CreateWebhookInput {
  url: string;
  description?: string | null;
  /** Nomes públicos de evento, ex.: "campaign.created", "card.tapped" — ver
   * a lista completa na documentação de `/developers`. */
  events: string[];
}

export type UpdateWebhookInput = Partial<CreateWebhookInput> & { active?: boolean };

export class WebhooksResource {
  constructor(private readonly client: NFCOSClient) {}

  list(): Promise<{ data: WebhookEndpoint[] }> {
    return this.client.request("GET", "/webhooks");
  }
  get(id: string): Promise<WebhookEndpoint> {
    return this.client.request("GET", `/webhooks/${id}`);
  }
  create(input: CreateWebhookInput): Promise<WebhookEndpoint> {
    return this.client.request("POST", "/webhooks", { body: input });
  }
  update(id: string, input: UpdateWebhookInput): Promise<WebhookEndpoint> {
    return this.client.request("PATCH", `/webhooks/${id}`, { body: input });
  }
  delete(id: string): Promise<{ id: string; deleted: true }> {
    return this.client.request("DELETE", `/webhooks/${id}`);
  }

  deliveries = {
    list: (endpointId: string, params?: PageParams): Promise<Page<WebhookDelivery>> =>
      this.client.request("GET", `/webhooks/${endpointId}/deliveries`, { query: params }),

    replay: (endpointId: string, deliveryId: string): Promise<WebhookDelivery> =>
      this.client.request("POST", `/webhooks/${endpointId}/deliveries/${deliveryId}/replay`),
  };
}
