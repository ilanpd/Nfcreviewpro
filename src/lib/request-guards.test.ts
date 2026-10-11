import { describe, expect, it } from "vitest";
import { API_MAX_BODY_BYTES, bodyLimitFor, exceedsBodyLimit, isCrossSiteMutation, isGuardedApiPath, rateClassFor } from "./request-guards";

describe("isGuardedApiPath", () => {
  it("guarda as rotas /api comuns", () => {
    for (const p of ["/api/cards", "/api/contact", "/api/qr/abc12345", "/api/admin/orders", "/api/demo/kpis"]) expect(isGuardedApiPath(p), p).toBe(true);
  });

  it("deixa de fora o que tem outra autenticação (webhook, API v1, cron)", () => {
    for (const p of ["/api/stripe/webhook", "/api/v1/cards", "/api/v1/webhooks/x", "/api/queues/process", "/api/playbooks/evaluate", "/api/return/reengagement"]) {
      expect(isGuardedApiPath(p), p).toBe(false);
    }
  });

  it("não é guarda de página nem de arquivo estático", () => {
    for (const p of ["/", "/loja", "/_next/static/x.js", "/apix", "/api"]) expect(isGuardedApiPath(p), p).toBe(false);
  });

  it("não deixa uma rota de nome parecido escapar da guarda (a isenção é exata)", () => {
    expect(isGuardedApiPath("/api/queues/processar")).toBe(true);
    expect(isGuardedApiPath("/api/queues/process-x")).toBe(true);
    expect(isGuardedApiPath("/api/queues/process/extra")).toBe(true);
    expect(isGuardedApiPath("/api/stripe/webhooks-fake")).toBe(true);
    expect(isGuardedApiPath("/api/stripe/webhook/extra")).toBe(true);
    expect(isGuardedApiPath("/api/stripe/checkout")).toBe(true);
    expect(isGuardedApiPath("/api/v10/cards")).toBe(true); // só /api/v1/ é isento
  });
});

describe("tamanho do corpo", () => {
  it("padrão de 1 MB e exceção para o upload da arte da placa", () => {
    expect(bodyLimitFor("/api/cards")).toBe(API_MAX_BODY_BYTES);
    expect(bodyLimitFor("/api/admin/plates/models/abc/versions")).toBeGreaterThan(API_MAX_BODY_BYTES);
    expect(bodyLimitFor("/api/admin/plates/models/abc/versions")).toBeLessThanOrEqual(4_500_000);
  });

  it("recusa o que passa do teto e aceita o que cabe", () => {
    expect(exceedsBodyLimit("999999", "/api/cards")).toBe(false);
    expect(exceedsBodyLimit("1000000", "/api/cards")).toBe(false);
    expect(exceedsBodyLimit("1000001", "/api/cards")).toBe(true);
    expect(exceedsBodyLimit("20000000", "/api/contact")).toBe(true);
  });

  it("o upload da arte aceita mais, mas tem teto", () => {
    expect(exceedsBodyLimit("3000000", "/api/admin/plates/models/x/versions")).toBe(false);
    expect(exceedsBodyLimit("5000000", "/api/admin/plates/models/x/versions")).toBe(true);
  });

  it("sem Content-Length (corpo em partes) não dá para saber: passa (a Vercel corta em ~4,5 MB)", () => {
    expect(exceedsBodyLimit(null, "/api/cards")).toBe(false);
  });

  it("Content-Length que não é número é requisição malformada: recusa", () => {
    for (const v of ["abc", "-5", "1e9", "1.5", "", " "]) expect(exceedsBodyLimit(v, "/api/cards"), JSON.stringify(v)).toBe(true);
  });
});

