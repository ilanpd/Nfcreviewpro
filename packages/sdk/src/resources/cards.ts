import type { NFCOSClient } from "../client";
import { autoPaginate } from "../paginate";
import type { NFCCard, Page, PageParams } from "../types";

export interface CreateCardInput {
  name: string;
  tags?: string[];
}

export interface UpdateCardInput {
  name?: string;
  tags?: string[];
  active?: boolean;
  branchId?: string | null;
  zoneId?: string | null;
}

export class CardsResource {
  constructor(private readonly client: NFCOSClient) {}

  list(params?: PageParams): Promise<Page<NFCCard>> {
    return this.client.request("GET", "/cards", { query: params });
  }

  get(id: string): Promise<NFCCard> {
    return this.client.request("GET", `/cards/${id}`);
  }

  create(input: CreateCardInput, options?: { idempotencyKey?: string }): Promise<NFCCard> {
    return this.client.request("POST", "/cards", { body: input, idempotencyKey: options?.idempotencyKey });
  }

  update(id: string, input: UpdateCardInput): Promise<NFCCard> {
    return this.client.request("PATCH", `/cards/${id}`, { body: input });
  }

  delete(id: string): Promise<{ id: string; deleted: true }> {
    return this.client.request("DELETE", `/cards/${id}`);
  }

  /** `for await (const card of nfc.cards.autoPaginate()) { ... }` */
  autoPaginate(params?: Omit<PageParams, "cursor">) {
    return autoPaginate((cursor) => this.list({ ...params, cursor }));
  }
}
