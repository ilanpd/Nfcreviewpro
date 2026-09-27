import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guardas de segurança do Retorno (ADR-079), lidas do código-fonte: falham se
 * alguém remover o limite de taxa de uma rota pública, deixar o hash do PIN
 * sair numa resposta ou colocar o código do brinde ou o PIN num evento ou na
 * auditoria. Não substituem revisão; impedem o retrocesso mais provável.
 */

const ROOT = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), "utf8");

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) routeFiles(relative, out);
    else if (entry.name === "route.ts" && !relative.endsWith(".test.ts")) out.push(relative);
  }
  return out;
}

describe("rotas públicas do brinde", () => {
  const publicRoutes = routeFiles("src/app/api/vouchers");

  it("existem as duas rotas públicas (consulta e resgate)", () => {
    expect(publicRoutes.sort()).toEqual(["src/app/api/vouchers/lookup/route.ts", "src/app/api/vouchers/redeem/route.ts"]);
  });

  it.each(publicRoutes)("%s limita a taxa por IP e nunca exige sessão", (file) => {
    const source = read(file);
    expect(source).toMatch(/rateLimit\("voucher(Lookup|Redeem)", ip\)/);
    expect(source).not.toMatch(/requireAuthContext|getAuthContext/);
  });
});

describe("hash do PIN", () => {
  const exposed = [...routeFiles("src/app/api/return"), ...routeFiles("src/app/api/vouchers"), "src/app/api/visits/route.ts"];

  it.each(exposed)("%s nunca lê nem devolve pinHash", (file) => {
    expect(read(file)).not.toMatch(/pinHash/);
  });

  it("a tela de configuração recebe só se existe PIN (hasPin)", () => {
    const service = read("src/services/return-offer.service.ts");
    const view = service.slice(service.indexOf("export interface OfferSettingsView"), service.indexOf("function requireWriteAccess"));
    expect(view).toMatch(/hasPin/);
    expect(view).not.toMatch(/pinHash:/);
  });
});

describe("o que nunca vai para eventos e auditoria", () => {
  it("os eventos do brinde não carregam o código", () => {
    const events = read("src/domain/events/types.ts");
    const block = events.slice(events.indexOf("BrindeEmitido: {"));
    expect(block).not.toMatch(/\bcode\b/);
  });

  it("a auditoria não recebe o PIN nem o código", () => {
    const service = read("src/services/return-offer.service.ts");
    for (const call of service.match(/recordAudit\([\s\S]*?\);/g) ?? []) {
      expect(call).not.toMatch(/\bpin\b|\bcode\b/);
    }
  });
});

describe("resgate", () => {
  it("é um UPDATE condicionado ao estado, não um ler-e-gravar", () => {
    const store = read("src/lib/return-offer/store.ts");
    const fn = store.slice(store.indexOf("export async function redeemVoucherAtomically"));
    expect(fn).toMatch(/updateMany/);
    expect(fn).toMatch(/status: "ISSUED"/);
    expect(fn).toMatch(/availableAt: \{ lte: now \}/);
    expect(fn).toMatch(/expiresAt: \{ gt: now \}/);
  });
});
