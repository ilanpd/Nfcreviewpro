/**
 * Preparo comum dos testes de segurança que usam um banco REAL. Só rodam com `RUN_DB_SECURITY_TESTS=1`
 * (`node scripts/test-security-db.mjs`) e SEMPRE no banco de STAGING: qualquer outro destino aborta antes de
 * conectar. O `.env.local` (que aponta para Produção) nunca é lido aqui.
 */
import { existsSync, readFileSync } from "node:fs";

export const DB_TESTS_ENABLED = process.env.RUN_DB_SECURITY_TESTS === "1";
export const STAGING_REF = "xcrniyhjiscldevjzgpt";

function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

/** Carrega o `.env` (Staging) e recusa qualquer banco que não seja o de Staging. */
export function assertStagingDatabase() {
  loadEnvFile(".env");
  if (!(process.env.DATABASE_URL ?? "").includes(STAGING_REF)) throw new Error("Abortado: DATABASE_URL não é o banco de STAGING.");
}

/** Identificador único desta rodada: prefixo do slug das empresas de teste, usado também na limpeza. */
export function newRunId() {
  return `sec${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}
