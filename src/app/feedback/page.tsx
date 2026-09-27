import type { Metadata } from "next";
import { z } from "zod";
import { getFeedbackPageContext } from "@/services/feedback.service";
import { BrandHeader } from "@/components/public/brand-header";
import { FeedbackForm, type FeedbackOrigin } from "./feedback-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Fale com a gente", robots: { index: false, follow: false } };

const cuid = z.string().cuid();
const cardCode = z.string().trim().min(4).max(32);

/**
 * "Fale com a gente" (ADR-080), aberto a todo cliente, sem depender de nota. A
 * origem da mensagem vem da URL: a visita (o caminho normal), o cartão (quando a
 * visita não pôde ser registrada) ou a avaliação (links de antes desta versão,
 * mantidos por 90 dias, até 26/12/2026).
 */
export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ visit?: string; card?: string; event?: string }> }) {
  const { visit, card, event } = await searchParams;

  let origin: FeedbackOrigin | null = null;
  if (cuid.safeParse(visit).success) origin = { visitId: visit! };
  else if (cardCode.safeParse(card).success) origin = { cardCode: card! };
  else if (cuid.safeParse(event).success) origin = { ratingEventId: event! };

  const context = origin ? await getFeedbackPageContext(origin) : null;

  if (!origin || !context) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">Link inválido</p>
        <p className="max-w-xs text-sm text-muted-foreground">Não encontramos essa visita. Aproxime o cartão novamente para tentar de novo.</p>
      </main>
    );
  }

  if (context.alreadySent) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">Mensagem já enviada</p>
        <p className="max-w-xs text-sm text-muted-foreground">Obrigado! Já recebemos sua mensagem sobre essa visita.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4">
          <BrandHeader name={context.company.name} logoUrl={context.company.logoUrl} />
          <div className="space-y-1 text-center">
            <p className="text-xl font-semibold">Fale com a gente</p>
            <p className="text-sm text-muted-foreground">Um elogio, uma sugestão ou um problema: a mensagem vai direto para o responsável.</p>
          </div>
        </div>
        <FeedbackForm origin={origin} primaryColor={context.company.primaryColor} />
      </div>
    </main>
  );
}
