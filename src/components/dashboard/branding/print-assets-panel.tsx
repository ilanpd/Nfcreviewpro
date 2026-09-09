"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { AnalyticsCard } from "@nfc-os/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRINT_TEMPLATES, PRINT_TEMPLATE_IDS } from "@/domain/white-label/print-templates";

/**
 * Impressão Profissional (Fase 10, bônus) — baixa o PDF real de
 * `/api/cards/:id/print`, já com a marca salva da empresa (não o rascunho
 * do Theme Studio — imprimir usa a versão salva, para nunca imprimir algo
 * que não foi confirmado). Escolher a cor e clicar "Salvar" antes de
 * baixar é o fluxo esperado, o mesmo de qualquer editor.
 */
export function PrintAssetsPanel({ cards }: { cards: { id: string; name: string }[] }) {
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");

  if (cards.length === 0) {
    return (
      <AnalyticsCard title="Ativos de impressão" description="Crie ao menos um cartão para gerar adesivos, cartões PVC e displays de mesa.">
        <p className="text-sm text-muted-foreground">Nenhum cartão NFC cadastrado ainda.</p>
      </AnalyticsCard>
    );
  }

  return (
    <AnalyticsCard title="Ativos de impressão" description="PDFs prontos para impressão profissional, com sua marca salva.">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Cartão</label>
          <Select value={cardId} onValueChange={setCardId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cards.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {PRINT_TEMPLATE_IDS.map((id) => {
            const template = PRINT_TEMPLATES[id];
            return (
              <a
                key={id}
                href={`/api/cards/${cardId}/print?template=${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm hover:border-brand hover:bg-brand-subtle"
              >
                <div>
                  <p className="font-medium text-foreground">{template.label}</p>
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                </div>
                <Download className="size-4 shrink-0 text-muted-foreground" />
              </a>
            );
          })}
        </div>
      </div>
    </AnalyticsCard>
  );
}
