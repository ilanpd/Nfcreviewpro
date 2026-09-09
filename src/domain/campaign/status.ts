import type { CampaignStatus } from "@/generated/prisma/client";

/**
 * The 5 statuses the Campaign Dashboard shows (Draft/Scheduled/Active/
 * Paused/Completed) plus Archived. Only DRAFT/ACTIVE/PAUSED/ARCHIVED are
 * ever stored (CampaignStatus) — SCHEDULED and COMPLETED are pure UI labels
 * computed here from ACTIVE + dates, so nothing needs a cron job to "flip"
 * a campaign live or closed. This mirrors the resolution engine's own
 * eligibility check (status === "ACTIVE" AND within the time window) so the
 * dashboard label and the engine's actual behavior can never disagree.
 */
export type DisplayStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";

export interface CampaignScheduleLike {
  status: CampaignStatus;
  startsAt: Date | null;
  endsAt: Date | null;
}

export function computeDisplayStatus(campaign: CampaignScheduleLike, now: Date): DisplayStatus {
  if (campaign.status !== "ACTIVE") return campaign.status;

  if (campaign.endsAt && now > campaign.endsAt) return "COMPLETED";
  if (campaign.startsAt && now < campaign.startsAt) return "SCHEDULED";
  return "ACTIVE";
}

/** Whether the resolution engine would ever consider this campaign at all,
 * ignoring the time window (which the engine checks separately, live). */
export function isEligibleStatus(status: CampaignStatus): boolean {
  return status === "ACTIVE";
}

export const DISPLAY_STATUS_LABEL: Record<DisplayStatus, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  COMPLETED: "Concluída",
  ARCHIVED: "Arquivada",
};