describe("isCrossSiteMutation (CSRF)", () => {
  const base = { method: "POST", origin: null, secFetchSite: null, host: "pulsesmartlink.vercel.app" };

  it("GET e HEAD nunca são bloqueados por esta regra", () => {
    expect(isCrossSiteMutation({ ...base, method: "GET", origin: "https://evil.example", secFetchSite: "cross-site" })).toBe(false);
    expect(isCrossSiteMutation({ ...base, method: "HEAD", origin: "https://evil.example" })).toBe(false);
  });

  it("mesma origem passa (Origin igual ao host, ou Sec-Fetch-Site same-origin)", () => {
    expect(isCrossSiteMutation({ ...base, origin: "https://pulsesmartlink.vercel.app", secFetchSite: "same-origin" })).toBe(false);
    expect(isCrossSiteMutation({ ...base, origin: "https://pulsesmartlink.vercel.app" })).toBe(false);
    expect(isCrossSiteMutation({ ...base, secFetchSite: "same-origin" })).toBe(false);
    expect(isCrossSiteMutation({ ...base, secFetchSite: "none" })).toBe(false);
  });

  it("domínio personalizado de marca (white-label) passa: o host da requisição é o dele", () => {
    expect(isCrossSiteMutation({ method: "POST", origin: "https://cartao.lojadoze.com.br", secFetchSite: "same-origin", host: "cartao.lojadoze.com.br" })).toBe(false);
  });

  it("bloqueia um site alheio (Origin diferente)", () => {
    for (const m of ["POST", "PATCH", "PUT", "DELETE"]) {
      expect(isCrossSiteMutation({ ...base, method: m, origin: "https://evil.example", secFetchSite: "cross-site" }), m).toBe(true);
    }
    expect(isCrossSiteMutation({ ...base, origin: "https://evil.example" })).toBe(true);
  });

  it("bloqueia subdomínio parecido e porta diferente (comparação por host exato)", () => {
    expect(isCrossSiteMutation({ ...base, origin: "https://pulsesmartlink.vercel.app.evil.example" })).toBe(true);
    expect(isCrossSiteMutation({ ...base, origin: "https://evil-pulsesmartlink.vercel.app" })).toBe(true);
    expect(isCrossSiteMutation({ ...base, origin: "https://pulsesmartlink.vercel.app:8443" })).toBe(true);
  });

  it("Origin 'null' (contexto isolado) e Origin ilegível são bloqueados", () => {
    expect(isCrossSiteMutation({ ...base, origin: "null" })).toBe(true);
    expect(isCrossSiteMutation({ ...base, origin: "isto não é uma url" })).toBe(true);
  });

  it("sem Origin: bloqueia se o navegador declara outro site; libera cliente que não é navegador", () => {
    expect(isCrossSiteMutation({ ...base, secFetchSite: "cross-site" })).toBe(true);
    expect(isCrossSiteMutation({ ...base, secFetchSite: "same-site" })).toBe(true);
    expect(isCrossSiteMutation(base)).toBe(false); // curl, servidor, app: não carregam o cookie de ninguém
  });

  it("sem saber o host, não bloqueia por Origin (não dá para comparar), mas ainda respeita Sec-Fetch-Site", () => {
    expect(isCrossSiteMutation({ ...base, host: null, origin: "https://evil.example" })).toBe(false);
    expect(isCrossSiteMutation({ ...base, host: null, origin: null, secFetchSite: "cross-site" })).toBe(true);
  });
});

describe("rateClassFor — a política num lugar só", () => {
  it("mutação comum: authMutation", () => {
    expect(rateClassFor("POST", "/api/cards")).toBe("authMutation");
    expect(rateClassFor("DELETE", "/api/campaigns/abc")).toBe("authMutation");
  });

  it("leitura comum: apiRead (antes, GET não tinha teto algum)", () => {
    expect(rateClassFor("GET", "/api/analytics/kpis")).toBe("apiRead");
    expect(rateClassFor("GET", "/api/cards")).toBe("apiRead");
  });

  it("demonstração pública com consulta ao banco: publicData", () => {
    expect(rateClassFor("GET", "/api/demo/heatmap")).toBe("publicData");
    expect(rateClassFor("GET", "/api/demo/kpis")).toBe("publicData");
  });

  it("imagens geradas na hora: publicImage", () => {
    expect(rateClassFor("GET", "/api/qr/abc12345")).toBe("publicImage");
    expect(rateClassFor("GET", "/api/brand/og")).toBe("publicImage");
    expect(rateClassFor("GET", "/api/brand/icon")).toBe("publicImage");
  });

  it("token no caminho: personalLink, em qualquer método", () => {
    expect(rateClassFor("GET", "/api/meu-cartao/tok123")).toBe("personalLink");
    expect(rateClassFor("PATCH", "/api/meu-cartao/tok123")).toBe("personalLink");
  });

  it("exportações e PDFs: exportHeavy", () => {
    for (const p of ["/api/analytics/export", "/api/company/export", "/api/admin/orders/export", "/api/export/feedback", "/api/admin/plates/batches/b1/export/pdf", "/api/cards/c1/print"]) {
      expect(rateClassFor("GET", p), p).toBe("exportHeavy");
    }
  });

  it("fora das guardas gerais: null", () => {
    expect(rateClassFor("POST", "/api/stripe/webhook")).toBeNull();
    expect(rateClassFor("GET", "/api/v1/cards")).toBeNull();
    expect(rateClassFor("GET", "/api/queues/process")).toBeNull();
    expect(rateClassFor("GET", "/loja")).toBeNull();
  });
});
