import { describe, expect, it } from "vitest";
import { getClientIp, normalizeIp, readIpConfig, UNKNOWN_IP } from "./client-ip";

const h = (obj: Record<string, string>) => ({ get: (name: string) => obj[name.toLowerCase()] ?? null });

describe("normalizeIp", () => {
  it("aceita IPv4 e tira a porta", () => {
    expect(normalizeIp("203.0.113.9")).toBe("203.0.113.9");
    expect(normalizeIp("203.0.113.9:51234")).toBe("203.0.113.9");
    expect(normalizeIp("  203.0.113.9 ")).toBe("203.0.113.9");
  });

  it("recusa o que não é IP", () => {
    for (const bad of ["", "   ", "abc", "300.1.1.1", "1.2.3", "1.2.3.4.5", "<script>", "unknown", "::::"]) {
      expect(normalizeIp(bad), bad).toBeNull();
    }
    expect(normalizeIp(null)).toBeNull();
    expect(normalizeIp(undefined)).toBeNull();
  });

  it("reduz IPv6 ao prefixo /64: trocar o fim do endereço não muda o balde", () => {
    const a = normalizeIp("2001:db8:1:2:aaaa:bbbb:cccc:dddd");
    const b = normalizeIp("2001:db8:1:2:1111:2222:3333:4444");
    const c = normalizeIp("2001:db8:1:3::1");
    expect(a).toBe("2001:0db8:0001:0002::/64");
    expect(b).toBe(a);
    expect(c).not.toBe(a);
  });

  it("entende IPv6 abreviado, com colchetes e porta", () => {
    expect(normalizeIp("2001:db8::1")).toBe("2001:0db8:0000:0000::/64");
    expect(normalizeIp("[2001:db8::1]:443")).toBe("2001:0db8:0000:0000::/64");
    expect(normalizeIp("::1")).toBe("0000:0000:0000:0000::/64");
  });

  it("IPv4 mapeado em IPv6 vira o IPv4", () => {
    expect(normalizeIp("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(normalizeIp("::ffff:cb00:7109")).toBe("203.0.113.9");
  });
});

describe("getClientIp — na Vercel (a borda sobrescreve os cabeçalhos)", () => {
  const cfg = { onVercel: true, trustedProxyHops: 0 };

  it("usa x-vercel-forwarded-for, mesmo que o cliente tente forjar o x-forwarded-for", () => {
    const ip = getClientIp(h({ "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "6.6.6.6, 203.0.113.9" }), cfg);
    expect(ip).toBe("203.0.113.9");
  });

  it("cai para x-real-ip e depois para o primeiro do x-forwarded-for", () => {
    expect(getClientIp(h({ "x-real-ip": "203.0.113.5" }), cfg)).toBe("203.0.113.5");
    expect(getClientIp(h({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }), cfg)).toBe("203.0.113.7");
  });

  it("sem nenhum cabeçalho: unknown", () => {
    expect(getClientIp(h({}), cfg)).toBe(UNKNOWN_IP);
  });
});

describe("getClientIp — fora da Vercel (nada é confiável por padrão)", () => {
  it("sem TRUSTED_PROXY_HOPS ignora TODOS os cabeçalhos (não dá para fugir do limite forjando)", () => {
    const cfg = { onVercel: false, trustedProxyHops: 0 };
    const headers = h({ "x-forwarded-for": "1.1.1.1", "x-real-ip": "2.2.2.2", "x-vercel-forwarded-for": "3.3.3.3" });
    expect(getClientIp(headers, cfg)).toBe(UNKNOWN_IP);
  });

  it("o cabeçalho x-vercel-forwarded-for forjado fora da Vercel não é aceito", () => {
    const cfg = { onVercel: false, trustedProxyHops: 1 };
    const ip = getClientIp(h({ "x-vercel-forwarded-for": "9.9.9.9", "x-forwarded-for": "203.0.113.9" }), cfg);
    expect(ip).toBe("203.0.113.9");
  });

  it("com 1 proxy confiável: vale o ÚLTIMO da lista (o que o seu proxy viu), nunca o primeiro (do cliente)", () => {
    const cfg = { onVercel: false, trustedProxyHops: 1 };
    // o atacante escreveu "6.6.6.6"; o proxy acrescentou o IP real "203.0.113.9"
    expect(getClientIp(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }), cfg)).toBe("203.0.113.9");
    expect(getClientIp(h({ "x-forwarded-for": "6.6.6.6, 7.7.7.7, 8.8.8.8, 203.0.113.9" }), cfg)).toBe("203.0.113.9");
  });

  it("com 2 proxies confiáveis: o penúltimo", () => {
    const cfg = { onVercel: false, trustedProxyHops: 2 };
    expect(getClientIp(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.9, 10.0.0.2" }), cfg)).toBe("203.0.113.9");
  });

  it("lista menor que o número de proxies: pega o primeiro disponível, sem estourar", () => {
    const cfg = { onVercel: false, trustedProxyHops: 3 };
    expect(getClientIp(h({ "x-forwarded-for": "203.0.113.9" }), cfg)).toBe("203.0.113.9");
  });

  it("entrada inválida vira unknown, nunca o texto que o cliente mandou", () => {
    const cfg = { onVercel: false, trustedProxyHops: 1 };
    expect(getClientIp(h({ "x-forwarded-for": "<script>alert(1)</script>" }), cfg)).toBe(UNKNOWN_IP);
  });
});

describe("readIpConfig", () => {
  it("detecta a Vercel pelas variáveis de sistema", () => {
    expect(readIpConfig({ VERCEL: "1" }).onVercel).toBe(true);
    expect(readIpConfig({ VERCEL_ENV: "production" }).onVercel).toBe(true);
    expect(readIpConfig({}).onVercel).toBe(false);
  });

  it("TRUSTED_PROXY_HOPS: só inteiros positivos, com teto", () => {
    expect(readIpConfig({ TRUSTED_PROXY_HOPS: "2" }).trustedProxyHops).toBe(2);
    expect(readIpConfig({ TRUSTED_PROXY_HOPS: "0" }).trustedProxyHops).toBe(0);
    expect(readIpConfig({ TRUSTED_PROXY_HOPS: "-3" }).trustedProxyHops).toBe(0);
    expect(readIpConfig({ TRUSTED_PROXY_HOPS: "abc" }).trustedProxyHops).toBe(0);
    expect(readIpConfig({ TRUSTED_PROXY_HOPS: "99" }).trustedProxyHops).toBe(5);
    expect(readIpConfig({}).trustedProxyHops).toBe(0);
  });
});
