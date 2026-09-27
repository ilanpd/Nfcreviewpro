import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guarda do contador de toques do portal avulso (ADR-080). O plano encontrou
 * que o contador tendia a mostrar zero porque contava `Visit` — só gravado no
 * fluxo do Retorno/estrelas — em vez de `RedirectLog`, escrito em TODO toque
 * pelo motor de resolução. Falha se alguém reintroduzir a contagem errada.
 */
const source = fs.readFileSync(path.join(process.cwd(), "src/services/meu-cartao.service.ts"), "utf8");

describe("countCardTouchesThisMonth", () => {
  it("conta redirectLog, nunca visit", () => {
    const fn = source.slice(source.indexOf("export async function countCardTouchesThisMonth"));
    expect(fn).toMatch(/prisma\.redirectLog\.count/);
    expect(fn).not.toMatch(/prisma\.visit\.count/);
  });
});

describe("findGuestCard", () => {
  it("um link cuja empresa já é assinante nunca devolve 404 (GRADUATED, não NOT_FOUND)", () => {
    const fn = source.slice(source.indexOf("export async function findGuestCard"), source.indexOf("export async function getCardDestination"));
    expect(fn).toMatch(/GRADUATED/);
    expect(fn).toMatch(/accountType !== "GUEST"/);
  });
});

describe("sendPersonalLinkRecoveryEmail", () => {
  it("nunca revela se o e-mail existe: a função só retorna void, nunca um booleano de \"achou\"", () => {
    const fn = source.slice(source.indexOf("export async function sendPersonalLinkRecoveryEmail"));
    expect(fn).toMatch(/Promise<void>/);
  });
});
