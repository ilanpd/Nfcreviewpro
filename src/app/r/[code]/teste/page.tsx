import type { Metadata } from "next";
import { resolveDestination } from "@/lib/resolution-engine";
import { loadReturnContext } from "@/services/return-offer.service";
import { pickPrimaryUrl } from "@/domain/return-offer/experience";
import { DemoCard } from "./demo-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Teste do cartão", robots: { index: false, follow: false } };

/**
 * Página de teste do cartão (ADR-080): mostra a tela que o cliente vê, estado
 * por estado, com o texto e as datas reais do negócio, sem emitir brinde nem
 * gravar visita. O dono abre no próprio celular para conferir antes de colocar o
 * cartão no balcão.
 */
export default async function CardTestPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const decision = await resolveDestination(code, null);

  if (decision.outcome === "NOT_FOUND") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">Cartão não encontrado</p>
        <p className="max-w-xs text-sm text-muted-foreground">Confira o código do cartão e tente de novo.</p>
      </main>
    );
  }

  const context = await loadReturnContext(decision.company.id).catch(() => null);
  const offer = context?.offer ?? null;
  const primaryUrl = pickPrimaryUrl({
    offerPrimaryUrl: offer?.primaryUrl ?? null,
    directCampaignUrl: null,
    googleReviewUrl: decision.company.googleReviewUrl,
  });

  return (
    <main className="min-h-screen p-6">
      <DemoCard
        code={code}
        company={{ name: decision.company.name, logoUrl: decision.company.logoUrl, primaryColor: decision.company.primaryColor }}
        primaryUrl={primaryUrl}
        title={offer?.title ?? "Brinde de exemplo"}
        timeZone={decision.company.timezone}
        windowDays={offer?.windowDays ?? 14}
        nowIso={new Date().toISOString()}
      />
    </main>
  );
}
