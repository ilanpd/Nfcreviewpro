"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, ChevronDown, FastForward, Truck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SmartBadge } from "@nfc-os/ui";
import { cn } from "@/lib/utils";
import { BOARD_COLUMNS, deriveBoardColumn, type BoardColumn } from "@/domain/store-order/board";
import { STATUS_LABEL, STATUS_TONE } from "@/domain/store-order/checklist";
import { columnLabel, columnsThrough, nextColumn, planUndo, stageProgress, stepsToReach, warnsMissingPlates } from "@/domain/store-order/stage";
import type { StoreOrder } from "@/generated/prisma/client";

/** Quantos cartões o pedido tem e quantos já têm placa — para avisar antes de embalar sem placa. */
export interface PlateCoverage {
  total: number;
  withPlate: number;
}

const ACTIVE = new Set(["PAID", "SHIPPED", "DELIVERED"]);

/** Barra de 8 segmentos: concluídas em verde, a atual na cor da marca, as futuras apagadas. */
function SegmentBar({ column, withLabels }: { column: BoardColumn; withLabels?: boolean }) {
  const { index } = stageProgress(column);
  return (
    <ol aria-label={`Etapa ${index + 1} de ${BOARD_COLUMNS.length}: ${columnLabel(column)}`} className={cn("grid gap-0.5", withLabels ? "grid-cols-4 gap-x-1.5 gap-y-2.5" : "grid-cols-8")}>
      {BOARD_COLUMNS.map((c, i) => (
        <li key={c.key} className="min-w-0">
          <div className={cn("h-1.5 rounded-full", i < index ? "bg-emerald-500" : i === index ? "bg-brand" : "bg-muted")} />
          {withLabels ? (
            <p className={cn("mt-1 truncate text-[11px] leading-tight", i === index ? "font-semibold text-foreground" : "text-muted-foreground")} title={c.label}>
              {c.label}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * O controle de etapa do pedido — o jeito simples de mudar o status. Um botão
 * "Avançar" leva ao próximo passo; o menu permite ir direto a uma etapa de
 * produção mais à frente (com confirmação dizendo o que será marcado) ou
 * desfazer o último passo de produção. Enviar pede transportadora/rastreio;
 * embalar ou enviar sem placa em todos os cartões pede confirmação.
 *
 * `compact` cabe numa linha da lista; `full` é o do detalhe do pedido.
 */
export function OrderStageControl({
  order,
  coverage,
  variant = "compact",
  onChanged,
}: {
  order: StoreOrder;
  coverage?: PlateCoverage | null;
  variant?: "compact" | "full";
  onChanged: (order: StoreOrder) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ target: BoardColumn; steps: string[]; missing: number } | null>(null);
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");

  const column = deriveBoardColumn(order);
  const active = ACTIVE.has(order.status);

  if (!active) {
    return <SmartBadge label={STATUS_LABEL[order.status]} tone={STATUS_TONE[order.status]} />;
  }

  const next = nextColumn(column);
  const undo = planUndo({ ...order, currentColumn: column });
  const jumpTargets = next ? BOARD_COLUMNS.filter((c) => c.key !== next && stepsToReach(column, c.key).length > 1 && !stepsToReach(column, c.key).some((s) => s === "SHIPPED" || s === "DELIVERED")) : [];
  const coverageKnown = coverage && coverage.total > 0;

  async function send(body: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/stage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível mudar a etapa");
      onChanged(data.order as StoreOrder);
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Decide se o gesto precisa de uma confirmação (envio, vários passos, placa faltando) ou segue direto. */
  function requestAdvance(target: BoardColumn) {
    const steps = stepsToReach(column, target);
    const missing = coverageKnown && warnsMissingPlates(target, coverage!.total, coverage!.withPlate) ? coverage!.total - coverage!.withPlate : 0;
    const needsDialog = target === "EXPEDICAO" || steps.length > 1 || missing > 0;
    if (!needsDialog) {
      void send({ action: "ADVANCE_TO", target }, `Pedido movido para ${columnLabel(target)}.`);
      return;
    }
    setCarrier("");
    setTracking("");
    setPending({ target, steps: columnsThrough(column, target).map(columnLabel), missing });
  }

  async function confirmPending() {
    if (!pending) return;
    const ok = await send(
      { action: "ADVANCE_TO", target: pending.target, ...(pending.target === "EXPEDICAO" ? { carrier: carrier.trim() || undefined, trackingCode: tracking.trim() || undefined } : {}) },
      `Pedido movido para ${columnLabel(pending.target)}.`
    );
    if (ok) setPending(null);
  }

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size={variant === "full" ? "default" : "icon-sm"} disabled={busy} aria-label={`Mais opções de etapa do pedido de ${order.customerName}`}>
          {variant === "full" ? (
            <>
              Mais opções <ChevronDown className="size-3.5" />
            </>
          ) : (
            <ChevronDown className="size-3.5" aria-hidden="true" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Etapa atual: {columnLabel(column)}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {jumpTargets.length > 0 ? (
          jumpTargets.map((c) => (
            <DropdownMenuItem key={c.key} onClick={() => requestAdvance(c.key)}>
              <FastForward className="size-3.5" /> Ir direto para {c.label}
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>Sem atalhos a partir desta etapa</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!undo.ok}
          title={undo.ok ? undefined : undo.reason}
          onClick={() => void send({ action: "UNDO" }, undo.ok ? `Etapa desfeita: voltou para ${columnLabel(undo.to)}.` : "")}
        >
          <Undo2 className="size-3.5" /> {undo.ok ? `Desfazer: voltar para ${columnLabel(undo.to)}` : "Desfazer última etapa"}
        </DropdownMenuItem>
        {!undo.ok ? <p className="px-2 pb-1.5 text-[11px] leading-snug text-muted-foreground">{undo.reason}</p> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const advanceButton = next ? (
    <Button
      type="button"
      size={variant === "full" ? "default" : "xs"}
      disabled={busy}
      onClick={() => requestAdvance(next)}
      title={`Avançar para ${columnLabel(next)}`}
      aria-label={`Avançar o pedido de ${order.customerName} para ${columnLabel(next)}`}
    >
      {variant === "full" ? `Avançar para ${columnLabel(next)}` : "Avançar"} <ArrowRight className={variant === "full" ? "size-4" : "size-3"} />
    </Button>
  ) : (
    <SmartBadge label="Concluído" tone="success" />
  );

  return (
    <>
      {variant === "full" ? (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-lg font-semibold">{columnLabel(column)}</p>
            <p className="text-xs text-muted-foreground">
              Etapa {stageProgress(column).index + 1} de {BOARD_COLUMNS.length}
            </p>
          </div>
          <SegmentBar column={column} withLabels />
          <div className="flex flex-wrap items-center gap-2">
            {advanceButton}
            {next ? menu : null}
          </div>
        </div>
      ) : (
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-medium">{columnLabel(column)}</p>
            <div className="flex shrink-0 items-center gap-1">
              {advanceButton}
              {next ? menu : null}
            </div>
          </div>
          <SegmentBar column={column} />
        </div>
      )}

      <Dialog open={pending !== null} onOpenChange={(open) => !open && !busy && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mover para {pending ? columnLabel(pending.target) : ""}?</DialogTitle>
            <DialogDescription>Pedido de {order.customerName}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {pending && pending.steps.length > 1 ? (
              <p>
                Isto marca como <strong>feitas</strong> as etapas: {pending.steps.join(", ")}. Confirme só se elas realmente já aconteceram.
              </p>
            ) : null}
            {pending && pending.missing > 0 ? (
              <p role="alert" className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {pending.missing} cartão(ões) deste pedido ainda <strong>não têm placa</strong> atribuída. Embalar ou enviar assim pode mandar um cartão sem nada para o cliente.
                </span>
              </p>
            ) : null}
            {pending?.target === "EXPEDICAO" ? (
              <div className="space-y-3">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Truck className="size-4" aria-hidden="true" /> O cliente recebe um e-mail de envio. Os dois campos são opcionais.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor={`carrier-${order.id}`}>Transportadora</Label>
                  <Input id={`carrier-${order.id}`} placeholder="Ex.: Correios, Loggi" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`tracking-${order.id}`}>Código de rastreio</Label>
                  <Input id={`tracking-${order.id}`} value={tracking} onChange={(e) => setTracking(e.target.value)} />
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button disabled={busy} onClick={confirmPending}>
              {busy ? "Salvando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
