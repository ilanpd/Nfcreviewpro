/**
 * IP do visitante, de forma que não dê para forjar para fugir de um limite.
 *
 * O `X-Forwarded-For` que o navegador manda vem de graça do cliente: quem fala
 * direto com o servidor escreve nele o que quiser, e quem passa por um proxy tem
 * o valor DELE no meio de uma lista. Por isso o cabeçalho só vale na proporção da
 * confiança no que está na frente do app:
 *   - Na Vercel, a borda SOBRESCREVE `x-forwarded-for`, `x-real-ip` e
 *     `x-vercel-forwarded-for` com o IP real; esses são confiáveis.
 *   - Fora da Vercel (ex.: hospedagem própria atrás de um proxy), nada é confiável
 *     por padrão. `TRUSTED_PROXY_HOPS=N` diz quantos proxies SEUS ficam na frente;
 *     o IP do cliente é o N-ésimo a contar do FIM da lista (o que o seu proxy
 *     acrescentou), nunca o primeiro (que o cliente escreveu).
 *   - Sem `TRUSTED_PROXY_HOPS`, os cabeçalhos são ignorados (`unknown`): mais
 *     restritivo, mas sem como driblar o limite mandando um cabeçalho falso.
 *
 * IPv6 vira o prefixo /64 (o que uma casa ou empresa recebe de uma vez): sem isso,
 * quem tem um bloco IPv6 trocaria de endereço a cada requisição.
 *
 * Puro e sem `node:*`, para rodar no middleware (runtime Edge).
 */
export interface IpConfig {
  onVercel: boolean;
  trustedProxyHops: number;
}

export function readIpConfig(env: Record<string, string | undefined> = process.env): IpConfig {
  const hops = Number.parseInt(env.TRUSTED_PROXY_HOPS ?? "", 10);
  return {
    onVercel: env.VERCEL === "1" || !!env.VERCEL_ENV || !!env.VERCEL_URL,
    trustedProxyHops: Number.isFinite(hops) && hops > 0 ? Math.min(hops, 5) : 0,
  };
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isIPv4(s: string): boolean {
  const m = IPV4.exec(s);
  return !!m && m.slice(1).every((o) => Number(o) <= 255);
}

function expandIPv6(raw: string): string[] | null {
  let s = raw.toLowerCase();
  const zone = s.indexOf("%");
  if (zone !== -1) s = s.slice(0, zone);
  if (!/^[0-9a-f:.]+$/.test(s) || (s.match(/:/g) ?? []).length < 2) return null;

  // IPv4 embutido no fim (::ffff:1.2.3.4) vira dois grupos hexadecimais
  const lastColon = s.lastIndexOf(":");
  const tail = s.slice(lastColon + 1);
  if (tail.includes(".")) {
    if (!isIPv4(tail)) return null;
    const [a, b, c, d] = tail.split(".").map(Number);
    s = s.slice(0, lastColon + 1) + ((a << 8) | b).toString(16) + ":" + ((c << 8) | d).toString(16);
  }

  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] === "" ? [] : halves[0].split(":");
  const rest = halves.length === 2 ? (halves[1] === "" ? [] : halves[1].split(":")) : [];
  const missing = 8 - head.length - rest.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = halves.length === 2 ? [...head, ...Array<string>(missing).fill("0"), ...rest] : head;
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => g.padStart(4, "0"));
}

/** Um IP em forma canônica (IPv4 puro, ou IPv6 reduzido ao /64), ou `null` se não for um IP. */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;

  // [::1]:8080 ou 1.2.3.4:5678
  const bracket = /^\[([^\]]+)\](?::\d+)?$/.exec(s);
  if (bracket) s = bracket[1];
  else if (/^[^:]+:\d+$/.test(s)) s = s.slice(0, s.lastIndexOf(":"));

  if (isIPv4(s)) return s;
  const groups = expandIPv6(s);
  if (!groups) return null;
  // IPv4 mapeado (::ffff:a.b.c.d): vale o IPv4
  if (groups.slice(0, 5).every((g) => g === "0000") && groups[5] === "ffff") {
    const hi = parseInt(groups[6], 16);
    const lo = parseInt(groups[7], 16);
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return `${groups.slice(0, 4).join(":")}::/64`;
}

interface HeaderReader {
  get(name: string): string | null;
}

export const UNKNOWN_IP = "unknown";

export function getClientIp(headers: HeaderReader, config: IpConfig = readIpConfig()): string {
  const xff = headers.get("x-forwarded-for");
  const list = xff ? xff.split(",").map((p) => p.trim()).filter(Boolean) : [];

  if (config.onVercel) {
    return normalizeIp(headers.get("x-vercel-forwarded-for")?.split(",")[0]) ?? normalizeIp(headers.get("x-real-ip")) ?? normalizeIp(list[0]) ?? UNKNOWN_IP;
  }

  if (config.trustedProxyHops > 0) {
    const fromList = list.length > 0 ? list[Math.max(0, list.length - config.trustedProxyHops)] : null;
    return normalizeIp(fromList) ?? normalizeIp(headers.get("x-real-ip")) ?? UNKNOWN_IP;
  }

  return UNKNOWN_IP;
}
