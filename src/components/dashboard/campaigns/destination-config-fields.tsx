"use client";

import { ExternalLink, MessageCircle } from "lucide-react";
import type { CampaignType } from "@/generated/prisma/client";
import { DESTINATION_META } from "@/domain/campaign/destination";
import { buildDestinationPreview } from "@/lib/campaign-destination";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface DestinationConfigFieldsProps {
  type: CampaignType;
  campaignName: string;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

export function DestinationConfigFields({ type, campaignName, config, onChange }: DestinationConfigFieldsProps) {
  const group = DESTINATION_META[type].renderGroup;

  const preview = buildDestinationPreview(type, config, {
    campaignId: "preview",
    campaignName: campaignName || "campanha",
  });

  return (
    <div className="space-y-4">
      {group === "url" ? (
        <div className="space-y-2">
          <Label htmlFor="destination-url">URL de destino</Label>
          <Input
            id="destination-url"
            type="url"
            placeholder="https://…"
            value={typeof config.url === "string" ? config.url : ""}
            onChange={(e) => onChange({ ...config, url: e.target.value })}
          />
        </div>
      ) : null}

      {group === "whatsapp" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="destination-phone">Número do WhatsApp</Label>
            <Input
              id="destination-phone"
              placeholder="5511999999999"
              value={typeof config.phone === "string" ? config.phone : ""}
              onChange={(e) => onChange({ ...config, phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="destination-message">Mensagem inicial (opcional)</Label>
            <Textarea
              id="destination-message"
              rows={3}
              value={typeof config.message === "string" ? config.message : ""}
              onChange={(e) => onChange({ ...config, message: e.target.value })}
            />
          </div>
        </>
      ) : null}

      {group === "unavailable" ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Este tipo de destino ainda não tem uma experiência própria — a campanha pode ser salva como rascunho, mas
          não redirecionará clientes até estar disponível.
        </p>
      ) : null}

      {group !== "unavailable" ? (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Pré-visualização em tempo real</p>
          {preview.kind === "url" ? (
            <a
              href={preview.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 truncate text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-3.5 shrink-0" />
              <span className="truncate">{preview.url}</span>
            </a>
          ) : preview.kind === "whatsapp" ? (
            <div className="flex items-center gap-1.5 text-sm text-primary">
              <MessageCircle className="size-3.5 shrink-0" />
              <span className="truncate">{preview.url}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Preencha os campos acima para ver o destino final.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
