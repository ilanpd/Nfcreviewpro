"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { NFCCard } from "@/generated/prisma/client";
import type { BranchListItem, ZoneListItem } from "@/types";
import { PremiumModal } from "@nfc-os/ui";

interface CardFormDialogProps {
  card?: NFCCard;
  trigger: React.ReactNode;
  branches: BranchListItem[];
  zones: ZoneListItem[];
  onSaved: (card: NFCCard) => void;
}

const NONE = "none";

export function CardFormDialog({ card, trigger, branches, zones, onSaved }: CardFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(card?.name ?? "");
  const [tags, setTags] = useState(card?.tags.join(", ") ?? "");
  const [branchId, setBranchId] = useState(card?.branchId ?? NONE);
  const [zoneId, setZoneId] = useState(card?.zoneId ?? NONE);

  useEffect(() => {
    if (open) {
      setName(card?.name ?? "");
      setTags(card?.tags.join(", ") ?? "");
      setBranchId(card?.branchId ?? NONE);
      setZoneId(card?.zoneId ?? NONE);
    }
  }, [open, card]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(card ? `/api/cards/${card.id}` : "/api/cards", {
        method: card ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          tags: tagList,
          ...(card ? { branchId: branchId === NONE ? null : branchId, zoneId: zoneId === NONE ? null : zoneId } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível salvar o cartão");
      }
      const { card: saved } = await res.json();
      toast.success(card ? "Cartão atualizado" : "Cartão criado");
      onSaved(saved);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <span className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      <PremiumModal
        open={open}
        onOpenChange={setOpen}
        icon={CreditCard}
        title={card ? "Editar cartão" : "Novo cartão NFC"}
        footer={
          <Button type="submit" form="card-form" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        }
      >
        <form id="card-form" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="card-name">Nome</Label>
              <Input
                id="card-name"
                placeholder="Ex: Mesa 10, Recepção, Garçom Carlos"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-tags">Tags (separadas por vírgula)</Label>
              <Input
                id="card-tags"
                placeholder="Ex: salão, equipe"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>

            {card ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhuma</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Zona</Label>
                  <Select value={zoneId} onValueChange={setZoneId}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhuma</SelectItem>
                      {zones.map((z) => (
                        <SelectItem key={z.id} value={z.id}>
                          {z.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">
                  Usado para direcionar campanhas por unidade ou zona (ex: uma promoção só para as mesas da VIP).
                  Crie unidades e zonas na aba Atribuições de uma campanha.
                </p>
              </div>
            ) : null}
          </div>
        </form>
      </PremiumModal>
    </>
  );
}
