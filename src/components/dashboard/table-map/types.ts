import type { TableCardItem, TableMapCampaignItem } from "@/types";
import type { TableStatus } from "@/domain/table-map/status";

export type DragOverTarget =
  | { kind: "card"; cardId: string }
  | { kind: "cards"; cardIds: string[] }
  | { kind: "zone"; zoneId: string };

export interface GhostPreview {
  target: DragOverTarget;
  campaign: TableMapCampaignItem;
}

export type StatusMap = Map<string, TableStatus | null>;

export type { TableCardItem, TableMapCampaignItem };
