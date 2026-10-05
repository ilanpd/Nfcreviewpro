"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseSerial } from "@/domain/plates/serial";

export type PickValue =
  | { mode: "NONE" }
  | { mode: "AUTO"; modelId: string }
  | { mode: "LOT"; batchId: string }
  | { mode: "SERIALS"; serials: string[] };

export interface StockModel {
  id: string;
  name: string;
  inStock: number;
}

export interface StockLot {
  id: string;
  code: string;
  modelId: string;
  modelName: string;
  inStock: number;
}

/** O que mandar para a API (`undefined` = sem placa do estoque, comportamento de sempre). */
export function pickToPayload(value: PickValue) {
  if (value.mode === "AUTO") return value.modelId ? { mode: "AUTO" as const, modelId: value.modelId } : undefined;
  if (value.mode === "LOT") return value.batchId ? { mode: "LOT" as const, batchId: value.batchId } : undefined;
  if (value.mode === "SERIALS") return { mode: "SERIALS" as const, serials: value.serials.map((s) => s.trim()) };
  return undefined;
}

/** Pronto para enviar: números todos preenchidos e no formato, ou um modelo/lote escolhido. */
export function isPickReady(value: PickValue, needed: number): boolean {
  if (value.mode === "NONE") return true;
  if (value.mode === "AUTO") return value.modelId !== "";
  if (value.mode === "LOT") return value.batchId !== "";
  return value.serials.length === needed && value.serials.every((s) => parseSerial(s) !== null);
}

const MODES = [
  { mode: "NONE", label: "Sem placa do estoque", hint: "Produzir sob demanda" },
  { mode: "LOT", label: "De um lote", hint: "Você escolhe o lote; sai a mais antiga dele" },
  { mode: "AUTO", label: "Automático", hint: "A mais antiga conferida do modelo" },
  { mode: "SERIALS", label: "Informar o nº", hint: "Quando a placa já está na sua mão" },
] as const;

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

