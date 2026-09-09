"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DestinationConfigFields } from "./destination-config-fields";
import type { CampaignType } from "@/generated/prisma/client";

interface VariantItem {
  id: string;
  name: string;
  weight: number;
  config: unknown;
}

interface VariantManagerProps {
  campaignId: string;
  campaignType: CampaignType;
  campaignName: string;
  initialVariants: VariantItem[];
  canManage: boolean;
}

export function VariantManager({ campaignId, campaignType, campaignName, initialVariants, canManage }: VariantManagerProps) {
  const [variants, setVariants] = useState(initialVariants);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState(50);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);

  async function handleAdd() {
    if (!name.trim()) {
      toast.error("Dê um nome à variante");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), weight, config }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível criar a variante");
      }
      const { variant } = await res.json();
      setVariants((prev) => [...prev, variant]);
      toast.success("Variante criada");
      setName("");
      setConfig({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(variantId: string) {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/variants/${variantId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setVariants((prev) => prev.filter((v) => v.id !== variantId));
      toast.success("Variante removida");
    } catch {
      toast.error("Não foi possível remover a variante");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Sem variantes, a campanha sempre usa o destino definido na aba Detalhes. Com variantes, o tráfego é dividido
        proporcionalmente aos pesos abaixo (não precisam somar 100).
      </p>

      {variants.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Nenhuma variante — teste A/B desativado para esta campanha.
        </p>
      ) : (
        <ul className="space-y-2">
          {variants.map((variant) => (
            <li key={variant.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <div className="flex items-center gap-2 truncate">
                <FlaskConical className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">{variant.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {totalWeight > 0 ? `${Math.round((variant.weight / totalWeight) * 100)}%` : "—"} (peso {variant.weight})
                </span>
              </div>
              {canManage ? (
                <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => handleRemove(variant.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground">Nova variante</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="variant-name" className="text-xs">
                Nome
              </Label>
              <Input id="variant-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Variante B" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="variant-weight" className="text-xs">
                Peso
              </Label>
              <Input
                id="variant-weight"
                type="number"
                min={1}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
              />
            </div>
          </div>

          <DestinationConfigFields type={campaignType} campaignName={campaignName} config={config} onChange={setConfig} />

          <Button size="sm" onClick={handleAdd} disabled={saving} className="w-full">
            <Plus className="size-3.5" /> Adicionar variante
          </Button>
        </div>
      ) : null}
    </div>
  );
}
