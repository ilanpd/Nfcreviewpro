import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { MeuCartaoForm } from "./meu-cartao-form";

/**
 * Portal leve para clientes GUEST (Fase 18) — fecha o maior ponto de atrito
 * do Fluxo 2 (mapeado no documento de engenharia anterior): antes disso, um
 * cliente que só comprou o cartão físico ficava preso no mesmo destino para
 * sempre, sem nenhuma forma de trocar sozinho. Acesso só pelo link pessoal
 * (`editToken`) — sem sidebar, sem dashboard, sem login.
 */
export default async function MeuCartaoPage({ params }: { params: Promise<{ editToken: string }> }) {
  const { editToken } = await params;
  const card = await prisma.nFCCard.findUnique({ where: { editToken }, include: { company: true } });
  if (!card || card.company.accountType !== "GUEST") notFound();

  const assignment = await prisma.campaignAssignment.findFirst({
    where: { cardId: card.id, scope: "CARD" },
    include: { campaign: true },
    orderBy: { createdAt: "desc" },
  });
  const config = assignment?.campaign.config as { url?: string } | null;
  const destinationUrl = config?.url ?? card.company.googleReviewUrl;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const visitsThisMonth = await prisma.visit.count({ where: { cardId: card.id, createdAt: { gte: startOfMonth } } });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-24">
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
