import type { CampaignType } from "@/generated/prisma/client";

/**
 * What every CampaignType means for the merchant (icon/label) and, more
 * importantly, how it's rendered. Several distinct, meaningful types collapse
 * onto the same "url" rendering group — that's intentional (see the schema
 * comment on CampaignType): the enum stays granular for the merchant-facing
 * UI and future analytics grouping, while lib/campaign-destination.ts only
 * needs to branch on `renderGroup`, not on every individual type.
 */
export type DestinationRenderGroup = "url" | "whatsapp" | "unavailable";

export interface DestinationMeta {
  label: string;
  description: string;
  renderGroup: DestinationRenderGroup;
  /** A stable hex color per type — used anywhere a campaign's *type* needs a
   * glanceable visual identity (Table Map status coloring and its Ghost Mode
   * preview, Phase 5). Not used by the resolution engine or anything
   * customer-facing; a dashboard-only convention. */
  color: string;
}

export const DESTINATION_META: Record<CampaignType, DestinationMeta> = {
  REVIEW_FLOW: {
    label: "Avaliação (padrão)",
    description: "O fluxo de estrelas padrão — reservado, nunca criado manualmente.",
    renderGroup: "unavailable",
    color: "#94A3B8",
  },
  URL_REDIRECT: { label: "Link externo", description: "Redireciona para qualquer URL.", renderGroup: "url", color: "#6366F1" },
  GOOGLE_REVIEWS: { label: "Google Reviews", description: "Leva direto para a avaliação no Google.", renderGroup: "url", color: "#22C55E" },
  INSTAGRAM: { label: "Instagram", description: "Leva para o perfil ou post do Instagram.", renderGroup: "url", color: "#3B82F6" },
  TIKTOK: { label: "TikTok", description: "Leva para o perfil ou vídeo do TikTok.", renderGroup: "url", color: "#0F172A" },
  DIGITAL_MENU: { label: "Cardápio digital", description: "Leva para o cardápio online.", renderGroup: "url", color: "#F59E0B" },
  LANDING_PAGE: { label: "Página promocional", description: "Leva para uma landing page própria.", renderGroup: "url", color: "#EC4899" },
  WHATSAPP: { label: "WhatsApp", description: "Abre uma conversa no WhatsApp com mensagem pronta.", renderGroup: "whatsapp", color: "#25D366" },
  COUPON: { label: "Cupom", description: "Em breve — ainda não é possível exibir cupons.", renderGroup: "unavailable", color: "#A855F7" },
  AI_MENU: { label: "Cardápio com IA", description: "Em breve — reservado para um cardápio interativo.", renderGroup: "unavailable", color: "#14B8A6" },
};

/** Types a merchant can actually pick in the Campaign Builder today. */
export const SELECTABLE_CAMPAIGN_TYPES = (Object.keys(DESTINATION_META) as CampaignType[]).filter(
  (type) => type !== "REVIEW_FLOW"
);

export function isImplementedType(type: CampaignType): boolean {
  return DESTINATION_META[type].renderGroup !== "unavailable";
}
