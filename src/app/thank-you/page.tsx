import { ThankYouRedirect } from "./thank-you-redirect";

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; wa?: string }>;
}) {
  const { type, wa } = await searchParams;
  const isFeedback = type === "feedback";
  // Achado de auditoria (28/09/2026): quando a empresa ainda não configurou
  // WhatsApp (ativação incompleta), `feedback-form.tsx` chega aqui sem `wa` —
  // a mensagem antiga prometia "vamos abrir o WhatsApp" mesmo quando nada
  // seria aberto (`ThankYouRedirect` só renderiza com `wa` presente).
  const willRedirectToWhatsapp = isFeedback && !!wa;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-4xl">🙏</div>
      <h1 className="text-xl font-semibold">
        {isFeedback ? "Mensagem enviada." : "Obrigado pela visita!"}
      </h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        {willRedirectToWhatsapp
          ? "Vamos abrir o WhatsApp para você confirmar o envio ao responsável pelo atendimento."
          : isFeedback
            ? "Sua mensagem chegou até o responsável pelo atendimento."
            : "Esperamos ver você de novo."}
      </p>
      {willRedirectToWhatsapp ? <ThankYouRedirect whatsappUrl={wa!} /> : null}
    </main>
  );
}
