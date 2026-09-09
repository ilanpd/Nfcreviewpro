"use client";

import { useMemo, useState } from "react";
import { Megaphone, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@nfc-os/ui";
import { CampaignRow } from "./campaign-row";
import { CampaignBuilderSheet } from "./campaign-builder-sheet";
import { DISPLAY_STATUS_LABEL, computeDisplayStatus, type DisplayStatus } from "@/domain/campaign/status";
import type { BranchListItem, CampaignListItem, CardWithStats, ZoneListItem } from "@/types";

interface TeamMemberOption {
  id: string;
  name: string | null;
  email: string;
}

interface CampaignsViewProps {
  initialCampaigns: CampaignListItem[];
  branches: BranchListItem[];
  zones: ZoneListItem[];
  cards: CardWithStats[];
  members: TeamMemberOption[];
  organizationId: string | null;
  canManage: boolean;
  canManageStructure: boolean;
}

type SortOption = "recent" | "priority" | "name";

export function CampaignsView({
  initialCampaigns,
  branches: initialBranches,
  zones: initialZones,
  cards,
  members,
  organizationId,
  canManage,
  canManageStructure,
}: CampaignsViewProps) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [branches, setBranches] = useState(initialBranches);
  const [zones, setZones] = useState(initialZones);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DisplayStatus | "ALL">("ALL");
  const [sort, setSort] = useState<SortOption>("recent");

  function handleUpdated(campaign: CampaignListItem) {
    setCampaigns((prev) => {
      const exists = prev.some((c) => c.id === campaign.id);
      return exists ? prev.map((c) => (c.id === campaign.id ? campaign : c)) : [campaign, ...prev];
    });
  }

  function handleDeleted(id: string) {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }

  const visibleCampaigns = useMemo(() => {
    const now = new Date();
    let list = campaigns.filter((c) => {
      const matchesSearch = search.trim() === "" || c.name.toLowerCase().includes(search.trim().toLowerCase());
      const matchesStatus = statusFilter === "ALL" || computeDisplayStatus(c, now) === statusFilter;
      return matchesSearch && matchesStatus;
    });

    list = [...list].sort((a, b) => {
      if (sort === "priority") return b.priority - a.priority;
      if (sort === "name") return a.name.localeCompare(b.name);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return list;
  }, [campaigns, search, statusFilter, sort]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campanhas</h1>
          <p className="text-sm text-muted-foreground">
            Controle para onde cada cartão NFC leva o cliente — sem precisar regravar nenhum chip.
          </p>
        </div>
        {canManage ? (
          <CampaignBuilderSheet
            branches={branches}
            zones={zones}
            cards={cards}
            members={members}
            organizationId={organizationId}
            canManage={canManage}
            canManageStructure={canManageStructure}
            onSaved={handleUpdated}
            onZoneCreated={(zone) => setZones((prev) => [...prev, zone])}
            onBranchCreated={(branch) => setBranches((prev) => [...prev, branch])}
            trigger={
              <Button>
                <Plus className="size-4" /> Nova campanha
              </Button>
            }
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar campanhas…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v: DisplayStatus | "ALL") => setStatusFilter(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            {(Object.keys(DISPLAY_STATUS_LABEL) as DisplayStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {DISPLAY_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v: SortOption) => setSort(v)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="priority">Prioridade</SelectItem>
            <SelectItem value="name">Nome (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {visibleCampaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone />}
          title={campaigns.length === 0 ? "Nenhuma campanha ainda" : "Nenhuma campanha corresponde aos filtros"}
          description={
            campaigns.length === 0
              ? "Crie a primeira para direcionar seus cartões além da avaliação padrão."
              : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Atribuições</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleCampaigns.map((campaign) => (
                <CampaignRow
                  key={campaign.id}
                  campaign={campaign}
                  branches={branches}
                  zones={zones}
                  cards={cards}
                  members={members}
                  organizationId={organizationId}
                  canManage={canManage}
                  canManageStructure={canManageStructure}
                  onUpdated={handleUpdated}
                  onDeleted={handleDeleted}
                  onZoneCreated={(zone) => setZones((prev) => [...prev, zone])}
                  onBranchCreated={(branch) => setBranches((prev) => [...prev, branch])}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
