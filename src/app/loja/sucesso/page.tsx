import Link from "next/link";
import { CheckCircle2, Circle, CircleAlert, Clock3 } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { buildOrderChecklist, currentStageLabel } from "@/domain/store-order/checklist";
import { successView } from "@/domain/store-order/success-view";
import { UpgradePitchCard } from "@/components/upgrade-pitch";
import { EditLinkList } from "./edit-link-list";
import { AutoRefresh } from "./auto-refresh";

/**
 * Acompanhamento de pedido (Fase 15) — a mesma URL de retorno do Stripe
 * (`session_id` na query) funciona como o "código do pedido" que o
 * comprador pode voltar a acessar depois, sem precisar de conta nem de
 * e-mail de confirmação (nenhum provedor de e-mail real está configurado
 * neste produto — nunca prometer um envio que não acontece). SHIPPED/
 * DELIVERED avançam manualmente pelo Painel Admin (Fase 16); esta página só
 * lê o estado real do `StoreOrder`, nunca infere um passo que não aconteceu.
 */
export default async function StoreSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const order = session_id
    ? await prisma.storeOrder.findUnique({ where: { stripeCheckoutSessionId: session_id } })
    : null;

  const view = successView(order);
  const checklist = order ? buildOrderChecklist(order) : [];

  // A cópia abaixo do lado do cliente precisa saber se ele ganhou um
  // dashboard de verdade (CUSTOMER, ex.: comprou no checkout combinado) ou
  // se é um convidado (GUEST) sem login — as duas mensagens de "o que fazer
  // agora" são completamente diferentes, nunca a mesma.
  const provisionedCards =
    order && order.provisionedCardIds.length > 0
      ? await prisma.nFCCard.findMany({
          where: { id: { in: order.provisionedCardIds } },
          select: { editToken: true, company: { select: { accountType: true } } },
        })
      : [];
  const isGuestCompany = provisionedCards.some((c) => c.company.accountType === "GUEST");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const editLinks = provisionedCards
    .map((c) => c.editToken)
    .filter((t): t is string => !!t)
    .map((token) => `${appUrl}/meu-cartao/${token}`);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-20">
        <div className="mx-auto w-full max-w-xl">
          <div className="text-center">
            {view.kind === "CONFIRMED" ? (
              <CheckCircle2 className="mx-auto size-14 text-brand-ink" />
            ) : view.kind === "AWAITING_PAYMENT" ? (
              <Clock3 className="mx-auto size-14 text-brand-ink" />
            ) : (
              <CircleAlert className="mx-auto size-14 text-muted-foreground" />
            )}
            <h1 className="mt-6 text-3xl font-semibold tracking-tight">{view.title}</h1>
            {view.description ? <p className="mt-4 text-muted-foreground">{view.description}</p> : null}
            {order && (view.kind === "CONFIRMED" || view.kind === "AWAITING_PAYMENT") ? (
              <p className="mt-4 text-muted-foreground">
                Pedido de {order.quantity} cartão(ões), configurados para redirecionar para{" "}
                <span className="break-all font-medium text-foreground">{order.destinationUrl}</span>.
              </p>
            ) : null}
            {view.autoRefresh ? <AutoRefresh /> : null}
            {view.kind === "NOT_FOUND" ? (
              <Link href="/loja" className="mt-6 inline-block text-sm font-medium text-brand-ink underline underline-offset-4">
                Ir para a loja
              </Link>
            ) : null}
          </div>

          {order && view.kind === "CONFIRMED" ? (
            <div className="mt-12 rounded-2xl border bg-card p-8 shadow-subtle">
              <p className="text-center text-sm font-medium text-foreground">{currentStageLabel(order)}</p>

              <ol className="mt-6 space-y-2.5">
                {checklist.map((step) => (
                  <li key={step.key} className="flex items-center gap-2.5 text-sm">
                    {step.done ? (
                      <CheckCircle2 className="size-4 shrink-0 text-brand-ink" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground/40" />
                    )}
                    <span className={cn(step.done ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
                  </li>
                ))}
              </ol>

              {isGuestCompany ? (
                <div className="mt-6 rounded-lg bg-muted/50 p-4 text-center text-xs text-muted-foreground">
                  <p>
                    Você comprou só o cartão, sem o software — nenhum painel foi criado. Assim que chegar, use o link
                    pessoal abaixo para trocar o destino sozinho, sem precisar de conta:
                  </p>
                  {editLinks.length > 0 ? <EditLinkList links={editLinks} /> : null}
                </div>
              ) : null}

              {isGuestCompany && order ? (
                <div className="mt-6 space-y-2">
                  <UpgradePitchCard href="/sign-up?plan=STARTER&hasCard=1" />
                  <p className="text-center text-xs text-muted-foreground">
                    Cadastre-se com o e-mail <span className="font-medium text-foreground">{order.customerEmail}</span>{" "}
                    e seu cartão já aparece automaticamente no painel — sem comprar de novo.
                  </p>
                </div>
              ) : null}

              {!isGuestCompany ? (
                <p className="mt-6 rounded-lg bg-muted/50 p-4 text-center text-xs text-muted-foreground">
                  Assim que chegarem, seus {order.quantity} cartão(ões) já aparecem prontos em <span className="font-medium text-foreground">Cartões</span>, no seu painel — nenhuma configuração extra. Vá em <span className="font-medium text-foreground">Mapa de Mesas</span> para posicionar cada um e arrastar uma campanha até ele, controlando pra onde aquele NFC/QR leva.
                </p>
              ) : null}

              <p className="mt-4 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">
                Guarde este link para acompanhar seu pedido depois — não enviamos e-mail de confirmação.
              </p>
            </div>
          ) : null}

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Alguma dúvida?{" "}
            <Link href="/contato" className="font-medium text-brand-ink underline underline-offset-4">
              Fale com a gente
            </Link>{" "}
            ou veja a{" "}
            <Link href="/ajuda" className="font-medium text-brand-ink underline underline-offset-4">
              Central de Ajuda
            </Link>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
