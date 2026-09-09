import type { CampaignType } from "@/generated/prisma/client";
import { DESTINATION_META } from "@/domain/campaign/destination";
import { urlRedirectConfigSchema, whatsappConfigSchema } from "@/lib/validations/campaign";
import { buildCampaignWhatsAppUrl } from "@/lib/whatsapp";
import { appendUtmParams } from "@/lib/utm";

export type DestinationPreview =
  | { kind: "url"; url: string }
  | { kind: "whatsapp"; url: string; phone: string; message?: string }
  | { kind: "unavailable" };

interface DestinationContext {
  campaignId: string;
  campaignName: string;
  /** Omitted from the Builder's preview (no specific card yet). */
  cardCode?: string;
}

/**
 * The ONE place that turns a Campaign's (type, config) into an actual
 * destination — used identically by the resolution engine's real redirect
 * (src/app/r/[code]/page.tsx) and the Campaign Builder's live preview
 * (client-side, no card context). Isomorphic on purpose: if this lived only
 * server-side, the Builder's preview would have to reimplement it and could
 * silently drift from what a customer actually experiences.
 */
export function buildDestinationPreview(type: CampaignType, config: unknown, context: DestinationContext): DestinationPreview {
  const group = DESTINATION_META[type].renderGroup;

  if (group === "url") {
    const parsed = urlRedirectConfigSchema.safeParse(config);
    if (!parsed.success) return { kind: "unavailable" };
    return { kind: "url", url: appendUtmParams(parsed.data.url, context) };
  }

  if (group === "whatsapp") {
    const parsed = whatsappConfigSchema.safeParse(config);
    if (!parsed.success) return { kind: "unavailable" };
    return {
      kind: "whatsapp",
      url: buildCampaignWhatsAppUrl(parsed.data.phone, parsed.data.message),
      phone: parsed.data.phone,
      message: parsed.data.message,
    };
  }

  return { kind: "unavailable" };
}
