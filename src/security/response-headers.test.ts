import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import nextConfig from "../../next.config";

/**
 * Cabeçalhos de segurança que o navegador e o CDN obedecem. Se alguém apagar um, o teste falha — e o deploy
 * seguinte não o leva para Produção sem ninguém perceber.
 */
async function headersFor(source: string) {
  const rules = await nextConfig.headers!();
  const rule = rules.find((r) => r.source === source);
  return Object.fromEntries((rule?.headers ?? []).map((h) => [h.key, h.value]));
}

describe("cabeçalhos globais", () => {
  it("HSTS, nosniff, anti-clickjacking, referrer e permissões de navegador", async () => {
    const h = await headersFor("/(.*)");
    expect(h["Strict-Transport-Security"]).toMatch(/max-age=\d{8,}/); // pelo menos 1 ano
    expect(h["Strict-Transport-Security"]).toContain("includeSubDomains");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("camera=()");
  });
});

describe("cache da API", () => {
  it("a API inteira é privada e sem cache, exceto o QR (feito para ser cacheado)", async () => {
    const h = await headersFor("/api/:path((?!qr/).*)");
    expect(h["Cache-Control"]).toBe("private, no-store");
  });

  it("o QR define o próprio Cache-Control público (o do handler prevalece sobre o global)", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/app/api/qr/[code]/route.ts"), "utf8");
    expect(src).toMatch(/"Cache-Control": "public, max-age=\d+, s-maxage=\d+/);
  });
});
