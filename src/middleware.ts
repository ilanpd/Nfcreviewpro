import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { isDevRuntimeEnabled } from "@/lib/dev-runtime/config";

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
  },
  {
    // Segurança (Fase 10 — White Label): este produto nunca teve nenhum CSP
    // antes desta fase (verificado, não presumido — ver ADR-045). White
    // Label piora o motivo de precisar de um: `logoUrl`/`faviconUrl`/
    // `loginBackgroundUrl` são URLs arbitrárias que CADA empresa escolhe,
    // renderizadas via <img>/background-image em telas públicas (login).
    // `report-only` de propósito: um CSP entrando em modo bloqueante pela
    // primeira vez, numa aplicação deste tamanho, sem conseguir testar
    // contra um navegador real neste sandbox, arriscaria quebrar algo que
    // ninguém consegue prever daqui — o padrão seguro de introduzir CSP
    // pela primeira vez é sempre relatório antes de bloqueio.
    contentSecurityPolicy: {
      reportOnly: true,
      directives: {
        "img-src": ["'self'", "https:", "data:"],
        "connect-src": ["'self'", "https:"],
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
