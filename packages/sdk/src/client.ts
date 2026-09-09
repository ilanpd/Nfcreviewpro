import { NFCOSApiError, type NFCOSErrorBody } from "./types";

export interface NFCOSOptions {
  /** Chave de API completa (`nfc_live_...`). Crie/gerencie em
   * `/dashboard/developers`. */
  apiKey: string;
  /** URL base da API — padrão `/api/v1` (útil só quando o SDK roda no
   * mesmo domínio do produto, ex.: o Playground de `/developers`). Uso
   * real de servidor-a-servidor deve sempre passar a URL absoluta do seu
   * ambiente (ex.: `https://sua-empresa.nfcos.app/api/v1`). */
  baseUrl?: string;
  /** Timeout por requisição, em ms. Padrão 15000. */
  timeoutMs?: number;
}

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

function buildQuery(params?: object): string {
  if (!params) return "";
  const entries = Object.entries(params as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return "";
  const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]));
  return `?${search.toString()}`;
}

/**
 * Cliente HTTP interno do SDK — cada Resource (`resources/*.ts`) chama
 * `client.request(...)`, nunca `fetch` diretamente. Um único lugar decide
 * autenticação, `Idempotency-Key`, timeout e como um erro do envelope
 * `{ error: {...} }` vira uma `NFCOSApiError` de verdade (com stack trace,
 * `instanceof` funcionando, `.code`/`.requestId` tipados) em vez de um
 * objeto solto que o chamador precisa desestruturar manualmente.
 */
export class NFCOSClient {
  constructor(private readonly options: NFCOSOptions) {
    if (!options.apiKey) throw new Error("NFCOS: `apiKey` é obrigatório.");
  }

  private get baseUrl(): string {
    return (this.options.baseUrl ?? "/api/v1").replace(/\/$/, "");
  }

  async request<T>(
    method: HttpMethod,
    path: string,
    options: { query?: object; body?: unknown; idempotencyKey?: string } = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}${buildQuery(options.query)}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.options.apiKey}`,
      "Content-Type": "application/json",
    };
    if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const errorBody: NFCOSErrorBody = json?.error ?? {
        code: "unknown_error",
        message: `A API respondeu ${res.status} sem um corpo de erro reconhecível.`,
        request_id: res.headers.get("x-request-id") ?? "",
      };
      throw new NFCOSApiError(res.status, errorBody);
    }

    return json as T;
  }
}
