import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PLANS } from "@/lib/plans";
import { STORE_PRODUCTS, applyStoreProductOverrides } from "@/lib/store-products";
import { getSiteSettings } from "@/lib/site-settings";
import { DiscoveryOptions } from "./discovery-options";
import type { PlanType } from "@/generated/prisma/client";

/**
 * Tela de descoberta (C15) — o pedido original: "o sistema precisa descobrir
 * primeiro quem é esse cliente", em vez de mandar todo visitante direto pro
 * mesmo cadastro. Só existe pra um VISITANTE ANÔNIMO — nunca no caminho de
 * quem já está logado (Fluxo 4, botão contextual no dashboard) ou de uma
 * assinatura cancelada (Fluxo 6, banner do próprio painel): nesses dois
 * casos o sistema já sabe quem é a pessoa, perguntar de novo seria ruído.
 * `plan` é só uma dica pré-preenchida (vinda de um card específico em
 * `pricing.tsx`) — nunca pula a pergunta, mesmo assim.
 */
export default async function ComecarPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const initialPlan: PlanType = plan && plan in PLANS ? (plan as PlanType) : "STARTER";

  // O preço do cartão vem do MESMO caminho da Loja (catálogo + override do
  // Admin) — a tela de descoberta nunca mostra um valor que a Loja/o
  // checkout não vão cobrar de fato.
  const settings = await getSiteSettings().catch(() => null);
  const [single] = applyStoreProductOverrides(
    STORE_PRODUCTS.filter((p) => p.id === "single"),
    settings?.storeProductOverrides
  );
  const cardPriceCents = single ? single.unitPriceCents * single.quantity : null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-20">
        <div className="w-full max-w-3xl space-y-10">
          <div className="mx-auto max-w-xl space-y-2 text-center">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">O que você quer fazer hoje?</h1>
            <p className="text-muted-foreground">Sua resposta decide o caminho mais rápido — sem perguntar de novo mais na frente.</p>
          </div>
          <DiscoveryOptions plan={initialPlan} cardPriceCents={cardPriceCents} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
