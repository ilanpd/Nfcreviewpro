import type { NFCOSClient } from "../client";
import { autoPaginate } from "../paginate";
import type { Branch, Organization, Page, PageParams, Zone } from "../types";

export class ZonesResource {
  constructor(private readonly client: NFCOSClient) {}

  list(params?: PageParams): Promise<Page<Zone>> {
    return this.client.request("GET", "/zones", { query: params });
  }
  get(id: string): Promise<Zone> {
    return this.client.request("GET", `/zones/${id}`);
  }
  create(input: { name: string; branchId?: string | null }): Promise<Zone> {
    return this.client.request("POST", "/zones", { body: input });
  }
  update(id: string, input: { name?: string; branchId?: string | null }): Promise<Zone> {
    return this.client.request("PATCH", `/zones/${id}`, { body: input });
  }
  delete(id: string): Promise<{ id: string; deleted: true }> {
    return this.client.request("DELETE", `/zones/${id}`);
  }
  autoPaginate(params?: Omit<PageParams, "cursor">) {
    return autoPaginate((cursor) => this.list({ ...params, cursor }));
  }
}

export class BranchesResource {
  constructor(private readonly client: NFCOSClient) {}

  list(params?: PageParams): Promise<Page<Branch>> {
    return this.client.request("GET", "/branches", { query: params });
  }
  get(id: string): Promise<Branch> {
    return this.client.request("GET", `/branches/${id}`);
  }
  create(input: { name: string }): Promise<Branch> {
    return this.client.request("POST", "/branches", { body: input });
  }
  update(id: string, input: { name: string }): Promise<Branch> {
    return this.client.request("PATCH", `/branches/${id}`, { body: input });
  }
  delete(id: string): Promise<{ id: string; deleted: true }> {
    return this.client.request("DELETE", `/branches/${id}`);
  }
  autoPaginate(params?: Omit<PageParams, "cursor">) {
    return autoPaginate((cursor) => this.list({ ...params, cursor }));
  }
}

/** Recurso singular — uma empresa pertence a no máximo uma Organization
 * (ver ADR-013), nunca uma lista. `get()` devolve `null` quando a empresa
 * dona da chave ainda não pertence a nenhuma. */
export class OrganizationsResource {
  constructor(private readonly client: NFCOSClient) {}

  get(): Promise<Organization | null> {
    return this.client.request("GET", "/organizations");
  }
  create(input: { name: string }): Promise<Organization> {
    return this.client.request("POST", "/organizations", { body: input });
  }
  update(input: { name: string }): Promise<Organization> {
    return this.client.request("PATCH", "/organizations", { body: input });
  }
}
