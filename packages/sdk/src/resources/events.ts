import type { NFCOSClient } from "../client";
import { autoPaginate } from "../paginate";
import type { DomainEvent, Page, PageParams } from "../types";

export class EventsResource {
  constructor(private readonly client: NFCOSClient) {}

  list(params?: PageParams & { type?: string; since?: string; until?: string }): Promise<Page<DomainEvent>> {
    return this.client.request("GET", "/events", { query: params });
  }

  autoPaginate(params?: Omit<PageParams, "cursor"> & { type?: string; since?: string; until?: string }) {
    return autoPaginate((cursor) => this.list({ ...params, cursor }));
  }
}
