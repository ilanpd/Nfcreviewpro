import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

function call(code: string, query = "") {
  const req = new NextRequest(`http://localhost:3000/api/qr/${code}${query}`);
  return GET(req, { params: Promise.resolve({ code }) });
}

function setEnv(env: { card?: string; require?: string }) {
  vi.stubEnv("NEXT_PUBLIC_CARD_BASE_URL", env.card ?? "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  vi.stubEnv("CARD_URL_REQUIRE_FINAL", env.require ?? "");
}

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/qr/[code]", () => {
  it("devolve um PNG válido, com cache longo e sem tocar em banco", async () => {
    setEnv({ card: "https://pulse.com.br" });
    const res = await call("k7x4qm2a");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("s-maxage=86400");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual(PNG_MAGIC);
  });

  it("devolve SVG quando pedido", async () => {
    setEnv({ card: "https://pulse.com.br" });
    const res = await call("k7x4qm2a", "?format=svg&size=256");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    expect(await res.text()).toContain("<svg");
  });

  it("o QR codifica o endereço do cartão: muda com o domínio, é estável com o mesmo domínio", async () => {
    const svg = async (card: string, code = "k7x4qm2a") => {
      setEnv({ card });
      return (await call(code, "?format=svg")).text();
    };
    const a1 = await svg("https://pulse.com.br");
    expect(await svg("https://pulse.com.br")).toBe(a1);
    expect(await svg("https://outro-dominio.com.br")).not.toBe(a1);
    expect(await svg("https://pulse.com.br", "z9y8x7w6")).not.toBe(a1);
  });

  it("download=1 força o nome do arquivo", async () => {
    setEnv({ card: "https://pulse.com.br" });
    const res = await call("k7x4qm2a", "?download=1");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="qrcode-k7x4qm2a.png"');
  });

  it("recusa código malformado com 404", async () => {
    const res = await call("..%2Fetc", "");
    expect(res.status).toBe(404);
  });

  it.each(["?size=99999", "?size=abc", "?format=gif", "?download=0"])("recusa parâmetros fora do contrato (%s) com 400", async (query) => {
    setEnv({ card: "https://pulse.com.br" });
    const res = await call("k7x4qm2a", query);
    expect(res.status).toBe(400);
  });

  it("com endereço provisório e exigência de definitivo, recusa gerar (503)", async () => {
    setEnv({ card: "https://nfc-os-production.vercel.app", require: "1" });
    const res = await call("k7x4qm2a");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/provisório/);
  });

  it("sem exigência, gera mesmo com endereço provisório (staging)", async () => {
    setEnv({ card: "https://nfc-os-staging.vercel.app" });
    expect((await call("k7x4qm2a")).status).toBe(200);
  });
});
