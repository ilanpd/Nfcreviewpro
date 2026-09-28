// Trava de deploy (C15) — roda ANTES de `vercel --prod` e falha se o banco de
// PRODUÇÃO (o `.env.local`) tiver migração pendente.
//
// Por quê: o código publicado assume o schema do commit. O C15 foi ao ar uma
// vez com a migração ainda não aplicada em Produção (bloqueada pela
// plataforma) e o painel inteiro quebrou até um `vercel rollback` — o Prisma
// gera SELECT com toda coluna do schema, então uma coluna nova que o banco
// ainda não tem derruba qualquer query de `Company` sem `select` estreito.
// Migração primeiro, código depois — este script transforma a regra em
// código em vez de memória.
//
// Só LEITURA: `prisma migrate status`, nunca `migrate deploy`. Nunca imprime
// credenciais (só o identificador público do projeto).
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

function parseEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    out[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const prod = parseEnvFile(".env.local");
const staging = parseEnvFile(".env");
const ref = (/postgres\.([a-z0-9]+)/.exec(prod.DIRECT_URL ?? "") ?? [])[1];
const stagingRef = (/postgres\.([a-z0-9]+)/.exec(staging.DIRECT_URL ?? "") ?? [])[1];

if (!ref) {
  console.error("Abortado: o .env.local não tem um DIRECT_URL de Produção reconhecível.");
  process.exit(1);
}
if (ref === stagingRef) {
  console.error("Abortado: o .env.local aponta pro MESMO projeto do Staging — nada a checar como Produção.");
  process.exit(1);
}

console.log(`[predeploy] Checando migrações pendentes em Produção (projeto ${ref})…`);
const result = spawnSync("npx", ["prisma", "migrate", "status"], {
  env: { ...process.env, ...prod },
  shell: true,
  encoding: "utf8",
});
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

if (/have not yet been applied|not yet been applied/i.test(output)) {
  const pending = output
    .split(/\r?\n/)
    .filter((line) => /^\d{14}_/.test(line.trim()))
    .map((line) => `  - ${line.trim()}`)
    .join("\n");
  console.error("\n❌ NÃO FAÇA O DEPLOY: há migração pendente em Produção.\n" + pending);
  console.error("\nAplique as migrações em Produção primeiro (`prisma migrate deploy` ou o SQL do PROXIMAS_TAREFAS.md) e rode este check de novo.");
  process.exit(1);
}
if (result.status !== 0) {
  console.error("Abortado: não consegui confirmar o estado das migrações.\n" + output.slice(-600));
  process.exit(1);
}
console.log("✅ Produção está com todas as migrações aplicadas — deploy liberado.");
