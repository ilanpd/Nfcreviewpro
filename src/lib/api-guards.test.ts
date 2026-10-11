import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./redis", () => ({ redis: null })); // limitador em memória (a mesma lógica de decisão)

import { runApiGuards } from "./api-guards";

const HOST = "pulsesmartlink.vercel.app";
let seq = 0;
const freshIp = () => `203.0.113.${(seq++ % 250) + 1}`;

function req(path: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(`https://${HOST}${path}`, {
    method: init.method ?? "GET",
    headers: { host: HOST, ...init.headers },
  });
}

const anonymous = async () => null;
const asUser = (id: string) => async () => id;

beforeEach(() => {
  vi.stubEnv("VERCEL", "1"); // na Vercel a borda sobrescreve os cabeçalhos de IP: são confiáveis
});
afterEach(() => vi.unstubAllEnvs());

describe("tamanho do corpo (413)", () => {
  it("recusa um POST que declara mais de 1 MB, sem nem olhar o corpo", async () => {
    const res = await runApiGuards(req("/api/contact", { method: "POST", headers: { "content-length": "5000000", "x-vercel-forwarded-for": freshIp() } }), anonymous);
    expect(res?.status).toBe(413);
  });

  it("deixa passar um POST pequeno", async () => {
    const res = await runApiGuards(req("/api/contact", { method: "POST", headers: { "content-length": "420", "x-vercel-forwarded-for": freshIp() } }), anonymous);
    expect(res).toBeNull();
  });

  it("o upload da arte da placa tem o teto maior, mas ainda tem teto", async () => {
    const ip = freshIp();
    expect(await runApiGuards(req("/api/admin/plates/models/m1/versions", { method: "POST", headers: { "content-length": "3000000", "x-vercel-forwarded-for": ip } }), asUser("admin"))).toBeNull();
    expect((await runApiGuards(req("/api/admin/plates/models/m1/versions", { method: "POST", headers: { "content-length": "9000000", "x-vercel-forwarded-for": ip } }), asUser("admin")))?.status).toBe(413);
  });
});

