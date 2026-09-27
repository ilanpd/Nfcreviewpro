import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { findGuestCard, getCardDestination, countCardTouchesThisMonth } from "@/services/meu-cartao.service";
import { MeuCartaoForm } from "./meu-cartao-form";

/**
 * Portal leve para clientes GUEST (Fase 18, revisado ADR-080) — fecha o maior
 * ponto de atrito do Fluxo 2: antes disso, um cliente que só comprou o cartão
 * físico ficava preso no mesmo destino para sempre, sem nenhuma forma de
 * trocar sozinho. Acesso só pelo link pessoal (`editToken`) — sem sidebar, sem
 * dashboard, sem login. Quem já assinou e virou assinante é mandado ao painel
 * de verdade (antes: 404 — achado do plano, J6).
 */
export default async function MeuCartaoPage({ params }: { params: Promise<{ editToken: string }> }) {
  const { editToken } = await params;
  const lookup = await findGuestCard(editToken);
  if (lookup.status === "NOT_FOUND") notFound();
  if (lookup.status === "GRADUATED") redirect("/dashboard");

  const { card } = lookup;
  const { destinationUrl } = await getCardDestination(card.id, card.company.googleReviewUrl);
  const visitsThisMonth = await countCardTouchesThisMonth(card.id);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-20">
        <MeuCartaoForm
          editToken={editToken}
          cardName={card.name}
          initialDestinationUrl={destinationUrl}
          visitsThisMonth={visitsThisMonth}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
