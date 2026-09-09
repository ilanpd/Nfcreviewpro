"use client";

import { DESTINATION_META } from "@/domain/campaign/destination";
import { DESTINATION_TYPE_ICON } from "@/components/dashboard/campaigns/destination-type-icon";
import type { TableMapCampaignItem } from "@/types";

interface CampaignTrayProps {
  campaigns: TableMapCampaignItem[];
  onDragStart: (campaign: TableMapCampaignItem) => void;
  onDragEnd: () => void;
  canAssign: boolean;
}

export function CampaignTray({ campaigns, onDragStart, onDragEnd, canAssign }: CampaignTrayProps) {
  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-l">
      <div className="border-b p-3">
        <h3 className="text-sm font-semibold">Campanhas ativas</h3>
        <p className="text-xs text-muted-foreground">
          {canAssign ? "Arraste sobre uma mesa, uma seleção ou uma aba de zona." : "Você não pode atribuir campanhas."}
        </p>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
        {campaigns.length === 0 ? (
          <p className="p-3 text-center text-xs text-muted-foreground">Nenhuma campanha ativa ainda.</p>
        ) : (
          campaigns.map((campaign) => {
            const meta = DESTINATION_META[campaign.type];
            const Icon = DESTINATION_TYPE_ICON[campaign.type];
            return (
              <div
                key={campaign.id}
                draggable={canAssign}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "copy";
                  onDragStart(campaign);
                }}
                onDragEnd={onDragEnd}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm ${
                  canAssign ? "cursor-grab active:cursor-grabbing hover:bg-muted" : "opacity-60"
                }`}
                style={{ borderLeftColor: meta.color, borderLeftWidth: 3 }}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{campaign.name}</span>
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-1 border-t p-3">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Legenda de status</p>
        {Object.entries(DESTINATION_META)
          .filter(([type]) => type !== "REVIEW_FLOW")
          .slice(0, 6)
          .map(([type, meta]) => (
            <div key={type} className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
              {meta.label}
            </div>
          ))}
      </div>
    </div>
  );
}
