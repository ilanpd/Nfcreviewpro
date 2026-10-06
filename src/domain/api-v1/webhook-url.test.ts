import { describe, expect, it } from "vitest";
import { checkWebhookUrl, isBlockedIpAddress } from "./webhook-url";

describe("isBlockedIpAddress — IPv4", () => {
  it.each([
    "127.0.0.1",
    "127.255.255.254",
    "10.0.0.1",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // metadados da nuvem
    "169.254.0.1",
    "100.64.0.1", // CGNAT
    "0.0.0.0",
    "192.0.2.10",
    "198.18.0.1",
    "224.0.0.1", // multicast
    "255.255.255.255",
  ])("bloqueia %s", (ip) => {
    expect(isBlockedIpAddress(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.15.255.255", "172.32.0.1", "11.0.0.1", "100.63.255.255", "100.128.0.1", "193.168.0.1", "52.20.30.40"])(
    "deixa passar o IP público %s",
    (ip) => {
      expect(isBlockedIpAddress(ip)).toBe(false);
    }
  );
});

describe("isBlockedIpAddress — IPv6", () => {
  it.each([
    "::1",
    "::",
    "fe80::1",
    "fe80::abcd:1234",
    "fc00::1",
    "fd12:3456:789a::1",
    "ff02::1",
    "::ffff:127.0.0.1", // IPv4 mapeado em IPv6
    "::ffff:10.0.0.1",
    "::ffff:169.254.169.254",
    "::ffff:7f00:1", // o mesmo 127.0.0.1 em hexadecimal
    "64:ff9b::7f00:1", // NAT64 apontando para 127.0.0.1
    "2002:7f00:1::1", // 6to4 apontando para 127.0.0.1
    "2001:db8::1",
    "[::1]",
  ])("bloqueia %s", (ip) => {
    expect(isBlockedIpAddress(ip)).toBe(true);
  });

  it.each(["2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8", "2a00:1450:4001:81b::200e"])("deixa passar o IP público %s", (ip) => {
    expect(isBlockedIpAddress(ip)).toBe(false);
  });

  it("trata o que não é um IP como bloqueado", () => {
    expect(isBlockedIpAddress("não-é-ip")).toBe(true);
    expect(isBlockedIpAddress("")).toBe(true);
  });
});

describe("checkWebhookUrl", () => {
  it("aceita um https público", () => {
    const r = checkWebhookUrl("https://hooks.exemplo.com.br/pulse");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.hostname).toBe("hooks.exemplo.com.br");
  });

  it("aceita porta diferente e caminho com query", () => {
    expect(checkWebhookUrl("https://api.exemplo.com:8443/x?y=1").ok).toBe(true);
  });

  it("recusa http (só https)", () => {
    const r = checkWebhookUrl("http://hooks.exemplo.com/x");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/https/);
  });

  it.each(["javascript:alert(1)", "file:///etc/passwd", "ftp://exemplo.com/x", "data:text/plain,oi", "não é uma url"])("recusa %s", (raw) => {
    expect(checkWebhookUrl(raw).ok).toBe(false);
  });

  it("recusa usuário e senha na URL", () => {
    expect(checkWebhookUrl("https://admin:segredo@exemplo.com/x").ok).toBe(false);
    expect(checkWebhookUrl("https://admin@exemplo.com/x").ok).toBe(false);
  });

  it.each([
    "https://localhost/x",
    "https://LOCALHOST:3000/x",
    "https://app.localhost/x",
    "https://servidor.local/x",
    "https://db.internal/x",
    "https://intranet/x", // nome sem ponto
    "https://metadata/x",
    "https://roteador.lan/x",
    "https://exemplo.home.arpa/x",
  ])("recusa o nome interno %s", (raw) => {
    expect(checkWebhookUrl(raw).ok).toBe(false);
  });

  it.each([
    "https://127.0.0.1/x",
    "https://10.1.2.3/x",
    "https://192.168.0.10:8443/x",
    "https://169.254.169.254/latest/meta-data/",
    "https://[::1]/x",
    "https://[fe80::1]/x",
    "https://[::ffff:127.0.0.1]/x",
  ])("recusa o IP interno %s", (raw) => {
    expect(checkWebhookUrl(raw).ok).toBe(false);
  });

  it.each([
    "https://2130706433/x", // 127.0.0.1 em decimal
    "https://0x7f000001/x", // 127.0.0.1 em hexadecimal
    "https://0177.0.0.1/x", // 127.0.0.1 em octal
    "https://127.1/x", // forma curta
    "https://0/x", // 0.0.0.0
  ])("recusa a forma numérica disfarçada %s", (raw) => {
    expect(checkWebhookUrl(raw).ok).toBe(false);
  });

  it("aceita IP público literal", () => {
    expect(checkWebhookUrl("https://8.8.8.8/x").ok).toBe(true);
    expect(checkWebhookUrl("https://[2606:4700:4700::1111]/x").ok).toBe(true);
  });

  it("ignora o ponto final do nome (exemplo.com.)", () => {
    const r = checkWebhookUrl("https://hooks.exemplo.com./x");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.hostname).toBe("hooks.exemplo.com");
  });
});
