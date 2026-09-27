import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guarda do ADR-076. A URL do cartão é gravada em chip e impressa em QR, então
 * só pode nascer num lugar (`joinCardUrl`, via `cardPublicUrl`), e o QR não
 * pode voltar a ser guardado no banco. Estes testes leem o código-fonte e
 * falham se alguém reintroduzir qualquer um dos dois atalhos.
 */

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "generated") continue;
      walk(relative, out);
    } else if (/\.(tsx?|mjs)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(relative);
    }
  }
  return out;
}

const SOURCES = [...walk("src"), "prisma/seed.ts"];

describe("endereço do cartão tem uma única origem (ADR-076)", () => {
  it("nenhum arquivo monta /r/<código> fora de joinCardUrl", () => {
    const offenders = SOURCES.filter((file) => {
      if (file === "src/domain/card-url/classify.ts") return false;
      return /\/r\/\$\{/.test(fs.readFileSync(path.join(ROOT, file), "utf8"));
    });
    expect(offenders).toEqual([]);
  });

  it("nenhum arquivo grava qrCodeUrl nem gera QR em data URL para guardar", () => {
    const offenders = SOURCES.filter((file) => {
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");
      return /\bqrCodeUrl\b/.test(source) || /generateQrCodeDataUrl/.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it("só lib/card-url lê a variável NEXT_PUBLIC_CARD_BASE_URL do ambiente", () => {
    const allowed = new Set(["src/lib/card-url.ts"]);
    const offenders = SOURCES.filter((file) => {
      if (allowed.has(file)) return false;
      return /process\.env\.NEXT_PUBLIC_CARD_BASE_URL/.test(fs.readFileSync(path.join(ROOT, file), "utf8"));
    });
    expect(offenders).toEqual([]);
  });
});
