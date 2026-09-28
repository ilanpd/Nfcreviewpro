import type { MetadataRoute } from "next";

/**
 * robots.txt (C15) — o site público nunca teve um. Não é segurança (quem
 * quer, ignora), é higiene: buscadores não devem rastrear rotas com token
 * pessoal na URL (`/meu-cartao/[editToken]`), o toque de cada cartão
 * (`/r/[code]`), o painel, o admin, a API, nem os passos de compra/cadastro
 * (não têm nada pra indexar e poluiriam o resultado de busca). O que fica
 * de fora do `disallow` é exatamente o que entra no `sitemap.ts`.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/admin",
          "/onboarding",
          "/sign-in",
          "/sign-up",
          "/meu-cartao/",
          "/r/",
          "/feedback",
          "/thank-you",
          "/loja/sucesso",
          "/dev",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
