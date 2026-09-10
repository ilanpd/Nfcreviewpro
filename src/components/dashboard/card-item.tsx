"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Link2, MoreVertical, Pause, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CardFormDialog } from "@/components/dashboard/card-form-dialog";
import { cardPublicUrl } from "@/lib/qrcode";
import type { BranchListItem, CardWithStats, ZoneListItem } from "@/types";
import type { NFCCard } from "@/generated/prisma/client";
import { PremiumCardShell, SmartBadge } from "@nfc-os/ui";

interface CardItemProps {
  card: CardWithStats;
  branches: BranchListItem[];
  zones: ZoneListItem[];
  onUpdated: (card: NFCCard) => void;
  onDeleted: (id: string) => void;
  canManage: boolean;
}

export function CardItem({ card, branches, zones, onUpdated, onDeleted, canManage }: CardItemProps) {
  const [busy, setBusy] = useState(false);
  const publicUrl = cardPublicUrl(card.uniqueCode);

  async function toggleActive() {
    setBusy(true);
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !card.active }),
      });
      if (!res.ok) throw new Error();
      const { card: updated } = await res.json();
      onUpdated(updated);
      toast.success(updated.active ? "Cartão ativado" : "Cartão pausado");
    } catch {
      toast.error("Não foi possível atualizar o cartão");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Excluir o cartão "${card.name}"? Essa ação não pode ser desfeita.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cards/${card.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted(card.id);
      toast.success("Cartão excluído");
    } catch {
      toast.error("Não foi possível excluir o cartão");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Link copiado");
  }

  return (
    <PremiumCardShell>
      <div className="flex flex-row items-start justify-between gap-2 p-5 pb-0">
        <div className="min-w-0">
          <p className="truncate font-medium">{card.name}</p>
          <p className="truncate text-xs text-muted-foreground">/r/{card.uniqueCode}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 shrink-0" disabled={busy}>
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canManage ? (
              <CardFormDialog
                card={card}
                branches={branches}
                zones={zones}
                onSaved={(updated) => onUpdated(updated)}
                trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Editar</DropdownMenuItem>}
              />
            ) : null}
            {canManage ? (
              <DropdownMenuItem onClick={toggleActive}>
                {card.active ? (
                  <>
                    <Pause className="size-4" /> Pausar
                  </>
                ) : (
                  <>
                    <Play className="size-4" /> Ativar
                  </>
                )}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={copyLink}>
              <Link2 className="size-4" /> Copiar link
            </DropdownMenuItem>
            {canManage ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleDelete}>
                  <Trash2 className="size-4" /> Excluir
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center justify-center p-5">
        {card.qrCodeUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.qrCodeUrl} alt={`QR Code — ${card.name}`} className="size-32 rounded-lg" />
        ) : (
          <div className="flex size-32 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
            Sem QR
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-border/60 p-5 pt-4">
        <div className="flex flex-wrap gap-1">
          <SmartBadge label={card.active ? "Ativo" : "Pausado"} tone={card.active ? "success" : "neutral"} />
          {card.zoneId ? (
            <SmartBadge label={zones.find((z) => z.id === card.zoneId)?.name ?? "Zona"} tone="neutral" />
          ) : null}
          {card.branchId ? (
            <SmartBadge label={branches.find((b) => b.id === card.branchId)?.name ?? "Unidade"} tone="neutral" />
          ) : null}
          {card.tags.slice(0, 2).map((tag) => (
            <SmartBadge key={tag} label={tag} tone="neutral" />
          ))}
        </div>
        {card.qrCodeUrl ? (
          <a href={card.qrCodeUrl} download={`qrcode-${card.uniqueCode}.png`}>
            <Button variant="ghost" size="icon" className="size-8">
              <Download className="size-4" />
            </Button>
          </a>
        ) : null}
      </div>
    </PremiumCardShell>
  );
}
