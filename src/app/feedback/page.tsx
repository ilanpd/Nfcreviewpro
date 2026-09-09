import { z } from "zod";
import { getRatingEventForFeedback } from "@/services/rating.service";
import { BrandHeader } from "@/components/public/brand-header";
import { FeedbackForm } from "./feedback-form";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event } = await searchParams;
  const ratingEventId = z.string().cuid().safeParse(event).data;
  const ratingEvent = ratingEventId ? await getRatingEventForFeedback(ratingEventId) : null;

  if (!ratingEvent) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">Link inválido</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Não encontramos essa avaliação. Aproxime o cartão novamente para tentar de novo.
        </p>
      </main>
    );
  }

  if (ratingEvent.alreadyHasFeedback) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">Feedback já enviado</p>
        <p className="max-w-xs text-sm text-muted-foreground">Obrigado! Já recebemos seu comentário sobre essa visita.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4">
          <BrandHeader name={ratingEvent.company.name} logoUrl={ratingEvent.company.logoUrl} />
          <div className="space-y-1 text-center">
            <p className="text-xl font-semibold">Sentimos muito por isso</p>
            <p className="text-sm text-muted-foreground">
              Conte o que aconteceu para que possamos melhorar diretamente com você.
            </p>
          </div>
        </div>
        <FeedbackForm ratingEventId={ratingEventId!} primaryColor={ratingEvent.company.primaryColor} />
      </div>
    </main>
  );
}
