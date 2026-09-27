import type { Metadata } from "next";
import Link from "next/link";
import { pageTitle } from "@/lib/brand";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { HelpArticles } from "./help-articles";

export const metadata: Metadata = {
  title: pageTitle("Central de Ajuda"),
  description: "Respostas diretas sobre o cartão, o Retorno, a cobrança e o que fazer quando algo não funciona.",
};

/**
 * Central de Ajuda (C9/F6, J7 do plano) — self-service, literalmente o que
 * `PLANS.STARTER.features` já promete na página de Preços desde antes desta
 * página existir. Pública (sem login): tanto o dono quanto o cliente final
 * que tocou um cartão podem precisar dela sem ter conta nenhuma.
 */
export default function AjudaPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Central de Ajuda</h1>
          <p className="mt-4 text-muted-foreground">
            Respostas diretas, sem precisar abrir chamado — se não encontrar a sua, é só{" "}
            <Link href="/contato" className="font-medium text-foreground underline underline-offset-4">
              falar com a gente
            </Link>
            .
          </p>
        </div>
        <div className="mt-14">
          <HelpArticles />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
