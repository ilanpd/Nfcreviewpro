"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, MapPin, Plus, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BranchListItem, ZoneListItem } from "@/types";
import { EmptyState, PremiumModal } from "@nfc-os/ui";

interface AccessScopeItem {
  id: string;
  branchId: string | null;
  zoneId: string | null;
  branch: { id: string; name: string } | null;
  zone: { id: string; name: string } | null;
}

interface AccessScopeManagerProps {
  memberId: string;
  memberName: string;
  branches: BranchListItem[];
  zones: ZoneListItem[];
  trigger: React.ReactNode;
}

type Kind = "BRANCH" | "ZONE";

export function AccessScopeManager({ memberId, memberName, branches, zones, trigger }: AccessScopeManagerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scopes, setScopes] = useState<AccessScopeItem[]>([]);
  const [kind, setKind] = useState<Kind>("BRANCH");
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/team/${memberId}/access-scopes`)
      .then((res) => res.json())
      .then((data) => setScopes(data.scopes ?? []))
      .catch(() => toast.error("Não foi possível carregar as restrições de acesso"))
      .finally(() => setLoading(false));
  }, [open, memberId]);

  async function handleAdd() {
    if (!targetId) return;
    setSaving(true);
    try {
      const body = kind === "BRANCH" ? { branchId: targetId } : { zoneId: targetId };
      const res = await fetch(`/api/team/${memberId}/access-scopes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível adicionar a restrição");
      }
      const { scope } = await res.json();
      setScopes((prev) => [...prev, scope]);
      setTargetId("");
      toast.success("Acesso restringido");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(scopeId: string) {
    try {
      const res = await fetch(`/api/team/${memberId}/access-scopes/${scopeId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setScopes((prev) => prev.filter((s) => s.id !== scopeId));
      toast.success("Restrição removida");
    } catch {
      toast.error("Não foi possível remover a restrição");
    }
  }

  const options = kind === "BRANCH" ? branches : zones;

  return (
    <>
      <span className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      <PremiumModal
        open={open}
        onOpenChange={setOpen}
        icon={Shield}
        title={`Acesso de ${memberName}`}
        description="Sem restrições, este membro acessa tudo que o cargo dele permite. Adicionar uma ou mais unidades/zonas aqui restringe o acesso apenas a elas."
      >
        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : scopes.length === 0 ? (
            <EmptyState
              icon={<Shield />}
              title="Acesso completo, conforme o cargo"
              description="Sem restrições — adicione uma unidade ou zona abaixo para limitar o que este membro vê."
            />
          ) : (
            <ul className="space-y-2">
              {scopes.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    {s.branchId ? (
                      <Building2 className="size-4 text-muted-foreground" />
                    ) : (
                      <MapPin className="size-4 text-muted-foreground" />
                    )}
                    <span>{s.branch?.name ?? s.zone?.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => handleRemove(s.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 rounded-lg border p-3">
            <Select
              value={kind}
              onValueChange={(v: Kind) => {
                setKind(v);
                setTargetId("");
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRANCH">Unidade</SelectItem>
                <SelectItem value="ZONE">Zona</SelectItem>
              </SelectContent>
            </Select>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="flex-1 min-w-40">
                <SelectValue placeholder="Selecionar…" />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAdd} disabled={!targetId || saving} className="ml-auto">
              <Plus className="size-3.5" /> Restringir
            </Button>
          </div>
        </div>
      </PremiumModal>
    </>
  );
}
