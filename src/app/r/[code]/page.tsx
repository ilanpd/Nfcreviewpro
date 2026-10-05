import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveDestination } from "@/lib/resolution-engine";
import { buildDestinationPreview } from "@/lib/campaign-destination";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/ip";
import { parseUserAgent } from "@/lib/device";
import { getInactiveCardContact } from "@/services/card.service";
import { loadReturnContext } from "@/services/return-offer.service";
import { decideCardExperience, pickPrimaryUrl } from "@/domain/return-offer/experience";
import { buildCampaignWhatsAppUrl, normalizePhone } from "@/lib/whatsapp";
import { getPublicPlate, recordUnassignedPlateScan } from "@/services/plates.service";
import { CardScreen } from "./card-screen";
import { UnassignedPlateScreen } from "./unassigned-plate-screen";
import type { ResolutionDecision } from "@/lib/resolution-engine/types";

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
  // Página de cartão não é para buscador: cada uma é o toque de um cliente.
  return { title: companyName ?? "Cartão indisponível", robots: { index: false, follow: false } };
}

/** Estado 16: cartão desativado ou inexistente, com o contato do negócio quando ele existe. */
async function UnavailableScreen({ code }: { code: string }) {
  const contact = await getInactiveCardContact(code);
  const whatsapp = contact?.whatsapp && normalizePhone(contact.whatsapp).length >= 10 ? buildCampaignWhatsAppUrl(contact.whatsapp) : null;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-lg font-semibold">Cartão indisponível</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        {contact ? `Este cartão foi desativado. Fale com ${contact.name} para mais informações.` : "Este cartão não existe ou foi desativado. Fale com o estabelecimento para mais informações."}
      </p>
      {whatsapp ? (
        <a href={whatsapp} rel="noopener" className="text-sm font-medium text-brand-ink underline underline-offset-4">
          Falar com {contact!.name} no WhatsApp
        </a>
      ) : null}
    </main>
  );
}

/** O destino do redirecionamento inicial do avulso, quando a campanha vencedora é a do sistema. */
function directCampaignUrl(decision: Extract<ResolutionDecision, { outcome: "CAMPAIGN" }>, code: string): string | null {
  const preview = buildDestinationPreview(decision.type, decision.config, {
    campaignId: decision.campaignId,
    campaignName: decision.campaignName,
    cardCode: code,
  });
  return preview.kind === "url" || preview.kind === "whatsapp" ? preview.url : null;
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
    // Estoque de placas (ADR-092): um código que não é de nenhum cartão pode ser
    // de uma placa ainda sem dono. Só roda aqui, no ramo de erro — o caminho
    // normal do toque não paga nada a mais — e qualquer falha (ex.: tabela
    // ainda não migrada) cai na tela de sempre.
    const plate = await getPublicPlate(code).catch(() => null);
    if (plate && !plate.assigned) {
      await recordUnassignedPlateScan(code);
      return <UnassignedPlateScreen serial={plate.serial} retired={plate.status === "DEFECTIVE" || plate.status === "VOIDED"} />;
    }
    return <UnavailableScreen code={code} />;
  }

  // O Retorno é um acréscimo: qualquer falha ao carregá-lo vira "sem Retorno" e o
  // cartão segue como antes (estado 10). O caminho ao destino nunca depende dele.
  let returnContext = null;
  try {
    returnContext = await loadReturnContext(decision.company.id);
  } catch (err) {
    console.error("[r/code] falha ao carregar o Retorno", err);
  }

  const experience = decideCardExperience({
    outcome: decision.outcome,
    campaignOrigin: decision.outcome === "CAMPAIGN" ? decision.origin : null,
    availability: returnContext?.availability ?? { available: false, reason: "PLAN_NOT_ALLOWED" },
  });

  if (experience.kind === "CAMPAIGN" && decision.outcome === "CAMPAIGN") {
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
    // deliberately not a fake flow — a misconfigured campaign must never
    // silently masquerade as something else.
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">Em breve</p>
        <p className="max-w-xs text-sm text-muted-foreground">Este tipo de campanha ainda não está disponível.</p>
      </main>
    );
  }

  // RETURN ou BUTTONS: a mesma tela; o brinde só aparece no primeiro.
  const primaryUrl = pickPrimaryUrl({
    offerPrimaryUrl: returnContext?.offer?.primaryUrl ?? null,
    directCampaignUrl: decision.outcome === "CAMPAIGN" ? directCampaignUrl(decision, code) : null,
    googleReviewUrl: decision.company.googleReviewUrl,
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <CardScreen
        code={code}
        company={{ name: decision.company.name, logoUrl: decision.company.logoUrl, primaryColor: decision.company.primaryColor }}
        mode={experience.kind === "RETURN" ? "RETURN" : "BUTTONS"}
        primaryUrl={primaryUrl}
      />
    </main>
  );
}
