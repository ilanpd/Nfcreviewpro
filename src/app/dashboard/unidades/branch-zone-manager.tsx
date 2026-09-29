"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X, Building2, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AnalyticsCard } from "@nfc-os/ui";
import type { Branch, Zone } from "@/generated/prisma/client";

const NO_BRANCH = "none";

interface BranchZoneManagerProps {
  initialBranches: Branch[];
  initialZones: Zone[];
  canManage: boolean;
}

/**
 * Motor de Ativação (Fase 18, achado na revisão noturna) — a primeira tela
 * de dashboard para Branch/Zone desde que o modelo existe (Fase 4). CRUD
 * simples de propósito: renomear é edição inline, criar é um formulário
 * fixo no topo de cada lista — nada além do que a API já suportava.
 */
export function BranchZoneManager({ initialBranches, initialZones, canManage }: BranchZoneManagerProps) {
  const [branches, setBranches] = useState(initialBranches);
  const [zones, setZones] = useState(initialZones);
  const [newBranchName, setNewBranchName] = useState("");
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneBranchId, setNewZoneBranchId] = useState<string>(NO_BRANCH);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);
  // Substitui os dois window.confirm() originais (Auditoria Nível
  // Bilionário, 11/09/2026) — o resto do produto já usa Dialog de verdade
  // para confirmação de exclusão; só esta tela ainda usava o nativo do
  // navegador.
  const [confirmDelete, setConfirmDelete] = useState<{ kind: "branch" | "zone"; id: string; name: string } | null>(null);

  async function createBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBranchName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível criar a unidade");
      setBranches((prev) => [...prev, data.branch]);
      setNewBranchName("");
      toast.success("Unidade criada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function renameBranch(id: string) {
    if (!editValue.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/branches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível renomear");
      setBranches((prev) => prev.map((b) => (b.id === id ? data.branch : b)));
      setEditingBranchId(null);
      toast.success("Unidade renomeada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function deleteBranch(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/branches/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível excluir");
      }
      setBranches((prev) => prev.filter((b) => b.id !== id));
      setZones((prev) => prev.map((z) => (z.branchId === id ? { ...z, branchId: null } : z)));
      toast.success("Unidade excluída");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function createZone(e: React.FormEvent) {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newZoneName, branchId: newZoneBranchId === NO_BRANCH ? null : newZoneBranchId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível criar a zona");
      setZones((prev) => [...prev, data.zone]);
      setNewZoneName("");
      setNewZoneBranchId(NO_BRANCH);
      toast.success("Zona criada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function renameZone(id: string) {
    if (!editValue.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/zones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível renomear");
      setZones((prev) => prev.map((z) => (z.id === id ? data.zone : z)));
      setEditingZoneId(null);
      toast.success("Zona renomeada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function changeZoneBranch(id: string, branchId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/zones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: branchId === NO_BRANCH ? null : branchId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível mover a zona");
      setZones((prev) => prev.map((z) => (z.id === id ? data.zone : z)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function deleteZone(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/zones/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível excluir");
      }
      setZones((prev) => prev.filter((z) => z.id !== id));
      toast.success("Zona excluída");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(id: string, currentName: string, kind: "branch" | "zone") {
    setEditValue(currentName);
    if (kind === "branch") setEditingBranchId(id);
    else setEditingZoneId(id);
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    if (confirmDelete.kind === "branch") await deleteBranch(confirmDelete.id);
    else await deleteZone(confirmDelete.id);
    setConfirmDelete(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <AnalyticsCard title="Unidades" description="Locais físicos separados da mesma empresa.">
        <div className="space-y-3">
          {canManage ? (
            <form onSubmit={createBranch} className="flex gap-2">
              <Input placeholder="Ex: Unidade Centro" value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)} />
              <Button type="submit" size="sm" disabled={busy}>
                <Plus className="size-3.5" /> Adicionar
              </Button>
            </form>
          ) : null}

          {branches.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma unidade cadastrada ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {branches.map((branch) => (
                <li key={branch.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                  {editingBranchId === branch.id ? (
                    <>
                      <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-7 flex-1" autoFocus />
                      <Button size="icon" variant="ghost" className="size-6" aria-label="Salvar nome da unidade" onClick={() => renameBranch(branch.id)}>
                        <Check className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-6" aria-label="Cancelar edição" onClick={() => setEditingBranchId(null)}>
                        <X className="size-3.5" aria-hidden="true" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 truncate">{branch.name}</span>
                      {canManage ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label={`Renomear unidade ${branch.name}`}
                            onClick={() => startEdit(branch.id, branch.name, "branch")}
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label={`Remover unidade ${branch.name}`}
                            onClick={() => setConfirmDelete({ kind: "branch", id: branch.id, name: branch.name })}
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        </>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </AnalyticsCard>

      <AnalyticsCard title="Zonas" description="Setores dentro de uma unidade (ou da empresa toda, se não tiver unidades).">
        <div className="space-y-3">
          {canManage ? (
            <form onSubmit={createZone} className="space-y-2">
              <div className="flex gap-2">
                <Input placeholder="Ex: Varanda" value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)} />
                <Button type="submit" size="sm" disabled={busy}>
                  <Plus className="size-3.5" /> Adicionar
                </Button>
              </div>
              {branches.length > 0 ? (
                <Select value={newZoneBranchId} onValueChange={setNewZoneBranchId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_BRANCH}>Sem unidade (empresa toda)</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </form>
          ) : null}

          {zones.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma zona cadastrada ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {zones.map((zone) => (
                <li key={zone.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <MapPinned className="size-3.5 shrink-0 text-muted-foreground" />
                  {editingZoneId === zone.id ? (
                    <>
                      <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-7 flex-1" autoFocus />
                      <Button size="icon" variant="ghost" className="size-6" aria-label="Salvar nome da zona" onClick={() => renameZone(zone.id)}>
                        <Check className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-6" aria-label="Cancelar edição" onClick={() => setEditingZoneId(null)}>
                        <X className="size-3.5" aria-hidden="true" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 truncate">{zone.name}</span>
                      {canManage && branches.length > 0 ? (
                        <Select value={zone.branchId ?? NO_BRANCH} onValueChange={(v) => changeZoneBranch(zone.id, v)}>
                          <SelectTrigger className="h-6 w-32 text-[11px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_BRANCH}>Sem unidade</SelectItem>
                            {branches.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}
                      {canManage ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label={`Renomear zona ${zone.name}`}
                            onClick={() => startEdit(zone.id, zone.name, "zone")}
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label={`Remover zona ${zone.name}`}
                            onClick={() => setConfirmDelete({ kind: "zone", id: zone.id, name: zone.name })}
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        </>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </AnalyticsCard>

      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {confirmDelete?.kind === "branch" ? "unidade" : "zona"} &quot;{confirmDelete?.name}&quot;?</DialogTitle>
            <DialogDescription>
              {confirmDelete?.kind === "branch"
                ? "Zonas e cartões ligados a ela continuam existindo, só perdem essa unidade."
                : "Campanhas atribuídas especificamente a ela deixam de valer."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={busy} onClick={handleConfirmDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
