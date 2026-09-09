"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DestinationPicker } from "./destination-picker";
import { DestinationConfigFields } from "./destination-config-fields";
import { AssignmentManager } from "./assignment-manager";
import { RuleManager } from "./rule-manager";
import { VariantManager } from "./variant-manager";
import type { BranchListItem, CampaignAssignmentItem, CampaignListItem, CardWithStats, ZoneListItem } from "@/types";
import type { CampaignType, RecurrenceType, RuleType } from "@/generated/prisma/client";

interface RuleItem {
  id: string;
  type: RuleType;
  config: unknown;
}

interface VariantItem {
  id: string;
  name: string;
  weight: number;
  config: unknown;
}

const WEEKDAY_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface TeamMemberOption {
  id: string;
  name: string | null;
  email: string;
}

interface CampaignBuilderSheetProps {
  campaign?: CampaignListItem;
  trigger: React.ReactNode;
  branches: BranchListItem[];
  zones: ZoneListItem[];
  cards: CardWithStats[];
  members: TeamMemberOption[];
  organizationId: string | null;
  canManage: boolean;
  canManageStructure: boolean;
  onSaved: (campaign: CampaignListItem) => void;
  onZoneCreated: (zone: ZoneListItem) => void;
  onBranchCreated: (branch: BranchListItem) => void;
}

