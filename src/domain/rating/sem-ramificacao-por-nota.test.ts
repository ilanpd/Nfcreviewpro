import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guarda de compliance (ADR-075). A política do Google proíbe mostrar caminhos
 * diferentes conforme o sentimento do cliente. Estes testes leem o código do
 * fluxo público e falham se alguém reintroduzir uma ramificação por nota, ou
 * se o site voltar a prometer que "filtra" avaliações. Não substituem revisão
 * humana; impedem o retrocesso mais provável.
 */

const ROOT = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(relative, out);
    else if (/\.(tsx?|md)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(relative);
  }
  return out;
}

const FLUXO_PUBLICO = [
  "src/services/rating.service.ts",
  "src/domain/rating/public-result.ts",
  "src/app/r/[code]/rating-flow.tsx",
  "src/app/feedback/page.tsx",
  "src/app/feedback/feedback-form.tsx",
  "src/app/thank-you/page.tsx",
];

describe("fluxo público sem ramificação por nota (ADR-075)", () => {
  it.each(FLUXO_PUBLICO)("%s não compara a nota nem usa limiar", (file) => {
    const source = read(file);
    expect(source).not.toContain("GOOGLE_REDIRECT_THRESHOLD");
    // Qualquer comparação relacional com a nota (contra número OU constante) e
    // igualdade contra um número literal. `=== null` (estado do React) é permitido.
    expect(source).not.toMatch(/\b(stars|selectedStars)\s*(>=|<=|>|<)\s*[\w.]+/);
    expect(source).not.toMatch(/\b(stars|selectedStars)\s*(===|!==)\s*\d/);
    expect(source).not.toMatch(/outcome\s*[:=]+\s*["'](google|feedback)["']/);
  });

  it("a tela pós-nota mostra os dois caminhos e não lê a nota", () => {
    const source = read("src/app/r/[code]/rating-flow.tsx");
    const choose = source.slice(source.indexOf('key="choose"'));
    expect(choose).toContain("Avaliar no Google");
    expect(choose).toContain("Falar com a gente");
    expect(choose).not.toContain("selectedStars");
  });
});

describe("site sem promessa de filtro (ADR-075)", () => {
  const PROIBIDAS: [string, RegExp][] = [
    ["promete que notas baixas não chegam ao Google", /nunca chegam ao Google/i],
    ["ligado a nota baixa por faixa de estrelas", /\b1 a 3 estrelas\b/i],
    ["afirma que filtra avaliações", /filtr(a|amos|ar|o de)\s+(as\s+)?avalia/i],
    ["só as boas avaliações", /só as (boas|positivas)/i],
    ["avaliação incentivada", /avalie e ganhe/i],
  ];
  const arquivos = [...walk("src/components/marketing"), ...walk("src/app/loja"), "src/app/page.tsx", "src/app/layout.tsx"];

  it.each(PROIBIDAS)("nenhum texto público %s", (_nome, regex) => {
    for (const file of arquivos) {
      expect(read(file), file).not.toMatch(regex);
    }
  });
});
