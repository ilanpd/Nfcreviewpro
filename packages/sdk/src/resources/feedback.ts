import type { NFCOSClient } from "../client";
import { autoPaginate } from "../paginate";
import type { Page, PageParams, PrivateFeedback } from "../types";

export class FeedbackResource {
  constructor(private readonly client: NFCOSClient) {}

  list(params?: PageParams & { resolved?: boolean }): Promise<Page<PrivateFeedback>> {
    return this.client.request("GET", "/feedback", { query: params });
  }

  resolve(id: string): Promise<PrivateFeedback> {
    return this.client.request("PATCH", `/feedback/${id}`, { body: { resolved: true } });
  }

  reopen(id: string): Promise<PrivateFeedback> {
    return this.client.request("PATCH", `/feedback/${id}`, { body: { resolved: false } });
  }

  autoPaginate(params?: Omit<PageParams, "cursor"> & { resolved?: boolean }) {
    return autoPaginate((cursor) => this.list({ ...params, cursor }));
  }
}
