import type { MetadataRoute } from "next";

/**
 * sitemap.xml (C15) — só as páginas públicas que existem pra ser achadas:
 * a home (promessa), `/comecar` (o ponto de entrada de compra), a Loja, a
 * Central de Ajuda, o contato, a documentação pra desenvolvedores e as duas
 * páginas legais. Nada de rota com token, painel ou passo de cadastro —
 * isso é o espelho de `robots.ts`. Sem `lastModified` fingido: só a data
 * do build, que é a verdade sobre quando o conteúdo foi publicado.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const now = new Date();
  const pages: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/comecar", priority: 0.9, changeFrequency: "monthly" },
    { path: "/loja", priority: 0.9, changeFrequency: "weekly" },
    { path: "/ajuda", priority: 0.6, changeFrequency: "monthly" },
    { path: "/contato", priority: 0.5, changeFrequency: "yearly" },
    { path: "/developers", priority: 0.4, changeFrequency: "monthly" },
    { path: "/termos", priority: 0.2, changeFrequency: "yearly" },
    { path: "/privacidade", priority: 0.2, changeFrequency: "yearly" },
  ];
  return pages.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