describe("requisição de outro site (403, CSRF)", () => {
  it("bloqueia um POST cujo Origin é de outro site", async () => {
    const res = await runApiGuards(req("/api/cards", { method: "POST", headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site", "x-vercel-forwarded-for": freshIp() } }), asUser("u"));
    expect(res?.status).toBe(403);
    expect((await res!.json()).error).toMatch(/Origem/);
  });

  it("deixa passar o POST do próprio site", async () => {
    const res = await runApiGuards(req("/api/cards", { method: "POST", headers: { origin: `https://${HOST}`, "sec-fetch-site": "same-origin", "x-vercel-forwarded-for": freshIp() } }), asUser("u2"));
    expect(res).toBeNull();
  });

  it("não bloqueia GET vindo de outro site (leitura não altera nada)", async () => {
    const res = await runApiGuards(req("/api/demo/kpis", { headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site", "x-vercel-forwarded-for": freshIp() } }), anonymous);
    expect(res).toBeNull();
  });

  it("não barra o que não é navegador (sem Origin e sem Sec-Fetch-Site)", async () => {
    expect(await runApiGuards(req("/api/contact", { method: "POST", headers: { "x-vercel-forwarded-for": freshIp() } }), anonymous)).toBeNull();
  });
});

describe("limite de taxa (429)", () => {
  it("rota pública cara da demonstração: 60 por minuto por IP; o 61º é recusado COM os cabeçalhos", async () => {
    const ip = freshIp();
    const hit = () => runApiGuards(req("/api/demo/heatmap", { headers: { "x-vercel-forwarded-for": ip } }), anonymous);
    for (let i = 0; i < 60; i++) expect(await hit(), `chamada ${i + 1}`).toBeNull();
    const blocked = await hit();
    expect(blocked?.status).toBe(429);
    expect(Number(blocked!.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    expect(blocked!.headers.get("RateLimit-Limit")).toBe("60");
    expect(blocked!.headers.get("RateLimit-Remaining")).toBe("0");
    expect((await blocked!.json()).error).toMatch(/Muitas requisições/);
  });

  it("outro IP não é afetado pelo bloqueio do primeiro", async () => {
    const ipA = freshIp();
    const ipB = freshIp();
    for (let i = 0; i < 61; i++) await runApiGuards(req("/api/demo/heatmap", { headers: { "x-vercel-forwarded-for": ipA } }), anonymous);
    expect((await runApiGuards(req("/api/demo/heatmap", { headers: { "x-vercel-forwarded-for": ipA } }), anonymous))?.status).toBe(429);
    expect(await runApiGuards(req("/api/demo/heatmap", { headers: { "x-vercel-forwarded-for": ipB } }), anonymous)).toBeNull();
  });

  it("forjar o x-forwarded-for NÃO dá cota nova: o IP que vale é o da borda", async () => {
    const ip = freshIp();
    for (let i = 0; i < 61; i++) {
      await runApiGuards(req("/api/demo/heatmap", { headers: { "x-vercel-forwarded-for": ip, "x-forwarded-for": `9.9.9.${i % 250}, ${ip}` } }), anonymous);
    }
    const res = await runApiGuards(req("/api/demo/heatmap", { headers: { "x-vercel-forwarded-for": ip, "x-forwarded-for": "8.8.8.8" } }), anonymous);
    expect(res?.status).toBe(429);
  });

  it("imagem gerada na hora (QR): 120 por minuto por IP", async () => {
    const ip = freshIp();
    for (let i = 0; i < 120; i++) expect(await runApiGuards(req("/api/qr/abc12345", { headers: { "x-vercel-forwarded-for": ip } }), anonymous)).toBeNull();
    expect((await runApiGuards(req("/api/qr/abc12345", { headers: { "x-vercel-forwarded-for": ip } }), anonymous))?.status).toBe(429);
  });

  it("link pessoal (token no caminho): 30 por minuto, em GET e PATCH", async () => {
    const ip = freshIp();
    for (let i = 0; i < 15; i++) await runApiGuards(req("/api/meu-cartao/tok1", { headers: { "x-vercel-forwarded-for": ip } }), anonymous);
    for (let i = 0; i < 15; i++) await runApiGuards(req("/api/meu-cartao/tok2", { method: "PATCH", headers: { origin: `https://${HOST}`, "x-vercel-forwarded-for": ip } }), anonymous);
    expect((await runApiGuards(req("/api/meu-cartao/tok3", { headers: { "x-vercel-forwarded-for": ip } }), anonymous))?.status).toBe(429);
  });

  it("exportação pesada: 6 por minuto por usuário (antes, nenhum teto)", async () => {
    const user = `u-export-${seq++}`;
    const hit = () => runApiGuards(req("/api/analytics/export?format=xlsx", { headers: { "x-vercel-forwarded-for": freshIp() } }), asUser(user));
    for (let i = 0; i < 6; i++) expect(await hit(), `chamada ${i + 1}`).toBeNull();
    expect((await hit())?.status).toBe(429);
  });

  it("leitura comum da API: 300 por minuto por usuário (antes, GET não tinha teto)", async () => {
    const user = `u-read-${seq++}`;
    const hit = () => runApiGuards(req("/api/analytics/kpis", { headers: { "x-vercel-forwarded-for": freshIp() } }), asUser(user));
    for (let i = 0; i < 300; i++) expect(await hit()).toBeNull();
    expect((await hit())?.status).toBe(429);
  });

  it("mutação autenticada: 120 por minuto por usuário", async () => {
    const user = `u-mut-${seq++}`;
    const ip = freshIp();
    const hit = () => runApiGuards(req("/api/cards", { method: "POST", headers: { origin: `https://${HOST}`, "x-vercel-forwarded-for": ip } }), asUser(user));
    for (let i = 0; i < 120; i++) expect(await hit()).toBeNull();
    expect((await hit())?.status).toBe(429);
  });

  it("muitas CONTAS do mesmo IP: cada uma dentro do seu limite, mas o IP tem teto (600/min)", async () => {
    const ip = freshIp();
    let blockedAt = -1;
    for (let i = 0; i < 700; i++) {
      // uma conta diferente a cada requisição: nunca estoura o limite por usuário
      const res = await runApiGuards(req("/api/cards", { method: "POST", headers: { origin: `https://${HOST}`, "x-vercel-forwarded-for": ip } }), asUser(`conta-${seq}-${i}`));
      if (res?.status === 429) {
        blockedAt = i;
        break;
      }
    }
    expect(blockedAt).toBe(600); // a 601ª requisição do IP é recusada
  });
});

describe("rotas fora das guardas gerais", () => {
  it("webhook do Stripe nunca é limitado (descartar um pagamento legítimo seria pior)", async () => {
    const ip = freshIp();
    for (let i = 0; i < 1000; i++) {
      expect(await runApiGuards(req("/api/stripe/webhook", { method: "POST", headers: { "x-vercel-forwarded-for": ip, "content-length": "300" } }), anonymous)).toBeNull();
    }
  });

  it("agendamentos (cron) e API v1 também seguem sem a guarda geral", async () => {
    const ip = freshIp();
    for (const p of ["/api/queues/process", "/api/playbooks/evaluate", "/api/return/reengagement", "/api/v1/cards"]) {
      for (let i = 0; i < 400; i++) expect(await runApiGuards(req(p, { headers: { "x-vercel-forwarded-for": ip } }), anonymous)).toBeNull();
    }
  });

  it("páginas (não /api) nunca passam por aqui", async () => {
    expect(await runApiGuards(req("/loja", { headers: { "x-vercel-forwarded-for": freshIp() } }), anonymous)).toBeNull();
  });

  it("só pergunta pelo usuário quando a rota tem limite (não chama o Clerk à toa)", async () => {
    const getUserId = vi.fn(async () => null);
    await runApiGuards(req("/loja"), getUserId);
    await runApiGuards(req("/api/stripe/webhook", { method: "POST" }), getUserId);
    expect(getUserId).not.toHaveBeenCalled();
    await runApiGuards(req("/api/cards", { headers: { "x-vercel-forwarded-for": freshIp() } }), getUserId);
    expect(getUserId).toHaveBeenCalledTimes(1);
  });
});
