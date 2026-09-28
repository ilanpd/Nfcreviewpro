import "server-only";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCardForCompany } from "@/services/card.service";
import { getCompanyById } from "@/services/company.service";
import { generateBrandedQrPngDataUrl } from "@/lib/qrcode";
import { assertCardUrlReady, cardPublicUrl } from "@/lib/card-url";
import { buildBrandColorSet } from "@/domain/white-label/color";
import { PRINT_TEMPLATES, type PrintTemplateId } from "@/domain/white-label/print-templates";
import { PrintAssetPdf } from "@/services/export/print-asset-pdf";
import { resolveDestination } from "@/lib/resolution-engine";
import { buildDestinationPreview } from "@/lib/campaign-destination";
import { loadReturnContext } from "@/services/return-offer.service";
import { decideCardExperience, pickPrimaryUrl, primaryButtonLabel } from "@/domain/return-offer/experience";
import { buildPrintPlateCopy } from "@/domain/return-offer/print-plate-copy";

/**
 * O que a placa deve prometer, calculado exatamente como a tela pública
 * decide o que mostrar (\`/r/[code]/page.tsx\`) — nunca um texto fixo (ADR-082).
 * Uma falha aqui (Retorno fora do ar, engine indisponível) cai no texto
 * genérico "Toque aqui" + link do Google, nunca quebra a geração do PDF: uma
 * placa sempre honesta é melhor que nenhuma placa.
 */
async function resolvePlateCopy(companyId: string, cardCode: string, googleReviewUrl: string | null) {
  try {
    const [decision, returnContext] = await Promise.all([resolveDestination(cardCode, null), loadReturnContext(companyId)]);
    if (decision.outcome === "NOT_FOUND") throw new Error("cartão não encontrado no motor de resolução");

    const directCampaignUrl =
      decision.outcome === "CAMPAIGN"
        ? (() => {
            const preview = buildDestinationPreview(decision.type, decision.config, {
              campaignId: decision.campaignId,
              campaignName: decision.campaignName,
              cardCode,
            });
            return preview.kind === "url" || preview.kind === "whatsapp" ? preview.url : null;
          })()
        : null;

    const experience = decideCardExperience({
      outcome: decision.outcome,
      campaignOrigin: decision.outcome === "CAMPAIGN" ? decision.origin : null,
      availability: returnContext?.availability ?? { available: false, reason: "PLAN_NOT_ALLOWED" },
    });
    const primaryUrl = pickPrimaryUrl({ offerPrimaryUrl: returnContext?.offer?.primaryUrl ?? null, directCampaignUrl, googleReviewUrl });

    return buildPrintPlateCopy({
      returnActive: experience.kind === "RETURN",
      offerTitle: returnContext?.offer?.title ?? null,
      destinationLabel: primaryButtonLabel(primaryUrl ?? ""),
    });
  } catch (err) {
    console.error("[print-assets] falha ao calcular o texto da placa, usando o padrão", err);
    return buildPrintPlateCopy({ returnActive: false, offerTitle: null, destinationLabel: primaryButtonLabel(googleReviewUrl ?? "") });
  }
}

/**
 * Impressão Profissional (Fase 10, bônus) — monta o PDF de um ativo físico
 * (adesivo/cartão/displex/cavalete/plaquinha) para UM cartão NFC
 * específico, usando exatamente a identidade White Label da empresa dona
 * dele. Nunca gera para um cartão de outra empresa — `getCardForCompany`
 * já garante isso (mesmo padrão de tenant-scoping de todo o produto).
 */
export async function renderPrintAsset(companyId: string, cardId: string, templateId: PrintTemplateId): Promise<Buffer> {
  // QR impresso é permanente: recusa gerar o PDF enquanto o endereço do cartão
  // não for o definitivo (ADR-076).
  assertCardUrlReady();
  const [card, company] = await Promise.all([getCardForCompany(companyId, cardId), getCompanyById(companyId)]);

  const colors = buildBrandColorSet(company.primaryColor, company.secondaryColor);
  const [qrDataUrl, plateCopy] = await Promise.all([
    generateBrandedQrPngDataUrl(cardPublicUrl(card.uniqueCode), { darkColor: colors.primary, size: 1024 }),
    resolvePlateCopy(companyId, card.uniqueCode, company.googleReviewUrl),
  ]);

  const element = createElement(PrintAssetPdf, {
    data: {
      templateId,
      size: PRINT_TEMPLATES[templateId].size,
      companyName: company.name,
      logoUrl: company.logoUrl,
      primaryColor: colors.primary,
      onPrimary: colors.onPrimary,
      cardName: card.name,
      qrDataUrl,
      headline: plateCopy.headline,
      subheadline: plateCopy.subheadline,
    },
  }) as unknown as Parameters<typeof renderToBuffer>[0];

  return renderToBuffer(element);
}
