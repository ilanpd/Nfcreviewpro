import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND, copyright, pageTitle } from "@/lib/brand";

/**
 * Guarda da marca (ADR-077). O nome vem de `lib/brand.ts`. Nenhum código de
 * interface, e-mail, PDF ou metadado pode escrever "NFC OS" ou "NFC Review
 * Pro" de novo. Comentários são ignorados: o histórico das fases continua
 * citando o nome antigo, e isso não aparece para ninguém.
 */

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "generated") walk(relative, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(relative);
    }
  }
  return out;
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const SOURCES = [...walk("src"), ...walk("packages")];
// Nome como aparece para uma pessoa (com espaço). Identificadores como
// `NfcOsClient` ou o domínio `nfcreviewpro.com.br` não são texto de interface.
const OLD_NAMES = /NFC OS|NFC Review( Pro)?/;

describe("marca Pulse (ADR-077)", () => {
  it("nenhum código de interface usa o nome antigo", () => {
    const offenders = SOURCES.filter((file) => OLD_NAMES.test(withoutComments(fs.readFileSync(path.join(ROOT, file), "utf8"))));
    expect(offenders).toEqual([]);
  });

  it("o nome e os textos derivados saem de lib/brand.ts", () => {
    expect(BRAND.name).toBe("Pulse");
    expect(copyright(2026)).toBe("© 2026 Pulse. Todos os direitos reservados.");
    expect(pageTitle("Loja")).toBe("Loja — Pulse");
  });

  it("a frase-âncora não promete o que o produto ainda não faz", () => {
    expect(BRAND.tagline).not.toMatch(/voltar|brinde|retorno|ganhe/i);
  });
});
