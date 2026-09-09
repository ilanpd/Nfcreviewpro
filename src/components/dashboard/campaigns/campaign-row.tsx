"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Archive, Copy, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "./status-badge";
import { DESTINATION_TYPE_ICON } from "./destination-type-icon";
import { CampaignBuilderSheet } from "./campaign-builder-sheet";
import { DESTINATION_META } from "@/domain/campaign/destination";
import type { BranchListItem, CampaignListItem, CardWithStats, ZoneListItem } from "@/types";

interface CampaignRowProps {
  campaign: CampaignListItem;
  branches: BranchListItem[];
  zones: ZoneListItem[];
  cards: CardWithStats[];
  members: { id: string; name: string | null; email: string }[];
  organizationId: string | null;
  canManage: boolean;
  canManageStructure: boolean;
  onUpdated: (campaign: CampaignListItem) => void;
  onDeleted: (id: string) => void;
  onZoneCreated: (zone: ZoneListItem) => void;
  onBranchCreated: (branch: BranchListItem) => void;
}

export function CampaignRow({
  campaign,
  branches,
  zones,
  cards,
  members,
  organizationId,
  canManage,
  canManageStructure,
  onUpdated,
  onDeleted,
  onZoneCreated,
  onBranchCreated,
}: CampaignRowProps) {
  const [busy, setBusy] = useState(false);
  const Icon = DESTINATION_TYPE_ICON[campaign.type];

  async function handleDuplicate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error();
      const { campaign: duplicated } = await res.json();
      onUpdated(duplicated);
      toast.success("Campanha duplicada como rascunho");
    } catch {
      toast.error("Não foi possível duplicar");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/archive`, { method: "POST" });
      if (!res.ok) throw new Error();
      const { campaign: archived } = await res.json();
      onUpdated(archived);
      toast.success("Campanha arquivada");
    } catch {
      toast.error("Não foi possível arquivar");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Excluir a campanha "${campaign.name}"? Essa ação não pode ser desfeita.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted(campaign.id);
      toast.success("Campanha excluída");
    } catch {
      toast.error("Não foi possível excluir");
    } finally {
      setBusy(false);
    }
  }

  return (
    <TableRow>
      <TableCell>
        <CampaignBuilderSheet
          campaign={campaign}
          branches={branches}
          zones={zones}
          cards={cards}
          members={members}
          organizationId={organizationId}
          canManage={canManage}
          canManageStructure={canManageStructure}
          onSaved={onUpdated}
          onZoneCreated={onZoneCreated}
          onBranchCreated={onBranchCreated}
          trigger={
            <button type="button" className="text-left font-medium hover:underline">
              {campaign.name}
            </button>
          }
        />
        {campaign.description ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{campaign.description}</p> : null}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-sm">
          <Icon className="size-4 text-muted-foreground" />
          {DESTINATION_META[campaign.type].label}
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={campaign.displayStatus} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{campaign.priority}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{campaign._count.assignments}</TableCell>
      <TableCell>
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" disabled={busy}>
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="size-4" /> Duplicar
              </DropdownMenuItem>
              {campaign.status !== "ARCHIVED" ? (
                <DropdownMenuItem onClick={handleArchive}>
                  <Archive className="size-4" /> Arquivar
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleDelete}>
                <Trash2 className="size-4" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
