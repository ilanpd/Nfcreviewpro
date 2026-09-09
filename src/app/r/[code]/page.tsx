import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveDestination } from "@/lib/resolution-engine";
import { buildDestinationPreview } from "@/lib/campaign-destination";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/ip";
import { parseUserAgent } from "@/lib/device";
import { RatingFlow } from "./rating-flow";

export const dynamic = "force-dynamic";

// Shared by generateMetadata and the page component so both pass the exact
// same deviceType — required for React.cache()'s dedup of resolveDestination
// to actually hit (it's keyed on every argument, not just the code).
async function getDeviceType() {
  const h = await headers();
  return parseUserAgent(h.get("user-agent")).device;
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const decision = await resolveDestination(code, await getDeviceType());
  const companyName = decision.outcome !== "NOT_FOUND" ? decision.company.name : null;
  return { title: companyName ? `${companyName} — Avalie sua experiência` : "Cartão não encontrado" };
}

function UnavailableScreen() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-lg font-semibold">Cartão indisponível</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Este cartão não existe ou foi desativado. Fale com o estabelecimento para mais informações.
      </p>
    </main>
  );
}

export default async function CardPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const ip = await getRequestIp();
  const { success } = await rateLimit("publicCard", ip);
  if (!success) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">Muitas tentativas</p>
        <p className="max-w-xs text-sm text-muted-foreground">Aguarde um instante e tente novamente.</p>
      </main>
    );
  }

  const decision = await resolveDestination(code, await getDeviceType());

  if (decision.outcome === "NOT_FOUND") {
    return <UnavailableScreen />;
  }

  if (decision.outcome === "CAMPAIGN") {
    // Same render function the Campaign Builder's live preview uses — the
    // engine and the dashboard preview can never silently disagree on what
    // a customer actually sees.
    const preview = buildDestinationPreview(decision.type, decision.config, {
      campaignId: decision.campaignId,
      campaignName: decision.campaignName,
      cardCode: code,
    });

    if (preview.kind === "url" || preview.kind === "whatsapp") {
      redirect(preview.url);
    }

    // COUPON / AI_MENU / an invalid config: a neutral placeholder,
    // deliberately not the star flow — a misconfigured campaign must never
    // silently masquerade as the legacy behavior.
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">Em breve</p>
        <p className="max-w-xs text-sm text-muted-foreground">Este tipo de campanha ainda não está disponível.</p>
      </main>
    );
  }

  // outcome === "REVIEW_FLOW_FALLBACK" — zero campaigns matched, so this
  // behaves exactly like the pre-campaign-engine MVP, unchanged.
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <RatingFlow
        code={code}
        companyName={decision.company.name}
        logoUrl={decision.company.logoUrl}
        primaryColor={decision.company.primaryColor}
      />
    </main>
  );
}
