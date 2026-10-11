// Roda os testes de isolamento entre empresas contra o banco de STAGING (nunca Producao: o proprio teste recusa).
// Uso: node scripts/test-security-db.mjs
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["vitest", "run", "src/security"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, RUN_DB_SECURITY_TESTS: "1" },
});
process.exit(result.status ?? 1);
