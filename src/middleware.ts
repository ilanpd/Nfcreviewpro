import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { isDevRuntimeEnabled } from "@/lib/dev-runtime/config";
import { runApiGuards } from "@/lib/api-guards";

// Segurança (Auditoria Nível Bilionário, 11/09/2026; ampliada na Auditoria de Cibersegurança de
// 11/10/2026, ADR-096) — as guardas gerais de `/api/*` vivem aqui, UMA vez, e nunca dependem de cada
// rota lembrar de chamá-las: teto de tamanho do corpo (413), requisição que altera dado vinda de
// OUTRO site (403, CSRF) e limite de taxa pela classe da rota, para mutações E leituras (429, com
// `Retry-After`). As regras são funções puras em `lib/request-guards.ts` (testadas); o IP vem de
// `lib/client-ip.ts`, que não confia em cabeçalho que o cliente consiga forjar. Fora das guardas:
// o webhook do Stripe (assinatura HMAC), a API pública v1 (limite por chave) e os agendamentos
// (CRON_SECRET) — ver `isGuardedApiPath`.

// The real security boundary is resource-based: every dashboard page/layout
// and API route calls requireAuthContext()/getAuthContext() itself (see
// lib/auth.ts). This middleware only adds a fast redirect-to-sign-in for the
// common case — Clerk now discourages `createRouteMatcher` + path-based
// gating as the sole guard, since it can diverge from actual route matching.
//
// White Label (Fase 10) — o `DomainResolver` (`lib/white-label/resolve-brand.ts`)
// deliberadamente NÃO roda aqui: Middleware neste Next.js roda só no
// runtime Edge, que não sustenta o Prisma (precisa de `node:crypto`/`fs`/
// etc. — confirmado batendo de frente com um erro real de build ao tentar
// importar o resolver aqui, não uma suposição). As telas de login/cadastro
// (Server Components normais, runtime Node) chamam `resolveBrandByHost`
// diretamente, lendo o próprio `Host` header — mais simples, e sem essa
// limitação. Ver ADR-042.
const withClerk = clerkMiddleware(
  async (auth, req) => {
    const { pathname } = req.nextUrl;
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding")) {
      await auth.protect();
    }

    // Guardas gerais de /api/* (tamanho do corpo, CSRF, limite de taxa): ver lib/api-guards.ts.
    const blocked = await runApiGuards(req, async () => (await auth()).userId);
    if (blocked) return blocked;
  },
  {
    // Segurança (Fase 10 — White Label, endurecida na Auditoria Nível
    // Bilionário de 11/09/2026): este produto nunca teve nenhum CSP antes
    // da Fase 10 (verificado, não presumido — ver ADR-045). A versão
    // original só restringia `img-src`/`connect-src` — mesmo se tirada do
    // modo relatório, nunca teria impedido injeção de script (não existia
    // `script-src` nem `default-src`). Agora a política é completa:
    // `default-src 'self'` fecha tudo por padrão, com exceções explícitas
    // só para o que o produto realmente carrega (Clerk, Stripe, Google
    // Fonts). `'unsafe-inline'`/`'unsafe-eval'` em `script-src` continuam
    // necessários enquanto não existir um CSP baseado em nonce (mudança
    // maior, não feita aqui) — mesmo assim, isto já bloqueia injeção via
    // `<script src="...">` de um domínio não listado, `object-src`, e
    // clickjacking via `frame-ancestors`. `report-only` continua de
    // propósito: continua sem como testar contra um navegador real neste
    // sandbox — o próximo passo é revisar os relatórios de violação de
    // produção antes de apertar para bloqueante, não pular essa etapa.
    contentSecurityPolicy: {
      reportOnly: true,
      directives: {
        "default-src": ["'self'"],
        "img-src": ["'self'", "https:", "data:"],
        "connect-src": ["'self'", "https:"],
        "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://*.clerk.accounts.dev", "https://challenges.cloudflare.com", "https://js.stripe.com"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "frame-src": ["'self'", "https://js.stripe.com", "https://checkout.stripe.com", "https://challenges.cloudflare.com"],
        "frame-ancestors": ["'none'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
      },
    },
  }
);

// Dev Runtime (Fase 12, Self-Healing Development) — quando `DEV_RUNTIME=1`
// (`isDevRuntimeEnabled()` só lê `process.env`, seguro no runtime Edge, sem
// puxar Prisma), o middleware nem invoca o Clerk: `getAuthContext()`
// (lib/auth.ts) já resolve a sessão sem ele nesse modo, então rodar
// `clerkMiddleware` aqui seria trabalho morto (e uma superfície a mais para
// quebrar sem chaves reais). Esta é a decisão PERMANENTE que elimina a
// necessidade de editar este arquivo a cada fase — nunca mais um
// comentário "TEMP" aqui. Ver ADR-052.
export default isDevRuntimeEnabled() ? () => NextResponse.next() : withClerk;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
