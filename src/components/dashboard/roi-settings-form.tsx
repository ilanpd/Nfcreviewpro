"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Company } from "@/generated/prisma/client";
import { AnalyticsCard } from "@nfc-os/ui";

/**
 * ROI Mode (Fase 7) — configuração única que transforma toques/conversões
 * em dinheiro estimado no Analytics Enterprise. Os três campos só entram em
 * vigor juntos (ver domain/analytics/roi.ts); salvar só um deles ainda
 * mantém o ROI "não configurado" até os três existirem.
 */
export function RoiSettingsForm({ company }: { company: Company }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    avgTicket: company.roiAvgTicket !== null ? String(company.roiAvgTicket) : "",
    returnRatePercent: company.roiReturnRate !== null ? String(company.roiReturnRate * 100) : "",
    newCustomerValue: company.roiNewCustomerValue !== null ? String(company.roiNewCustomerValue) : "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roiAvgTicket: form.avgTicket ? Number(form.avgTicket) : null,
          roiReturnRate: form.returnRatePercent ? Number(form.returnRatePercent) / 100 : null,
          roiNewCustomerValue: form.newCustomerValue ? Number(form.newCustomerValue) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível salvar o ROI Mode");
      }
      toast.success("ROI Mode salvo");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnalyticsCard
      title="ROI Mode"
      description="Configure uma vez e o Analytics Enterprise passa a mostrar receita estimada, não só contagens — o argumento mais forte para renovar a assinatura."
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="avgTicket">Ticket médio (R$)</Label>
          <Input
            id="avgTicket"
            type="number"
            min={0}
            step="0.01"
            placeholder="Ex: 85.00"
            value={form.avgTicket}
            onChange={(e) => setForm({ ...form, avgTicket: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="returnRate">Taxa de retorno estimada (%)</Label>
          <Input
            id="returnRate"
            type="number"
            min={0}
            max={100}
            step="1"
            placeholder="Ex: 12"
            value={form.returnRatePercent}
            onChange={(e) => setForm({ ...form, returnRatePercent: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            De cada interação com um cartão NFC, qual % você estima que vira uma visita de retorno.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="newCustomerValue">Valor de um novo cliente (R$)</Label>
          <Input
            id="newCustomerValue"
            type="number"
            min={0}
            step="0.01"
            placeholder="Ex: 250.00"
            value={form.newCustomerValue}
            onChange={(e) => setForm({ ...form, newCustomerValue: e.target.value })}
          />
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Salvar ROI Mode"}
        </Button>
      </form>
    </AnalyticsCard>
  );
}
