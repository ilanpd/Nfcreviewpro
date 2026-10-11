// Varredura de segredos no que o navegador recebe (regressao de seguranca).
//
// Procura, nos arquivos que o site entrega ao publico, (1) os VALORES REAIS das suas
// variaveis de ambiente que nao sao publicas e (2) padroes conhecidos de credenciais.
// Nunca imprime um valor: so o NOME da variavel/padrao e onde apareceu.
//
// Uso:
//   node scripts/security-scan-bundle.mjs                 -> varre o build local (.next/static, .next/server/app, public)
//   node scripts/security-scan-bundle.mjs https://site    -> varre o que o site publicado entrega (HTML + JS + mapas)
//
// Sai com codigo 1 se achar algo que nao deveria estar publico.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const targetUrl = process.argv[2];

function parseEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

// Valores a procurar: tudo que NAO e NEXT_PUBLIC_ e parece segredo (>= 16 caracteres, nao e so URL publica simples).
const env = { ...parseEnv(".env"), ...parseEnv(".env.local") };
const secretValues = Object.entries(env)
  .filter(([name, value]) => !name.startsWith("NEXT_PUBLIC_") && value.length >= 16 && !/^https?:\/\/[^@]+$/.test(value))
  .map(([name, value]) => ({ name, value }));

// Fragmentos que identificam o segredo mesmo se so uma parte for embutida (senha dentro da URL do banco, por exemplo).
for (const { name, value } of [...secretValues]) {
  const pass = /^[a-z]+:\/\/[^:]+:([^@]+)@/.exec(value);
  if (pass && pass[1].length >= 8) secretValues.push({ name: name + " (senha)", value: decodeURIComponent(pass[1]) });
}

const PATTERNS = {
  stripe_secret: /sk_(live|test)_[A-Za-z0-9]{20,}/,
  stripe_restricted: /rk_(live|test)_[A-Za-z0-9]{20,}/,
  stripe_webhook_secret: /whsec_[A-Za-z0-9]{20,}/,
  aws_access_key: /AKIA[0-9A-Z]{16}/,
  github_token: /gh[pousr]_[A-Za-z0-9]{30,}/,
  private_key_block: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  postgres_url_com_senha: /postgres(ql)?:\/\/[^:@/\s]+:[^@/\s]{6,}@[^/\s]+/,
  resend_key: /\bre_[A-Za-z0-9]{20,}/,
  sentry_auth_token: /sntrys_[A-Za-z0-9]{20,}/,
  // JWT com papel privilegiado do Supabase (o service_role). O anon e publico por desenho, entao so sinalizo o service_role.
  supabase_service_role: /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\.[A-Za-z0-9_-]{20,}/,
};

const findings = [];
let filesScanned = 0;
let bytes = 0;
const mapFiles = [];

function scanText(label, text) {
  filesScanned++;
  bytes += text.length;
  for (const { name, value } of secretValues) {
    if (text.includes(value)) findings.push({ onde: label, tipo: "valor de variavel de ambiente", nome: name });
  }
  for (const [nome, re] of Object.entries(PATTERNS)) {
    if (re.test(text)) findings.push({ onde: label, tipo: "padrao de credencial", nome });
  }
}

function walk(dir, visit) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, visit);
    else visit(p, st);
  }
}

async function scanLocal() {
  console.log("Alvo: build local (.next/static, .next/server/app, public)");
  for (const dir of [".next/static", ".next/server/app", "public"]) {
    walk(dir, (p, st) => {
      if (p.endsWith(".map")) mapFiles.push(p);
      if (st.size > 15 * 1024 * 1024) return;
      if (/\.(png|jpe?g|webp|gif|ico|woff2?|ttf|otf|mp4|webm|pdf)$/i.test(p)) return;
      scanText(p.replace(/\\/g, "/"), readFileSync(p, "utf8"));
    });
  }
}

async function scanRemote(base) {
  console.log("Alvo: site publicado", base);
  const get = async (url) => {
    const res = await fetch(url, { redirect: "follow" });
    return { status: res.status, text: res.status === 200 ? await res.text() : "" };
  };
  const pages = ["/", "/loja", "/comecar", "/termos", "/privacidade", "/contato", "/ajuda", "/developers", "/sign-in", "/sign-up", "/demo", "/onboarding/plan"];
  const assets = new Set();
  for (const page of pages) {
    const { status, text } = await get(base + page);
    if (status !== 200) continue;
    scanText(`${page} (HTML)`, text);
    for (const m of text.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.(?:js|css))"/g)) assets.add(m[1]);
    for (const m of text.matchAll(/"(\/_next\/static\/[^"]+\.js)"/g)) assets.add(m[1]);
  }
  console.log(`Arquivos estaticos descobertos: ${assets.size}`);
  for (const a of assets) {
    const { status, text } = await get(base + a);
    if (status === 200) scanText(a, text);
    // mapa de codigo-fonte publicado? (expoe o codigo original)
    const map = await fetch(base + a + ".map", { redirect: "follow" });
    if (map.status === 200) mapFiles.push(base + a + ".map");
  }
}

if (targetUrl) await scanRemote(targetUrl.replace(/\/$/, ""));
else await scanLocal();

console.log(`Arquivos varridos: ${filesScanned} (${(bytes / 1024 / 1024).toFixed(1)} MB) | variaveis secretas procuradas: ${new Set(secretValues.map((s) => s.name)).size}`);
const unicos = [...new Map(findings.map((f) => [`${f.onde}|${f.nome}`, f])).values()];
if (mapFiles.length) console.log(`ATENCAO: ${mapFiles.length} mapa(s) de codigo-fonte publicado(s) (expoem o codigo original). Ex.: ${mapFiles[0]}`);
if (unicos.length === 0 && mapFiles.length === 0) {
  console.log("OK: nenhum segredo e nenhum mapa de codigo-fonte nos arquivos publicos.");
  process.exit(0);
}
for (const f of unicos) console.log(`ACHADO  ${f.tipo}: ${f.nome}  em  ${f.onde}`);
process.exit(unicos.length || mapFiles.length ? 1 : 0);
