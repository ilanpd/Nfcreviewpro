import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND } from "@/lib/brand";
import { contrastRatio } from "@/domain/white-label/color";

/**
 * Guarda das cores da marca Pulse (ADR-077). Lê `globals.css` e confere:
 * (1) contraste AA (4,5:1) de cada par de texto, no claro e no escuro;
 * (2) que as cores em hex de `lib/brand.ts` (usadas em OG, ícone, e-mail)
 * são as mesmas do CSS — as duas listas não podem divergir em silêncio.
 * Cobre texto; contraste de bordas e de componentes gráficos não é medido aqui.
 */

// Sem os comentários: um comentário que cita "--brand: ..." não pode virar token.
const css = fs
  .readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8")
  .replace(/\r\n/g, "\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  if (start < 0) throw new Error(`bloco ${selector} não encontrado em globals.css`);
  const end = css.indexOf("\n}", start);
  const out: Record<string, string> = {};
  for (const match of css.slice(start, end).matchAll(/--([\w-]+):\s*([^;]+);/g)) out[match[1]] = match[2].trim();
  return out;
}

const LIGHT = block(":root");
const DARK = { ...LIGHT, ...block(".dark") };

function resolve(tokens: Record<string, string>, name: string): string {
  let value = tokens[name];
  for (let depth = 0; value?.startsWith("var(--") && depth < 5; depth++) {
    value = tokens[value.slice(6, -1)];
  }
  if (!value || !/^#[0-9A-Fa-f]{6}$/.test(value)) throw new Error(`--${name} não resolve para um hex: ${value}`);
  return value;
}

// [texto, fundo]
const PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["secondary-foreground", "secondary"],
  ["primary-foreground", "primary"],
  ["brand-foreground", "brand"],
  ["accent-foreground", "accent"],
  ["brand-ink", "background"],
  ["brand-ink", "card"],
  ["brand-ink", "muted"],
  ["brand-ink", "brand-subtle"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-accent-foreground", "sidebar-accent"],
];

describe.each([
  ["claro", LIGHT],
  ["escuro", DARK],
])("contraste AA no modo %s", (_mode, tokens) => {
  it.each(PAIRS)("--%s sobre --%s", (fg, bg) => {
    expect(contrastRatio(resolve(tokens, fg), resolve(tokens, bg))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("lib/brand.ts espelha o CSS", () => {
  it("âmbar, grafite e tinta iguais nos dois lugares", () => {
    expect(resolve(LIGHT, "brand").toUpperCase()).toBe(BRAND.colors.amber);
    expect(resolve(DARK, "brand").toUpperCase()).toBe(BRAND.colors.amberOnDark);
    expect(resolve(LIGHT, "foreground").toUpperCase()).toBe(BRAND.colors.ink);
    expect(resolve(LIGHT, "muted-foreground").toUpperCase()).toBe(BRAND.colors.graphite);
  });

  it("o âmbar puro sozinho NÃO serve de texto no claro (é por isso que existe --brand-ink)", () => {
    expect(contrastRatio(BRAND.colors.amber, BRAND.colors.paper)).toBeLessThan(4.5);
    expect(contrastRatio(resolve(LIGHT, "brand-ink"), BRAND.colors.paper)).toBeGreaterThanOrEqual(4.5);
  });
});
