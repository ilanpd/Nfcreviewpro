import type { NFCCard, PrivateFeedback, RatingEvent, Visit } from "@/generated/prisma/client";
// Type-only imports of server-only modules are erased at compile time —
// safe for client components, and keeps the campaign list/detail shape
// defined in exactly one place (the service) instead of hand-duplicated here.
import type { listCampaigns, getCampaign, listAssignments } from "@/services/campaign.service";
import type { listBranches } from "@/services/branch.service";
import type { listZones } from "@/services/zone.service";
import type { listCardsForMap, listActiveCampaignsForMap } from "@/services/table-map.service";

export type CardWithStats = NFCCard & {
  _count: { visits: number };
};

export type CampaignListItem = Awaited<ReturnType<typeof listCampaigns>>[number];
export type CampaignDetail = Awaited<ReturnType<typeof getCampaign>>;
export type CampaignAssignmentItem = Awaited<ReturnType<typeof listAssignments>>[number];
export type BranchListItem = Awaited<ReturnType<typeof listBranches>>[number];
export type ZoneListItem = Awaited<ReturnType<typeof listZones>>[number];
export type TableCardItem = Awaited<ReturnType<typeof listCardsForMap>>[number];
export type TableMapCampaignItem = Awaited<ReturnType<typeof listActiveCampaignsForMap>>[number];

type VisitContext = Pick<Visit, "device" | "browser" | "createdAt">;

/** Uma mensagem privada. `ratingEvent` é nulo nas mensagens enviadas sem a
 * pergunta de nota (Retorno, ADR-078); nesse caso o contexto vem de `visit`. */
export type FeedbackWithContext = PrivateFeedback & {
  ratingEvent: (RatingEvent & { visit: VisitContext }) | null;
  visit: VisitContext | null;
};

export interface DashboardSummary {
  totalVisits: number;
  googleClicks: number;
  privateFeedbacks: number;
  conversionRate: number; // googleClicks / totalVisits
  activeCards: number;
  averageStars: number | null;
}

export interface TimeseriesPoint {
  date: string; // YYYY-MM-DD
  visits: number;
  googleClicks: number;
  feedbacks: number;
}

export interface BreakdownItem {
  label: string;
  count: number;
}

export type { PublicRatingResult } from "@/domain/rating/public-result";
