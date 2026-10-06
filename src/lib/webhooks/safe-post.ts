import "server-only";
import dns from "node:dns";
import { request as httpsRequest } from "node:https";
import { checkWebhookUrl, isBlockedIpAddress } from "@/domain/api-v1/webhook-url";

/**
 * Envio de webhook protegido contra SSRF (ver `domain/api-v1/webhook-url.ts`).
 *
 * `checkWebhookUrl` só enxerga o TEXTO da URL; um domínio público pode apontar
 * para `127.0.0.1` ou `169.254.169.254`, e o endereço pode mudar entre o
 * cadastro e o envio (DNS rebinding). Por isso a checagem de IP acontece no
 * momento em que o socket resolve o nome (`lookup`): o endereço validado é o
 * mesmo ao qual a conexão é aberta, sem janela entre "conferir" e "conectar".
 * Redirecionamentos NÃO são seguidos: quem recebe um webhook responde 2xx.
 */
export class WebhookTargetBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookTargetBlockedError";
  }
}

export type ResolvedAddress = { address: string; family: number };
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

const defaultResolver: Resolver = async (hostname) => {
  const found = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  return found.map((a) => ({ address: a.address, family: a.family }));
};

type LookupOptions = { family?: number | string; all?: boolean };
type LookupCallback = (err: NodeJS.ErrnoException | null, address?: string | ResolvedAddress[], family?: number) => void;

/** `lookup` para `https.request`: resolve o nome e RECUSA se algum endereço for interno/privado. */
export function createGuardedLookup(resolve: Resolver = defaultResolver) {
  return function guardedLookup(hostname: string, optionsOrCb: LookupOptions | LookupCallback, maybeCb?: LookupCallback) {
    const options: LookupOptions = typeof optionsOrCb === "function" ? {} : (optionsOrCb ?? {});
    const callback = (typeof optionsOrCb === "function" ? optionsOrCb : maybeCb) as LookupCallback;

    resolve(hostname).then(
      (all) => {
        const wanted = options.family === 4 || options.family === "IPv4" ? 4 : options.family === 6 || options.family === "IPv6" ? 6 : 0;
        const addresses = wanted ? all.filter((a) => a.family === wanted) : all;
        if (addresses.length === 0) {
          const err = Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: "ENOTFOUND" }) as NodeJS.ErrnoException;
          return callback(err);
        }
        // Qualquer endereço interno entre os resolvidos derruba tudo: nunca "escolher o público".
        if (all.some((a) => isBlockedIpAddress(a.address))) {
          return callback(new WebhookTargetBlockedError("O endereço do webhook aponta para uma rede interna ou privada") as NodeJS.ErrnoException);
        }
        if (options.all) return callback(null, addresses);
        callback(null, addresses[0].address, addresses[0].family);
      },
      (err: NodeJS.ErrnoException) => callback(err)
    );
  };
}

/** POST com tempo limite total. Devolve só o status (o corpo da resposta é descartado de propósito). */
export async function postToWebhook(
  rawUrl: string,
  headers: Record<string, string>,
  body: string,
  options: { timeoutMs?: number; lookup?: ReturnType<typeof createGuardedLookup> } = {}
): Promise<{ status: number }> {
  const check = checkWebhookUrl(rawUrl);
  if (!check.ok) throw new WebhookTargetBlockedError(check.reason);
  const timeoutMs = options.timeoutMs ?? 10_000;
  const lookup = options.lookup ?? createGuardedLookup();

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const req = httpsRequest(
      check.url,
      { method: "POST", headers: { ...headers, "Content-Length": String(Buffer.byteLength(body)) }, lookup: lookup as never },
      (res) => {
        res.on("error", (e) => finish(() => reject(e)));
        res.on("end", () => finish(() => resolve({ status: res.statusCode ?? 0 })));
        res.resume(); // descarta o corpo
      }
    );
    const timer = setTimeout(() => req.destroy(new Error(`O webhook não respondeu em ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
    req.on("error", (e) => finish(() => reject(e)));
    req.end(body);
  });
}
