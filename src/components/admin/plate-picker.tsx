"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseSerial } from "@/domain/plates/serial";

export type PickValue = { mode: "NONE" } | { mode: "AUTO"; modelId: string } | { mode: "SERIALS"; serials: string[] };

interface StockModel {
  id: string;
  name: string;
  inStock: number;
}

/** O que mandar para a API (`undefined` = sem placa do estoque, comportamento de sempre). */
export function pickToPayload(value: PickValue) {
  if (value.mode === "AUTO") return value.modelId ? { mode: "AUTO" as const, modelId: value.modelId } : undefined;
  if (value.mode === "SERIALS") return { mode: "SERIALS" as const, serials: value.serials.map((s) => s.trim()) };
  return undefined;
}

/** Pronto para enviar: números todos preenchidos e no formato, ou um modelo escolhido. */
export function isPickReady(value: PickValue, needed: number): boolean {
  if (value.mode === "NONE") return true;
  if (value.mode === "AUTO") return value.modelId !== "";
  return value.serials.length === needed && value.serials.every((s) => parseSerial(s) !== null);
}

const MODES = [
  { mode: "NONE", label: "Sem placa do estoque", hint: "Produzir sob demanda, como antes" },
  { mode: "AUTO", label: "Do estoque (automático)", hint: "Pega as mais antigas conferidas" },
  { mode: "SERIALS", label: "Informar o nº da placa", hint: "Quando a placa já está na sua mão" },
] as const;

/**
 * Escolha de onde sai a placa física de uma venda: do estoque conferido
 * (automático, primeiro a entrar primeiro a sair) ou pelo número impresso nela.
 * Usada na venda direta e na atribuição a um pedido já pago.
 */
export function PlatePicker({ needed, allowNone, value, onChange, idPrefix }: { needed: number; allowNone: boolean; value: PickValue; onChange: (value: PickValue) => void; idPrefix: string }) {
  const [models, setModels] = useState<StockModel[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/plates/stock")
      .then((res) => res.json())
      .then((data) => !cancelled && setModels(data.models ?? []))
      .catch(() => !cancelled && setModels([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const modes = MODES.filter((m) => allowNone || m.mode !== "NONE");
  const totalInStock = (models ?? []).reduce((sum, m) => sum + m.inStock, 0);

  /** O modelo que melhor atende: o primeiro com placas suficientes, senão o primeiro da lista. */
  function defaultModelId(list: StockModel[]): string {
    return list.find((m) => m.inStock >= needed)?.id ?? list[0]?.id ?? "";
  }

  // Quem escolhe "automático" antes de a lista de modelos chegar fica com o modelo
  // vazio e o botão travado; assim que a lista carrega, o melhor modelo entra sozinho.
  useEffect(() => {
    if (models && value.mode === "AUTO" && value.modelId === "") {
      const id = defaultModelId(models);
      if (id) onChange({ mode: "AUTO", modelId: id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reage só à chegada da lista e à troca de modo
  }, [models, value.mode]);

  function setMode(mode: PickValue["mode"]) {
    if (mode === "NONE") onChange({ mode });
    else if (mode === "AUTO") onChange({ mode, modelId: models ? defaultModelId(models) : "" });
    else onChange({ mode, serials: Array.from({ length: needed }, (_, i) => (value.mode === "SERIALS" ? (value.serials[i] ?? "") : "")) });
  }

  return (
    <div className="space-y-2">
      <Label>Placa física</Label>
      <div role="group" aria-label="De onde sai a placa" className="grid gap-2 sm:grid-cols-3">
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

      {value.mode === "AUTO" ? (
        <div className="space-y-1">
          <select
            id={`${idPrefix}-model`}
            aria-label="Modelo da placa"
            value={value.modelId}
            onChange={(e) => onChange({ mode: "AUTO", modelId: e.target.value })}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          >
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
