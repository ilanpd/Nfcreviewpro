import { ThankYouRedirect } from "./thank-you-redirect";

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; wa?: string }>;
}) {
  const { type, wa } = await searchParams;
  const isFeedback = type === "feedback";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-4xl">🙏</div>
      <h1 className="text-xl font-semibold">
        {isFeedback ? "Obrigado pelo seu feedback." : "Obrigado pela sua avaliação!"}
      </h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        {isFeedback
          ? "Vamos abrir o WhatsApp para você confirmar o envio ao responsável pelo atendimento."
          : "Sua opinião ajuda o estabelecimento a melhorar cada vez mais."}
      </p>
      {isFeedback && wa ? <ThankYouRedirect whatsappUrl={wa} /> : null}
    </main>
  );
}