/** Carrega modelos e lotes com estoque conferido (uma vez por uso). */
export function useStock() {
  const [state, setState] = useState<{ models: StockModel[]; lots: StockLot[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/plates/stock")
      .then((res) => res.json())
      .then((data) => !cancelled && setState({ models: data.models ?? [], lots: data.lots ?? [] }))
      .catch(() => !cancelled && setState({ models: [], lots: [] }));
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

/**
 * Escolha de onde sai a placa física de uma venda: de um LOTE que você escolhe
 * (a mais antiga dele), do estoque do modelo (a mais antiga conferida), ou pelo
 * número impresso nela. Usada na venda direta e na atribuição a um pedido pago.
 */
export function PlatePicker({ needed, allowNone, value, onChange, idPrefix }: { needed: number; allowNone: boolean; value: PickValue; onChange: (value: PickValue) => void; idPrefix: string }) {
  const stock = useStock();
  const models = stock?.models ?? null;
  const lots = stock?.lots ?? null;

  const modes = MODES.filter((m) => allowNone || m.mode !== "NONE");
  const totalInStock = (models ?? []).reduce((sum, m) => sum + m.inStock, 0);

  const defaultModelId = (list: StockModel[]) => list.find((m) => m.inStock >= needed)?.id ?? list[0]?.id ?? "";
  const defaultLotId = (list: StockLot[]) => list.find((l) => l.inStock >= needed)?.id ?? list[0]?.id ?? "";

  // Quem escolhe "automático" ou "de um lote" antes de a lista chegar fica com o
  // campo vazio e o botão travado; assim que a lista carrega, a melhor opção entra sozinha.
  useEffect(() => {
    if (!stock) return;
    if (value.mode === "AUTO" && value.modelId === "") {
      const id = defaultModelId(stock.models);
      if (id) onChange({ mode: "AUTO", modelId: id });
    }
    if (value.mode === "LOT" && value.batchId === "") {
      const id = defaultLotId(stock.lots);
      if (id) onChange({ mode: "LOT", batchId: id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reage só à chegada da lista e à troca de modo
  }, [stock, value.mode]);

  function setMode(mode: PickValue["mode"]) {
    if (mode === "NONE") onChange({ mode });
    else if (mode === "AUTO") onChange({ mode, modelId: models ? defaultModelId(models) : "" });
    else if (mode === "LOT") onChange({ mode, batchId: lots ? defaultLotId(lots) : "" });
    else onChange({ mode, serials: Array.from({ length: needed }, (_, i) => (value.mode === "SERIALS" ? (value.serials[i] ?? "") : "")) });
  }

  return (
    <div className="space-y-2">
      <Label>Placa física</Label>
      <div role="group" aria-label="De onde sai a placa" className="grid gap-2 sm:grid-cols-2">
        {modes.map((m) => (
          <button
            key={m.mode}
            type="button"
            aria-pressed={value.mode === m.mode}
            onClick={() => setMode(m.mode)}
            className={cn("rounded-lg border p-2.5 text-left text-xs transition-colors", value.mode === m.mode ? "border-brand bg-brand-subtle" : "hover:bg-muted")}
          >
            <span className="block text-sm font-medium">{m.label}</span>
            <span className="block text-muted-foreground">{m.hint}</span>
          </button>
        ))}
      </div>

      {models !== null && value.mode === "NONE" && totalInStock > 0 ? (
        <p className="text-xs text-muted-foreground">Há {totalInStock} placa{totalInStock === 1 ? "" : "s"} conferida{totalInStock === 1 ? "" : "s"} em estoque.</p>
      ) : null}

      {value.mode === "LOT" ? (
        <div className="space-y-1">
          <select id={`${idPrefix}-lot`} aria-label="Lote da placa" value={value.batchId} onChange={(e) => onChange({ mode: "LOT", batchId: e.target.value })} className={selectClassName}>
            {(lots ?? []).map((l) => (
              <option key={l.id} value={l.id} disabled={l.inStock < needed}>
                {l.code} · {l.modelName} — {l.inStock} em estoque
              </option>
            ))}
          </select>
          {lots !== null && !lots.some((l) => l.inStock >= needed) ? (
            <p role="alert" className="text-xs text-destructive">
              Nenhum lote tem {needed} placa{needed === 1 ? "" : "s"} conferida{needed === 1 ? "" : "s"} e sem dono. Confira um lote em Estoque de placas, ou use a opção por número.
            </p>
          ) : null}
        </div>
      ) : null}

      {value.mode === "AUTO" ? (
        <div className="space-y-1">
          <select id={`${idPrefix}-model`} aria-label="Modelo da placa" value={value.modelId} onChange={(e) => onChange({ mode: "AUTO", modelId: e.target.value })} className={selectClassName}>
            {(models ?? []).map((m) => (
              <option key={m.id} value={m.id} disabled={m.inStock < needed}>
                {m.name} — {m.inStock} em estoque
              </option>
            ))}
          </select>
          {models !== null && !models.some((m) => m.inStock >= needed) ? (
            <p role="alert" className="text-xs text-destructive">
              Nenhum modelo tem {needed} placa{needed === 1 ? "" : "s"} conferida{needed === 1 ? "" : "s"} em estoque. Gere e confira um lote em Estoque de placas, ou use a opção por número.
            </p>
          ) : null}
        </div>
      ) : null}

      {value.mode === "SERIALS" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {value.serials.map((serial, i) => {
            const filled = serial.trim() !== "";
            const valid = parseSerial(serial) !== null;
            return (
              <div key={i} className="space-y-1">
                <Label htmlFor={`${idPrefix}-serial-${i}`} className="text-xs">
                  Placa {needed > 1 ? i + 1 : ""} (ex.: L001-07)
                </Label>
                <Input
                  id={`${idPrefix}-serial-${i}`}
                  value={serial}
                  autoCapitalize="characters"
                  aria-invalid={filled && !valid}
                  onChange={(e) => onChange({ mode: "SERIALS", serials: value.serials.map((s, j) => (j === i ? e.target.value : s)) })}
                />
                {filled && !valid ? <p className="text-xs text-destructive">Formato inválido. Use o número impresso na placa, como L001-07.</p> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
