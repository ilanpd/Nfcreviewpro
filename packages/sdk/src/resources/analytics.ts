import type { NFCOSClient } from "../client";
import type { RankingType } from "../types";

export class AnalyticsResource {
  constructor(private readonly client: NFCOSClient) {}

  kpis(params?: { days?: number }): Promise<{ data: Record<string, unknown>[] }> {
    return this.client.request("GET", "/analytics/kpis", { query: params });
  }

  funnel(params?: { days?: number }): Promise<{ data: Record<string, unknown>[] }> {
    return this.client.request("GET", "/analytics/funnel", { query: params });
  }

  rankings(params: { type: RankingType; days?: number; limit?: number }): Promise<{ data: Record<string, unknown>[] }> {
    return this.client.request("GET", "/analytics/rankings", { query: params });
  }
}
