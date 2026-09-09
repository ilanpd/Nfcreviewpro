// Isomorphic (client + server) — the Campaign Builder's live preview and the
// resolution engine's actual redirect must compute the exact same URL, or
// the preview would lie about what a customer actually experiences.
import { slugify } from "./slugify";

interface UtmSourceInput {
  campaignId: string;
  campaignName: string;
  /** The specific card's code — omitted in the Builder's preview (no card
   * context yet), present at actual redirect time. Lets a later analytics
   * phase attribute a click back to the exact physical card. */
  cardCode?: string;
}

export function appendUtmParams(url: string, { campaignId, campaignName, cardCode }: UtmSourceInput): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url; // caller already validates the URL shape with Zod; this is just a defensive no-op
  }

  parsed.searchParams.set("utm_source", "nfcreviewpro");
  parsed.searchParams.set("utm_medium", "nfc");
  parsed.searchParams.set(
    "utm_campaign",
    `${slugify(campaignName, { fallback: "campanha", maxLength: 40 })}-${campaignId.slice(-6)}`
  );
  if (cardCode) parsed.searchParams.set("utm_content", cardCode);

  return parsed.toString();
}
