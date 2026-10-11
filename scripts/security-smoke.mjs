// Varredura ANÔNIMA de todas as rotas de API (regressão de segurança).
//
// Descobre as rotas pelo código (src/app/api/**/route.ts e os métodos que cada uma exporta), chama cada uma SEM
// login e confere três coisas: (1) nenhuma rota protegida responde com sucesso a um anônimo; (2) nenhuma
// rota responde 5xx; (3) nenhuma resposta vaza detalhe interno (pilha de erro, SQL, string de conexão, chave).
//
// Uso:  node scripts/security-smoke.mjs https://seu-site            (todos os métodos, corpo vazio {})
//       node scripts/security-smoke.mjs https://seu-site --get-only  (só leituras: o mais seguro em Produção)
//
// Não envia credenciais nem cookies. As escritas vão com corpo `{}`, que as rotas públicas recusam na
// validação (400) sem gravar nada. Rode contra um ambiente COM Clerk (Produção/Preview): com o Dev Runtime
// ligado o login é dispensado de propósito, e a varredura não faz sentido.
// Sai com código 1 se achar qualquer falha.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const base = (process.argv[2] ?? "").replace(/\/$/, "");
const getOnly = process.argv.includes("--get-only");
if (!/^https?:\/\//.test(base)) {
  console.error("Uso: node scripts/security-smoke.mjs https://seu-site [--get-only]");
  process.exit(2);
}

// ---- descoberta das rotas ---------------------------------------------------------------------------------
const root = "src/app/api";
const routes = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f === "route.ts" || f === "route.tsx") {
      const src = readFileSync(p, "utf8");
      const rel = p.split(sep).join("/").replace(/^src\/app/, "").replace(/\/route\.tsx?$/, "");
      const path = rel.replace(/\[\.\.\.[^\]]+\]/g, "abcd1234").replace(/\[[^\]]+\]/g, "abcd1234");
      const methods = new Set([...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]));
      for (const m of src.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) methods.add(m[1]);
      for (const method of methods) routes.push({ method, path, template: rel });
    }
  }
})(root);

// ---- o que é público de propósito -------------------------------------------------------------------------
const PUBLIC_RULES = [
  /^GET \/api\/brand\//,
  /^GET \/api\/demo\//,
  /^GET \/api\/qr\//,
  /^POST \/api\/demo\//,
  /^POST \/api\/(contact|feedback|visits|store\/checkout|stripe\/webhook)$/,
  /^POST \/api\/ratings(\/|$)/,
  /^POST \/api\/visits\//,
  /^POST \/api\/vouchers\/(lookup|redeem)$/,
  /^POST \/api\/meu-cartao\/recuperar$/,
  /^(GET|PATCH) \/api\/meu-cartao\/(?!recuperar)/,
];
const CRON = /^(GET|POST) \/api\/(queues\/process|playbooks\/evaluate|return\/reengagement)$/;

function expectation(method, path) {
  const key = `${method} ${path}`;
  if (/^[A-Z]+ \/api\/dev\//.test(key)) return { kind: "dev", ok: (s) => s === 404, text: "404" };
  if (CRON.test(key)) return { kind: "cron", ok: (s) => [401, 403, 503].includes(s), text: "401/403/503" };
  if (/^[A-Z]+ \/api\/v1\//.test(key)) return { kind: "v1", ok: (s) => [401, 403].includes(s), text: "401/403" };
  if (PUBLIC_RULES.some((r) => r.test(key))) return { kind: "publica", ok: (s) => s < 500, text: "qualquer, menos 5xx" };
  return { kind: "protegida", ok: (s) => [401, 403, 404, 405].includes(s), text: "401/403/404/405" };
}

const LEAK = [
  [/PrismaClient\w*Error|Invalid `prisma\./i, "erro do Prisma"],
  [/\bat\s+[\w$.<>\[\] ]+\s+\([^)]*:\d+:\d+\)/, "pilha de erro"],
  [/node_modules[\\/]/, "caminho interno (node_modules)"],
  [/postgres(?:ql)?:\/\/[^\s"']+@/i, "string de conexão do banco"],
  [/\b(SELECT|INSERT INTO|UPDATE)\b[\s\S]{0,60}\bFROM\b/i, "trecho de SQL"],
  [/\bsk_(live|test)_[A-Za-z0-9]{10,}|whsec_[A-Za-z0-9]{10,}/, "chave do Stripe"],
  [/ECONNREFUSED|ETIMEDOUT|getaddrinfo/i, "erro de rede interno"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(method, path) {
  const mutating = method !== "GET";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(base + path, {
      method,
      redirect: "manual",
      headers: mutating ? { "Content-Type": "application/json" } : {},
      body: mutating ? "{}" : undefined,
    });
    if (res.status === 429) {
      await sleep(Math.min(15, Number(res.headers.get("retry-after") ?? 5)) * 1000 + 300);
      continue;
    }
    const text = (await res.text()).slice(0, 4000);
    return { status: res.status, text, limited: attempt > 0 };
  }
  return { status: 429, text: "", limited: true };
}

const failures = [];
const summary = {};
let total = 0;
const todo = routes.filter((r) => !getOnly || r.method === "GET");
console.log(`Alvo: ${base} | rotas descobertas: ${new Set(routes.map((r) => r.template)).size} | chamadas: ${todo.length}${getOnly ? " (só GET)" : ""}`);

for (const r of todo) {
  const exp = expectation(r.method, r.path);
  const { status, text } = await call(r.method, r.path);
  total++;
  const cat = (summary[exp.kind] ??= { total: 0, ok: 0 });
  cat.total++;

  for (const [re, what] of LEAK) {
    if (re.test(text)) failures.push({ tipo: "VAZAMENTO", rota: `${r.method} ${r.template}`, detalhe: `${what} (status ${status})` });
  }
  if (status >= 500) failures.push({ tipo: "ERRO 5xx", rota: `${r.method} ${r.template}`, detalhe: `status ${status}` });
  else if (!exp.ok(status)) {
    failures.push({
      tipo: exp.kind === "protegida" || exp.kind === "v1" || exp.kind === "cron" ? "ACESSO ANÔNIMO" : "COMPORTAMENTO",
      rota: `${r.method} ${r.template}`,
      detalhe: `status ${status} (esperado ${exp.text})`,
    });
  } else cat.ok++;
  await sleep(80);
}

console.log("\nResumo por tipo de rota:");
for (const [k, v] of Object.entries(summary)) console.log(`  ${k.padEnd(10)} ${v.ok}/${v.total} como esperado`);
if (failures.length === 0) {
  console.log(`\nOK: ${total} chamadas anônimas, nenhuma falha (sem acesso indevido, sem 5xx, sem vazamento).`);
  process.exit(0);
}
console.log(`\n${failures.length} FALHA(S):`);
for (const f of failures) console.log(`  [${f.tipo}] ${f.rota}: ${f.detalhe}`);
process.exit(1);
