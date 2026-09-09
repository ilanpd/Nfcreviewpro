"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Building2, CreditCard, Globe2, MapPin, Plus, Store, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SCOPE_LABEL } from "@/domain/campaign/assignment";
import type { CampaignAssignmentItem, BranchListItem, ZoneListItem } from "@/types";
import type { CardWithStats } from "@/types";
import type { TargetScope } from "@/generated/prisma/client";

const SCOPE_ICON: Record<TargetScope, typeof Building2> = {
  ORGANIZATION: Globe2,
  COMPANY: Store,
  BRANCH: Building2,
  ZONE: MapPin,
  CARD: CreditCard,
};

interface AssignmentManagerProps {
  campaignId: string;
  initialAssignments: CampaignAssignmentItem[];
  branches: BranchListItem[];
  zones: ZoneListItem[];
  cards: CardWithStats[];
  /** Null when this company doesn't belong to an Organization — in that
   * case ORGANIZATION scope isn't offered at all, there's nothing for it to
   * reach across. See ADR-013. */
  organizationId: string | null;
  canManage: boolean;
  /** Creating a new Branch/Zone is a structural (settings-level) change,
   * distinct from campaign:write — a Marketing/Manager user can manage
   * assignments without being able to invent new units/zones inline. */
  canManageStructure: boolean;
  onZoneCreated: (zone: ZoneListItem) => void;
  onBranchCreated: (branch: BranchListItem) => void;
  /** Lets the campaign list/tab-count outside this drawer stay in sync —
   * this component owns its own `assignments` list for rendering, but
   * nothing else observes it otherwise (see the bug this closed: creating
   * or removing an assignment left the list's "Atribuições" column and the
   * tab label stuck at the count from when the drawer first opened). */
  onAssignmentsChange?: (assignments: CampaignAssignmentItem[]) => void;
}

export function AssignmentManager({
  campaignId,
  initialAssignments,
  branches,
  zones,
  cards,
  organizationId,
  canManage,
  canManageStructure,
  onZoneCreated,
  onBranchCreated,
  onAssignmentsChange,
}: AssignmentManagerProps) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [scope, setScope] = useState<TargetScope>("COMPANY");
  const [targetId, setTargetId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState<"BRANCH" | "ZONE" | null>(null);
  const [quickAddName, setQuickAddName] = useState("");

  const availableScopes = (Object.keys(SCOPE_LABEL) as TargetScope[]).filter(
    (s) => s !== "ORGANIZATION" || organizationId
  );

  async function handleAdd() {
    setSaving(true);
    try {
      const body: Record<string, string> = { scope };
      if (scope === "ORGANIZATION") body.organizationId = organizationId!;
      if (scope === "BRANCH") body.branchId = targetId;
      if (scope === "ZONE") body.zoneId = targetId;
      if (scope === "CARD") body.cardId = targetId;

      const res = await fetch(`/api/campaigns/${campaignId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível criar a atribuição");
      }
      const { assignment } = await res.json();
      setAssignments((prev) => {
        const next = [...prev, assignment];
        onAssignmentsChange?.(next);
        return next;
      });
      setTargetId("");
      toast.success("Atribuição criada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(assignmentId: string) {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/assignments/${assignmentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setAssignments((prev) => {
        const next = prev.filter((a) => a.id !== assignmentId);
        onAssignmentsChange?.(next);
        return next;
      });
      toast.success("Atribuição removida");
    } catch {
      toast.error("Não foi possível remover a atribuição");
    }
  }

  async function handleQuickAdd() {
    if (!quickAddName.trim() || !quickAddOpen) return;
    setSaving(true);
    try {
      const url = quickAddOpen === "BRANCH" ? "/api/branches" : "/api/zones";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: quickAddName.trim() }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (quickAddOpen === "BRANCH") {
        onBranchCreated(data.branch);
        setTargetId(data.branch.id);
      } else {
        onZoneCreated(data.zone);
        setTargetId(data.zone.id);
      }
      setQuickAddName("");
      setQuickAddOpen(null);
    } catch {
      toast.error("Não foi possível criar");
    } finally {
      setSaving(false);
    }
  }

  function targetLabel(a: CampaignAssignmentItem): string {
    if (a.scope === "ORGANIZATION") return "Toda a organização";
    if (a.scope === "COMPANY") return "Toda a empresa";
    if (a.scope === "BRANCH") return a.branch?.name ?? "—";
    if (a.scope === "ZONE") return a.zone?.name ?? "—";
    return a.card?.name ?? "—";
  }

  const targetOptions = scope === "BRANCH" ? branches : scope === "ZONE" ? zones : scope === "CARD" ? cards : [];
  const needsTarget = scope === "BRANCH" || scope === "ZONE" || scope === "CARD";

  return (
    <div className="space-y-4">
      {assignments.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Nenhuma atribuição ainda — sem atribuições, esta campanha não é exibida para ninguém.
        </p>
      ) : (
        <ul className="space-y-2">
          {assignments.map((a) => {
            const Icon = SCOPE_ICON[a.scope];
            return (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center gap-2 truncate">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    <span className="text-muted-foreground">{SCOPE_LABEL[a.scope]}:</span> {targetLabel(a)}
                  </span>
                </div>
                {canManage ? (
                  <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => handleRemove(a.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {canManage ? (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground">Nova atribuição</p>
          <div className="flex flex-wrap gap-2">
            <Select
              value={scope}
              onValueChange={(v: TargetScope) => {
                setScope(v);
                setTargetId("");
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableScopes.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SCOPE_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {needsTarget ? (
              quickAddOpen === scope ? (
                <div className="flex flex-1 gap-1">
                  <Input
                    autoFocus
                    placeholder={scope === "BRANCH" ? "Nome da unidade" : "Nome da zona"}
                    value={quickAddName}
                    onChange={(e) => setQuickAddName(e.target.value)}
                    className="h-9"
                  />
                  <Button size="sm" onClick={handleQuickAdd} disabled={saving}>
                    Criar
                  </Button>
                </div>
              ) : (
                <>
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger className="flex-1 min-w-40">
                      <SelectValue placeholder="Selecionar…" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {canManageStructure && (scope === "BRANCH" || scope === "ZONE") ? (
                    <Button variant="outline" size="sm" onClick={() => setQuickAddOpen(scope)}>
                      <Plus className="size-3.5" />
                    </Button>
                  ) : null}
                </>
              )
            ) : null}

            <Button size="sm" onClick={handleAdd} disabled={saving || (needsTarget && !targetId)} className="ml-auto">
              Atribuir
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
