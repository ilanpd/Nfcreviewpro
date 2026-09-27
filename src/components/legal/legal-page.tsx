import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

/**
 * Casca das páginas legais (Termos e Privacidade). Server Component, sem
 * estado. O aviso de "versão preliminar" é intencional e honesto: o texto
 * descreve o que o produto realmente faz hoje, mas ainda precisa da revisão
 * do jurídico e dos dados do controlador (razão social, CNPJ, encarregado)
 * antes de ser tratado como definitivo.
 */
export function LegalPage({
  title,
  updatedAt,
  intro,
  sections,
}: {
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-16 sm:py-20">
        <article className="mx-auto max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Versão preliminar, em revisão jurídica · atualizada em {updatedAt}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-4 text-muted-foreground">{intro}</p>

          <nav aria-label="Seções" className="mt-8 rounded-xl border border-border/60 p-4 text-sm">
            <ol className="grid gap-1.5 sm:grid-cols-2">
              {sections.map((section, index) => (
                <li key={section.title}>
                  <a href={`#secao-${index + 1}`} className="text-muted-foreground hover:text-foreground">
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-10 space-y-10">
            {sections.map((section, index) => (
              <section key={section.title} id={`secao-${index + 1}`} className="scroll-mt-24">
                <h2 className="text-xl font-semibold tracking-tight">
                  {index + 1}. {section.title}
                </h2>
                <div className="mt-3 space-y-3 text-muted-foreground">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
