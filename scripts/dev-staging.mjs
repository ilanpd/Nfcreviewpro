// Sobe o Next.js em desenvolvimento apontando SEMPRE para o banco de STAGING
// (o `.env`), ignorando o `.env.local`, que aponta para PRODUÇÃO.
//
// Por quê: o Next.js carrega o `.env.local` por cima do `.env`, então um
// `npm run dev` comum grava no banco de produção. Variáveis já definidas no
// processo têm prioridade sobre os arquivos, então este script as define a
// partir do `.env` antes de iniciar o servidor. Nunca imprime credenciais,
// só o identificador público do projeto do Supabase.
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";

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

// O usuário do pooler do Supabase é "postgres.<ref do projeto>" — público, não é segredo.
function projectRef(url) {
  const match = /^[a-z]+:\/\/([^:@]+)/.exec(url ?? "");
  return match ? match[1] : null;
}

const staging = parseEnvFile(".env");
const local = parseEnvFile(".env.local");

if (!staging.DATABASE_URL || !staging.DIRECT_URL) {
  console.error("Abortado: o .env não tem DATABASE_URL e DIRECT_URL do staging.");
  process.exit(1);
}

const stagingRef = projectRef(staging.DATABASE_URL);
const localRef = projectRef(local.DATABASE_URL);
if (stagingRef && localRef && stagingRef === localRef && process.env.ALLOW_SAME_DB !== "1") {
  console.error(
    "Abortado: o .env e o .env.local apontam para o mesmo banco. Confirme qual é o staging antes de continuar (ou defina ALLOW_SAME_DB=1 sabendo o que faz)."
  );
  process.exit(1);
}

const port = process.env.PORT ?? "3000";
if (!/^\d{2,5}$/.test(port)) {
  console.error("Abortado: PORT precisa ser numérica.");
  process.exit(1);
}
console.log(`[dev-staging] Banco: projeto ${stagingRef ?? "desconhecido"} (staging, via .env). Porta ${port}. Dev Runtime ligado.`);

const child = spawn(`npx next dev -p ${port}`, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    DATABASE_URL: staging.DATABASE_URL,
    DIRECT_URL: staging.DIRECT_URL,
    DEV_RUNTIME: "1",
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
