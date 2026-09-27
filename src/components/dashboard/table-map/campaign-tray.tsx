"use client";

import { Megaphone } from "lucide-react";
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
    <div className="flex max-h-64 w-full shrink-0 flex-col border-t sm:h-full sm:max-h-none sm:w-64 sm:border-l sm:border-t-0">
      <div className="shrink-0 border-b p-3">
        <h3 className="text-sm font-semibold">Campanhas ativas</h3>
        <p className="text-xs text-muted-foreground">
          {canAssign
            ? "Arraste sobre uma mesa (ou zona inteira) para direcionar o NFC/QR daquele cartão para esta campanha."
            : "Você não pode atribuir campanhas."}
        </p>
      </div>

      {/* Uma ÚNICA área de rolagem pra campanhas + legenda juntas — antes
          eram duas caixas independentes (`flex-1` pra campanhas, altura
          natural pra legenda) competindo pela mesma altura limitada da tray;
          quando as duas juntas não cabiam, a legenda (fixa, sempre do mesmo
          tamanho) levava o espaço todo e a lista de campanhas — o conteúdo
          que sempre importa mais aqui — sobrava com quase zero pixel de
          altura útil, virando uma fresta. Uma rolagem só, contínua, nunca
          deixa a lista de campanhas menor que o necessário pra mostrar pelo
          menos uma campanha inteira. */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1.5 p-2">
          {campaigns.length === 0 ? (
            // Tray compacta demais (w-64) para o EmptyState padrão (py-12) —
            // mesma ideia (ícone + próximo passo), em escala menor.
            <div className="flex flex-col items-center gap-1.5 p-4 text-center">
              <Megaphone className="size-5 text-muted-foreground/60" strokeWidth={1.5} />
              <p className="text-xs text-muted-foreground">Nenhuma campanha ativa ainda.</p>
            </div>
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
    </div>
  );
}
