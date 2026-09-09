import "server-only";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCardForCompany } from "@/services/card.service";
import { getCompanyById } from "@/services/company.service";
import { generateBrandedQrPngDataUrl, cardPublicUrl } from "@/lib/qrcode";
import { buildBrandColorSet } from "@/domain/white-label/color";
import { PRINT_TEMPLATES, type PrintTemplateId } from "@/domain/white-label/print-templates";
import { PrintAssetPdf } from "@/services/export/print-asset-pdf";

/**
 * Impressão Profissional (Fase 10, bônus) — monta o PDF de um ativo físico
 * (adesivo/cartão/displex/cavalete/plaquinha) para UM cartão NFC
 * específico, usando exatamente a identidade White Label da empresa dona
 * dele. Nunca gera para um cartão de outra empresa — `getCardForCompany`
 * já garante isso (mesmo padrão de tenant-scoping de todo o produto).
 */
export async function renderPrintAsset(companyId: string, cardId: string, templateId: PrintTemplateId): Promise<Buffer> {
  const [card, company] = await Promise.all([getCardForCompany(companyId, cardId), getCompanyById(companyId)]);

  const colors = buildBrandColorSet(company.primaryColor, company.secondaryColor);
  const qrDataUrl = await generateBrandedQrPngDataUrl(cardPublicUrl(card.uniqueCode), { darkColor: colors.primary, size: 1024 });

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
    },
  }) as unknown as Parameters<typeof renderToBuffer>[0];

  return renderToBuffer(element);
}
