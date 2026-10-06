import { isIPv4, isIPv6 } from "node:net";

/**
 * Para onde um webhook de cliente pode apontar (SSRF).
 *
 * O dono da empresa (ou uma chave de API com `developers:manage`) escolhe a URL
 * que o NOSSO servidor vai chamar. Sem regra, ele poderia apontar para
 * `http://169.254.169.254/` (metadados da nuvem), `http://localhost:...` ou
 * qualquer serviço interno, e ler o que respondesse no histórico de entregas.
 * Regra: só `https`, sem usuário/senha na URL, nunca um nome interno nem um
 * endereço de rede privada, de loopback, de link-local ou reservado.
 *
 * Esta função cuida da FORMA da URL (cadastro) e da classificação dos IPs. A
 * resolução de nomes na hora do envio — o que pega um domínio público que
 * aponta para um IP privado — vive em `lib/webhooks/safe-post.ts`, que usa
 * `isBlockedIpAddress` daqui.
 */

type Cidr4 = readonly [string, number];

const BLOCKED_V4: readonly Cidr4[] = [
  ["0.0.0.0", 8], // "esta rede"
  ["10.0.0.0", 8], // privada
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (inclui metadados da nuvem)
  ["172.16.0.0", 12], // privada
  ["192.0.0.0", 24], // IETF
  ["192.0.2.0", 24], // documentação
  ["192.88.99.0", 24], // 6to4 relay (obsoleto)
  ["192.168.0.0", 16], // privada
  ["198.18.0.0", 15], // testes de desempenho
  ["198.51.100.0", 24], // documentação
  ["203.0.113.0", 24], // documentação
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reservado (inclui 255.255.255.255)
];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => acc * 256 + Number(part), 0);
}

function isBlockedIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return BLOCKED_V4.some(([base, bits]) => {
    const size = 2 ** (32 - bits);
    const start = ipv4ToInt(base);
    return n >= start && n < start + size;
  });
}

/** Expande um IPv6 (com `::` e, opcionalmente, IPv4 embutido no fim) para 16 bytes. */
function ipv6ToBytes(ip: string): number[] | null {
  let text = ip.toLowerCase();
  const zone = text.indexOf("%");
  if (zone !== -1) text = text.slice(0, zone);

  // IPv4 embutido no final (ex.: ::ffff:192.168.0.1)
  let tailBytes: number[] = [];
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    if (!isIPv4(tail)) return null;
    tailBytes = tail.split(".").map(Number);
    text = text.slice(0, lastColon + 1) + "0:0"; // reserva dois grupos (4 bytes)
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parse = (s: string) => (s === "" ? [] : s.split(":"));
  const head = parse(halves[0]);
  const rest = halves.length === 2 ? parse(halves[1]) : [];
  const missing = 8 - head.length - rest.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;

  const groups = halves.length === 2 ? [...head, ...Array<string>(missing).fill("0"), ...rest] : head;
  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const v = parseInt(g, 16);
    bytes.push(v >> 8, v & 0xff);
  }
  if (tailBytes.length === 4) bytes.splice(12, 4, ...tailBytes);
  return bytes;
}

function isBlockedIPv6(ip: string): boolean {
  const b = ipv6ToBytes(ip);
  if (!b) return true; // não deu para entender: tratar como bloqueado

  const allZeroUntil = (end: number) => b.slice(0, end).every((x) => x === 0);

  if (allZeroUntil(15) && (b[15] === 0 || b[15] === 1)) return true; // :: e ::1
  // ::a.b.c.d (IPv4-compatível, obsoleto) e ::ffff:a.b.c.d (IPv4-mapeado): vale a regra do IPv4
  if (allZeroUntil(10) && b[10] === 0xff && b[11] === 0xff) return isBlockedIPv4(b.slice(12).join("."));
  if (allZeroUntil(12)) return true;
  // 64:ff9b::/96 (NAT64): vale a regra do IPv4 embutido
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && b.slice(4, 12).every((x) => x === 0)) return isBlockedIPv4(b.slice(12).join("."));
  // 2002::/16 (6to4): o IPv4 vem nos bytes 2..5
  if (b[0] === 0x20 && b[1] === 0x02) return isBlockedIPv4(b.slice(2, 6).join("."));
  if ((b[0] & 0xfe) === 0xfc) return true; // fc00::/7 (única local)
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true; // fe80::/10 (link-local)
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0xc0) return true; // fec0::/10 (site-local, obsoleto)
  if (b[0] === 0xff) return true; // multicast
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return true; // documentação
  if (b[0] === 0x01 && b[1] === 0x00 && b.slice(2, 8).every((x) => x === 0)) return true; // 100::/64 (descarte)
  return false;
}

/** O endereço IP (texto, v4 ou v6) pertence a uma faixa que um webhook nunca pode alcançar? */
export function isBlockedIpAddress(ip: string): boolean {
  const clean = ip.startsWith("[") && ip.endsWith("]") ? ip.slice(1, -1) : ip;
  if (isIPv4(clean)) return isBlockedIPv4(clean);
  if (isIPv6(clean)) return isBlockedIPv6(clean);
  return true; // não é um IP reconhecível
}

const INTERNAL_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".corp", ".intranet", ".private"];

export type WebhookUrlCheck = { ok: true; url: URL; hostname: string } | { ok: false; reason: string };

/**
 * Confere a forma da URL. Não resolve DNS (isso é feito na hora do envio).
 * `URL` já normaliza `http://2130706433/` e `http://0x7f.1/` para `127.0.0.1`,
 * então as formas numéricas "disfarçadas" caem na checagem de IP abaixo.
 */
export function checkWebhookUrl(raw: string): WebhookUrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Informe um endereço válido, começando com https://" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "O endereço do webhook precisa começar com https://" };
  if (url.username || url.password) return { ok: false, reason: "O endereço do webhook não pode ter usuário ou senha na URL" };

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const literal = hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;

  if (isIPv4(literal) || isIPv6(literal)) {
    if (isBlockedIpAddress(literal)) return { ok: false, reason: "Não é permitido apontar o webhook para um endereço interno ou privado" };
    return { ok: true, url, hostname: literal };
  }

  if (hostname === "localhost" || INTERNAL_SUFFIXES.some((s) => hostname.endsWith(s)) || !hostname.includes(".")) {
    return { ok: false, reason: "Não é permitido apontar o webhook para um nome interno (localhost, .local, .internal…)" };
  }
  return { ok: true, url, hostname };
}
