"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Nome, descrição, estoque mínimo e ativo/desativado — o que NÃO precisa de uma versão nova de arte. */
export function ModelMetaForm({ model }: { model: { id: string; name: string; description: string | null; minStock: number; active: boolean } }) {
  const router = useRouter();
  const [name, setName] = useState(model.name);
  const [description, setDescription] = useState(model.description ?? "");
  const [minStock, setMinStock] = useState(String(model.minStock));
  const [active, setActive] = useState(model.active);
  const [saving, setSaving] = useState(false);

  const dirty = name !== model.name || description !== (model.description ?? "") || Number(minStock) !== model.minStock || active !== model.active;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/plates/models/${model.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description.trim() || null, minStock: Number(minStock) || 0, active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar");
      toast.success("Modelo atualizado.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end">
      <div className="space-y-1">
        <Label htmlFor="meta-name" className="text-xs">
          Nome
        </Label>
        <Input id="meta-name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="meta-desc" className="text-xs">
          Descrição (opcional)
        </Label>
        <Input id="meta-desc" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="meta-min" className="text-xs">
          Estoque mínimo
        </Label>
        <Input id="meta-min" type="number" inputMode="numeric" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4" />
          Ativo
        </label>
        <Button type="submit" size="sm" disabled={saving || !dirty}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