function toDatetimeLocal(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CampaignBuilderSheet({
  campaign,
  trigger,
  branches,
  zones,
  cards,
  members,
  organizationId,
  canManage,
  canManageStructure,
  onSaved,
  onZoneCreated,
  onBranchCreated,
}: CampaignBuilderSheetProps) {
  const isEdit = Boolean(campaign);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignments, setAssignments] = useState<CampaignAssignmentItem[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  const [form, setForm] = useState(() => buildInitialForm(campaign));

  useEffect(() => {
    if (open) setForm(buildInitialForm(campaign));
  }, [open, campaign]);

  useEffect(() => {
    if (!open || !campaign) return;
    setLoadingAssignments(true);
    fetch(`/api/campaigns/${campaign.id}/assignments`)
      .then((res) => res.json())
      .then((data) => setAssignments(data.assignments ?? []))
      .catch(() => toast.error("Não foi possível carregar as atribuições"))
      .finally(() => setLoadingAssignments(false));
  }, [open, campaign]);

  useEffect(() => {
    if (!open || !campaign) return;
    setLoadingRules(true);
    fetch(`/api/campaigns/${campaign.id}/rules`)
      .then((res) => res.json())
      .then((data) => setRules(data.rules ?? []))
      .catch(() => toast.error("Não foi possível carregar as regras"))
      .finally(() => setLoadingRules(false));
  }, [open, campaign]);

  useEffect(() => {
    if (!open || !campaign) return;
    setLoadingVariants(true);
    fetch(`/api/campaigns/${campaign.id}/variants`)
      .then((res) => res.json())
      .then((data) => setVariants(data.variants ?? []))
      .catch(() => toast.error("Não foi possível carregar as variantes"))
      .finally(() => setLoadingVariants(false));
  }, [open, campaign]);

  function buildInitialForm(c?: CampaignListItem) {
    return {
      name: c?.name ?? "",
      description: c?.description ?? "",
      type: (c?.type ?? "URL_REDIRECT") as CampaignType,
      config: (c?.config as Record<string, unknown>) ?? {},
      priority: c?.priority ?? 0,
      startsAt: toDatetimeLocal(c?.startsAt),
      endsAt: toDatetimeLocal(c?.endsAt),
      recurrenceType: (c?.recurrenceType ?? "NONE") as RecurrenceType,
      recurrenceConfig: (c?.recurrenceConfig as { daysOfWeek?: number[]; startTime?: string; endTime?: string }) ?? {},
      tags: c?.tags?.join(", ") ?? "",
      ownerId: c?.ownerId ?? "",
      status: c?.status ?? "DRAFT",
      estimatedCost: c?.estimatedCost !== null && c?.estimatedCost !== undefined ? String(c.estimatedCost) : "",
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        type: form.type,
        config: form.config,
        priority: form.priority,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        recurrenceType: form.recurrenceType,
        recurrenceConfig: form.recurrenceType === "NONE" ? null : form.recurrenceConfig,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        ownerId: form.ownerId || null,
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : null,
        ...(isEdit ? { status: form.status } : {}),
      };

      const res = await fetch(isEdit ? `/api/campaigns/${campaign!.id}` : "/api/campaigns", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível salvar a campanha");
      }
      const { campaign: saved } = await res.json();
      toast.success(isEdit ? "Campanha atualizada" : "Campanha criada — atribua-a a um destino na aba Atribuições");
      onSaved(saved);
      if (!isEdit) setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  function toggleWeekday(day: number) {
    const current = form.recurrenceConfig.daysOfWeek ?? [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort();
    setForm({ ...form, recurrenceConfig: { ...form.recurrenceConfig, daysOfWeek: next } });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar campanha" : "Nova campanha"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Ajuste o destino, agendamento e a quem esta campanha se aplica."
              : "Defina o destino e o agendamento. Você atribui a quem ela se aplica depois de criar."}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="details" className="px-4">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1">
              Detalhes
            </TabsTrigger>
            <TabsTrigger value="assignments" className="flex-1" disabled={!isEdit}>
              Atribuições {isEdit ? `(${assignments.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="rules" className="flex-1" disabled={!isEdit}>
              Regras {isEdit ? `(${rules.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="variants" className="flex-1" disabled={!isEdit}>
              A/B {isEdit ? `(${variants.length})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <form onSubmit={handleSubmit} className="space-y-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Nome</Label>
                <Input
                  id="campaign-name"
                  required
                  minLength={2}
                  disabled={!canManage}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Black Friday 2026"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign-description">Descrição (opcional)</Label>
                <Textarea
                  id="campaign-description"
                  rows={2}
                  disabled={!canManage}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Destino</Label>
                <DestinationPicker value={form.type} onChange={(type) => setForm({ ...form, type, config: {} })} />
              </div>

              <DestinationConfigFields
                type={form.type}
                campaignName={form.name}
                config={form.config}
                onChange={(config) => setForm({ ...form, config })}
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign-starts">Início (opcional)</Label>
                  <Input
                    id="campaign-starts"
                    type="datetime-local"
                    disabled={!canManage}
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-ends">Término (opcional)</Label>
                  <Input
                    id="campaign-ends"
                    type="datetime-local"
                    disabled={!canManage}
                    value={form.endsAt}
                    onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Recorrência</Label>
                <Select
                  value={form.recurrenceType}
                  onValueChange={(v: RecurrenceType) => setForm({ ...form, recurrenceType: v })}
                  disabled={!canManage}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Nenhuma</SelectItem>
                    <SelectItem value="DAILY">Diária</SelectItem>
                    <SelectItem value="WEEKLY">Semanal</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Verificado em tempo real pelo Motor de Regras, no fuso horário da empresa (configurável em breve —
                  hoje América/São Paulo por padrão).
                </p>
              </div>

              {form.recurrenceType !== "NONE" ? (
                <div className="space-y-3 rounded-lg border p-3">
                  {form.recurrenceType === "WEEKLY" ? (
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAY_LABEL.map((label, day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleWeekday(day)}
                          disabled={!canManage}
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            form.recurrenceConfig.daysOfWeek?.includes(day)
                              ? "border-primary bg-primary text-primary-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="time"
                      disabled={!canManage}
                      value={form.recurrenceConfig.startTime ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, recurrenceConfig: { ...form.recurrenceConfig, startTime: e.target.value } })
                      }
                    />
                    <Input
                      type="time"
                      disabled={!canManage}
                      value={form.recurrenceConfig.endTime ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, recurrenceConfig: { ...form.recurrenceConfig, endTime: e.target.value } })
                      }
                    />
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign-priority">Prioridade</Label>
                  <Input
                    id="campaign-priority"
                    type="number"
                    min={0}
                    max={100}
                    disabled={!canManage}
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-estimated-cost">Custo estimado (R$)</Label>
                  <Input
                    id="campaign-estimated-cost"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Opcional — para ROI Mode"
                    disabled={!canManage}
                    value={form.estimatedCost}
                    onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })}
                  />
                </div>
                {isEdit ? (
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v: typeof form.status) => setForm({ ...form, status: v })}
                      disabled={!canManage}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Rascunho</SelectItem>
                        <SelectItem value="ACTIVE">Ativa</SelectItem>
                        <SelectItem value="PAUSED">Pausada</SelectItem>
                        <SelectItem value="ARCHIVED">Arquivada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign-tags">Tags (separadas por vírgula)</Label>
                <Input
                  id="campaign-tags"
                  disabled={!canManage}
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="Ex: sazonal, marketing"
                />
              </div>

              <div className="space-y-2">
                <Label>Responsável (opcional)</Label>
                <Select
                  value={form.ownerId || "none"}
                  onValueChange={(v) => setForm({ ...form, ownerId: v === "none" ? "" : v })}
                  disabled={!canManage}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Ninguém" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguém</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name || m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {canManage ? (
                <SheetFooter className="px-0">
                  <Button type="submit" disabled={saving} className="w-full">
                    {saving ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar campanha"}
                  </Button>
                </SheetFooter>
              ) : null}
            </form>
          </TabsContent>

          <TabsContent value="assignments" className="py-4">
            {isEdit ? (
              loadingAssignments ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : (
                <AssignmentManager
                  campaignId={campaign!.id}
                  initialAssignments={assignments}
                  branches={branches}
                  zones={zones}
                  cards={cards}
                  organizationId={organizationId}
                  canManage={canManage}
                  canManageStructure={canManageStructure}
                  onZoneCreated={onZoneCreated}
                  onBranchCreated={onBranchCreated}
                />
              )
            ) : null}
          </TabsContent>

          <TabsContent value="rules" className="py-4">
            {isEdit ? (
              loadingRules ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : (
                <RuleManager campaignId={campaign!.id} initialRules={rules} canManage={canManage} />
              )
            ) : null}
          </TabsContent>

          <TabsContent value="variants" className="py-4">
            {isEdit ? (
              loadingVariants ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : (
                <VariantManager
                  campaignId={campaign!.id}
                  campaignType={form.type}
                  campaignName={form.name}
                  initialVariants={variants}
                  canManage={canManage}
                />
              )
            ) : null}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
