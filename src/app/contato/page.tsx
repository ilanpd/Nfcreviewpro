import type { Metadata } from "next";
import Link from "next/link";
import { pageTitle } from "@/lib/brand";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: pageTitle("Contato"),
  description: "Fale com a gente sobre planos, um problema com o cartão, ou qualquer outra dúvida.",
};

/**
 * /contato (C9/F6, J7 do plano) — canal aberto pra quem ainda não tem conta:
 * visitante avaliando um plano, cliente final de uma empresa com um
 * problema, parceria/imprensa. Diferente do "Falar com a gente" do cartão
 * (`/feedback`, sempre ligado a UM cartão específico) e da Central de
 * Suporte do painel (`/dashboard/suporte`, exige login) — este aqui não
 * pressupõe nada sobre quem escreve.
 */
export default function ContatoPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-16 sm:py-20">
        <div className="mx-auto grid max-w-4xl gap-12 sm:grid-cols-2">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Fale com a gente</h1>
            <p className="mt-4 text-muted-foreground">
              Dúvida sobre um plano, problema com o cartão do seu negócio, ou algo que um cliente relatou? Escreva
              aqui — respondemos pelo e-mail que você deixar.
            </p>
            <p className="mt-6 text-sm text-muted-foreground">
              Já é cliente e quer acompanhar sua mensagem no painel?{" "}
              <Link href="/dashboard/suporte" className="font-medium text-foreground underline underline-offset-4">
                Use a Central de Suporte
              </Link>
              .
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Dúvida comum? A{" "}
              <Link href="/ajuda" className="font-medium text-foreground underline underline-offset-4">
                Central de Ajuda
              </Link>{" "}
              pode responder na hora.
            </p>
          </div>
          <ContactForm />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
