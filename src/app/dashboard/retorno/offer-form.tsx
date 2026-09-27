"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AnalyticsCard } from "@nfc-os/ui";

export interface OfferFormValues {
  title: string;
  description: string | null;
  windowDays: number;
  cooldownDays: number;
  dailyCap: number | null;
  primaryUrl: string | null;
  active: boolean;
}

/**
 * Configuração do brinde de retorno (ADR-081). O texto passa pela mesma
 * validação do servidor (nunca pode citar avaliação — ver
 * domain/return-offer/compliance.ts); o erro de validação some direto do
 * corpo da resposta, sem reescrever a regra aqui.
 *
 * `hasPin` chega como prop separada (nunca copiada para o estado local): o
 * formulário do PIN dá \`router.refresh()\` ao salvar, e um valor guardado em
 * \`useState\` não seria atualizado por um novo valor de prop depois da
 * montagem — o interruptor "ativo" precisa sempre do \`hasPin\` mais recente.
 */
export function OfferForm({
  initial,
  hasPin,
  offerExists,
  canManage,
  canActivate,
}: {
  initial: OfferFormValues;
  hasPin: boolean;
  offerExists: boolean;
  canManage: boolean;
  canActivate: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/return/offer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          windowDays: form.windowDays,
          cooldownDays: form.cooldownDays,
          dailyCap: form.dailyCap,
          primaryUrl: form.primaryUrl || null,
          active: form.active,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fieldError = data.issues?.fieldErrors && Object.values(data.issues.fieldErrors).flat()[0];
        throw new Error((fieldError as string) ?? data.error ?? "Não foi possível salvar");
      }
      toast.success("Brinde salvo — vale para os próximos toques; os brindes já emitidos mantêm o combinado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnalyticsCard title="O brinde" description="O que o cliente ganha ao tocar o cartão, e por quanto tempo.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="title">O que o cliente ganha</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Hidratação grátis"
            disabled={!canManage}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Detalhe (opcional)</Label>
          <Textarea
            id="description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Válido só para uso no salão"
            disabled={!canManage}
            rows={2}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="windowDays">Validade depois de liberar (dias)</Label>
            <Input
              id="windowDays"
              type="number"
              min={1}
              max={90}
              value={form.windowDays}
              onChange={(e) => setForm({ ...form, windowDays: Number(e.target.value) })}
              disabled={!canManage}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cooldownDays">Carência até o próximo brinde (dias)</Label>
            <Input
              id="cooldownDays"
              type="number"
              min={0}
              max={365}
              value={form.cooldownDays}
              onChange={(e) => setForm({ ...form, cooldownDays: Number(e.target.value) })}
              disabled={!canManage}
              required
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dailyCap">Teto de brindes por dia (opcional)</Label>
            <Input
              id="dailyCap"
              type="number"
              min={1}
              value={form.dailyCap ?? ""}
              onChange={(e) => setForm({ ...form, dailyCap: e.target.value ? Number(e.target.value) : null })}
              placeholder="Sem teto"
              disabled={!canManage}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primaryUrl">Botão principal da tela (opcional)</Label>
            <Input
              id="primaryUrl"
              type="url"
              value={form.primaryUrl ?? ""}
              onChange={(e) => setForm({ ...form, primaryUrl: e.target.value })}
              placeholder="Padrão: destino do seu cartão"
              disabled={!canManage}
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Retorno ativo</p>
            <p className="text-xs text-muted-foreground">
              {hasPin
                ? "Pausar não anula brindes já emitidos."
                : offerExists
                  ? "Defina o PIN da loja ao lado antes de ativar."
                  : "Salve o brinde para poder definir o PIN e ativar."}
            </p>
          </div>
          <Switch
            checked={form.active}
            disabled={!canManage || (!hasPin && !form.active) || !canActivate}
            onCheckedChange={(active) => setForm({ ...form, active })}
          />
        </div>
        {canManage ? (
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Salvando…" : "Salvar brinde"}
          </Button>
        ) : null}
      </form>
    </AnalyticsCard>
  );
}
