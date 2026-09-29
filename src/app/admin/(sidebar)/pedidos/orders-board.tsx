"use client";

import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { copyText } from "@/hooks/use-copy";
import { MoreHorizontal, Copy, CreditCard, XCircle, Truck, AlertTriangle, Search, ArrowRight, Eye, Gavel, MapPin, Clock } from "lucide-react";
import { OrderDetailSheet } from "./order-detail-sheet";
import { isDisputeActive } from "@/domain/store-order/checklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SmartBadge } from "@nfc-os/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCentsToBRL } from "@/lib/store-products";
import {
  BOARD_COLUMNS,
  COLUMN_ENTRY_STEP,
  deriveBoardColumn,
  isForwardAdjacent,
  stageEnteredAt,
  daysSince,
  type BoardColumn,
  type ChecklistStepKey,
} from "@/domain/store-order/board";
import type { StoreOrder } from "@/generated/prisma/client";

interface ProvisionedCard {
  id: string;
  name: string;
  uniqueCode: string;
  /** `null` quando o endereço do cartão ainda não é o definitivo e o ambiente o exige (ADR-076). */
  publicUrl: string | null;
}

interface CardUrlInfo {
  kind: "final" | "provisional" | "local" | "invalid";
  message: string;
  blocked: boolean;
}

/**
 * Centro de Operações (Fase 18) — substitui a tabela plana de pedidos por um
 * quadro de produção real. Cada coluna é derivada da checklist do pedido
 * (ver domain/store-order/board.ts), nunca de um campo próprio — arrastar um
 * cartão para a coluna seguinte É a ação que marca aquela etapa como feita.
 * Só é possível avançar uma etapa por vez (isForwardAdjacent) — pular etapas
 * por drag esconderia produção que nunca aconteceu de verdade.
 */
export function OrdersBoard({ initialOrders }: { initialOrders: StoreOrder[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cardsByOrder, setCardsByOrder] = useState<Record<string, ProvisionedCard[]>>({});
  const [cardUrl, setCardUrl] = useState<CardUrlInfo | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Substitui os dois window.prompt() originais (Auditoria Nível
  // Bilionário, 11/09/2026) — nativos do navegador, não seguem o tema,
  // bloqueiam a thread, e eram o único lugar do produto inteiro usando esse
  // padrão em vez de um Dialog de verdade.
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
  const [carrierInput, setCarrierInput] = useState("");
  const [trackingInput, setTrackingInput] = useState("");
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);

  const { columns, pendingCount, canceledCount } = useMemo(() => {
    const term = search.trim().toLowerCase();
    const active = orders.filter((o) => {
      if (o.status !== "PAID" && o.status !== "SHIPPED" && o.status !== "DELIVERED") return false;
      if (!term) return true;
      return o.customerName.toLowerCase().includes(term) || o.customerEmail.toLowerCase().includes(term);
    });
    const grouped = new Map<BoardColumn, StoreOrder[]>(BOARD_COLUMNS.map((c) => [c.key, []]));
    for (const order of active) {
      grouped.get(deriveBoardColumn(order))!.push(order);
    }
    return {
      columns: grouped,
      pendingCount: orders.filter((o) => o.status === "PENDING_PAYMENT").length,
      canceledCount: orders.filter((o) => o.status === "CANCELED").length,
    };
  }, [orders, search]);

  function updateOrderLocally(updated: StoreOrder) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }

  async function applyChecklistStep(orderId: string, step: "STOCK_CONFIRMED" | "PRINTED" | "NFC_WRITTEN" | "QC_PASSED" | "PACKAGED") {
    const res = await fetch(`/api/admin/orders/${orderId}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Não foi possível atualizar o pedido");
    return data.order as StoreOrder;
  }

  async function applyStatus(orderId: string, status: "SHIPPED" | "DELIVERED" | "CANCELED", extra?: { trackingCode?: string; carrier?: string }) {
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Não foi possível atualizar o pedido");
    return data.order as StoreOrder;
  }

  // Extraído do drag-and-drop original para ser chamado também por um botão
  // "Avançar etapa" por cartão (Auditoria Nível Bilionário, 11/09/2026) —
  // drag-and-drop nativo HTML5 não tem suporte a touch na prática em quase
  // nenhum navegador mobile, então sem isso o quadro inteiro ficava
  // inoperável fora de um computador com mouse.
  async function advanceOrder(orderId: string, targetColumn: BoardColumn) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const currentColumn = deriveBoardColumn(order);
    if (currentColumn === targetColumn) return;
    if (!isForwardAdjacent(currentColumn, targetColumn)) {
      toast.error("Só é possível avançar uma etapa por vez.");
      return;
    }

    const step = COLUMN_ENTRY_STEP[targetColumn];
    if (!step) return;

    // Expedição pede transportadora/rastreio (Fase 19.3 — antes "Embalado"
    // e "Enviado" eram a mesma coluna, agora são etapas distintas) — em vez
    // de window.prompt(), abre um diálogo de verdade (ver confirmShipment
    // abaixo) e sai daqui sem aplicar nada ainda; a ação real só acontece
    // quando o diálogo é confirmado.
    if (step === "SHIPPED") {
      setCarrierInput("");
      setTrackingInput("");
      setShippingOrderId(orderId);
      return;
    }

    setBusy(true);
    try {
      if (step === "DELIVERED") {
        updateOrderLocally(await applyStatus(orderId, "DELIVERED"));
      } else {
        updateOrderLocally(await applyChecklistStep(orderId, step));
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function confirmShipment() {
    const orderId = shippingOrderId;
    if (!orderId) return;
    setBusy(true);
    try {
      updateOrderLocally(
        await applyStatus(orderId, "SHIPPED", { trackingCode: trackingInput.trim() || undefined, carrier: carrierInput.trim() || undefined })
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
      setShippingOrderId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function handleDrop(targetColumn: BoardColumn) {
    const orderId = draggedId;
    setDraggedId(null);
    if (!orderId) return;
    await advanceOrder(orderId, targetColumn);
  }

  async function bulkAdvance(column: BoardColumn) {
    const idsInColumn = (columns.get(column) ?? []).map((o) => o.id).filter((id) => selectedIds.has(id));
    if (idsInColumn.length === 0) return;
    const columnIndex = BOARD_COLUMNS.findIndex((c) => c.key === column);
    const nextColumn = BOARD_COLUMNS[columnIndex + 1];
    if (!nextColumn) return;
    const step = COLUMN_ENTRY_STEP[nextColumn.key];
    if (!step || step === "SHIPPED") {
      toast.error("Envio em lote exige código de rastreio individual — avance um cartão de cada vez.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: idsInColumn, step }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível atualizar os pedidos");
      toast.success(`${data.updated} pedido(s) avançado(s)`);
      // Atualização otimista local — o campo exato depende da etapa, nunca
      // construído por transformação de string (STOCK_CONFIRMED não vira
      // stockConfirmedAt por lowercase, por exemplo).
      const timestampField: Record<ChecklistStepKey, keyof StoreOrder> = {
        STOCK_CONFIRMED: "stockConfirmedAt",
        PRINTED: "printedAt",
        NFC_WRITTEN: "nfcWrittenAt",
        QC_PASSED: "qcPassedAt",
        PACKAGED: "packagedAt",
        SHIPPED: "shippedAt",
        DELIVERED: "deliveredAt",
      };
      const field = timestampField[step];
      setOrders((prev) =>
        prev.map((o) => (idsInColumn.includes(o.id) ? { ...o, [field]: new Date(), ...(step === "DELIVERED" ? { status: "DELIVERED" } : {}) } : o))
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        idsInColumn.forEach((id) => next.delete(id));
        return next;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function provisionManually(orderId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/provision`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível provisionar");
      setCardsByOrder((prev) => ({ ...prev, [orderId]: data.cards }));
      setExpandedId(orderId);
      toast.success(`${data.cards.length} cartão(ões) criado(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível provisionar");
    } finally {
      setBusy(false);
    }
  }

  async function viewCodes(orderId: string) {
    if (expandedId === orderId) {
      setExpandedId(null);
      return;
    }
    if (!cardsByOrder[orderId]) {
      const res = await fetch(`/api/admin/orders/${orderId}/provision`);
      const data = await res.json();
      if (res.ok) {
        setCardsByOrder((prev) => ({ ...prev, [orderId]: data.cards }));
        setCardUrl(data.cardUrl ?? null);
      }
    }
    setExpandedId(orderId);
  }

  async function copyAll(cards: ProvisionedCard[]) {
    if (cardUrl?.blocked) {
      toast.error(cardUrl.message);
      return;
    }
    const ok = await copyText(cards.map((c) => `${c.name}\t${c.uniqueCode}\t${c.publicUrl}`).join("\n"));
    if (ok) toast.success("Lista copiada");
    else toast.error("Não foi possível copiar — tente selecionar manualmente.");
  }

  async function cancelOrder(orderId: string) {
    setBusy(true);
    try {
      updateOrderLocally(await applyStatus(orderId, "CANCELED"));
      toast.success("Pedido cancelado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente ou e-mail…"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 overflow-x-auto pb-2 sm:grid-cols-3 lg:grid-cols-6">
        {BOARD_COLUMNS.map((column, index) => {
          const orderList = columns.get(column.key) ?? [];
          const selectedInColumn = orderList.filter((o) => selectedIds.has(o.id));
          // Embalar → Enviado pede código de rastreio individual (ver
          // handleDrop) — nunca oferecer um botão de lote que sempre falharia.
          const nextStep = COLUMN_ENTRY_STEP[BOARD_COLUMNS[index + 1]?.key as BoardColumn];
          const bulkBlocked = nextStep === "PACKAGED";
          return (
            <div
              key={column.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(column.key)}
              className="flex min-h-[200px] flex-col rounded-lg border bg-muted/20 p-2"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{column.label}</h3>
                <span className="text-xs text-muted-foreground">{orderList.length}</span>
              </div>

              {selectedInColumn.length > 0 ? (
                bulkBlocked ? (
                  <p className="mb-2 rounded-md bg-muted px-2 py-1.5 text-center text-[11px] text-muted-foreground">
                    Envio pede rastreio individual — avance um de cada vez
                  </p>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mb-2 w-full text-xs"
                    disabled={busy}
                    onClick={() => bulkAdvance(column.key)}
                  >
                    Avançar {selectedInColumn.length} selecionado(s)
                  </Button>
                )
              ) : null}

              <div className="flex flex-1 flex-col gap-2">
                {orderList.map((order) => {
                  const address = order.shippingAddress as { city?: string; state?: string } | null;
                  const stageAge = daysSince(stageEnteredAt(order));
                  const needsShippingInfo = (column.key === "EMBALAGEM" || column.key === "EXPEDICAO") && !address;
                  return (
                  <Fragment key={order.id}>
                    <div
                      draggable
                      onDragStart={() => setDraggedId(order.id)}
                      onDragEnd={() => setDraggedId(null)}
                      className="cursor-grab space-y-1.5 rounded-md border bg-card p-2.5 text-xs shadow-subtle active:cursor-grabbing"
                    >
                      <div className="flex items-start gap-1.5">
                        <Checkbox
                          checked={selectedIds.has(order.id)}
                          onCheckedChange={(checked) =>
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(order.id);
                              else next.delete(order.id);
                              return next;
                            })
                          }
                          className="mt-0.5"
                        />
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setDetailOrderId(order.id)}
                        >
                          <p className="truncate font-medium hover:underline">{order.customerName}</p>
                          <p className="text-muted-foreground">{order.quantity}x · {formatCentsToBRL(order.amountTotalCents)}</p>
                          {address?.city ? (
                            <p className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="size-3 shrink-0" />
                              <span className="truncate">{address.city}{address.state ? `, ${address.state}` : ""}</span>
                            </p>
                          ) : null}
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="size-6 shrink-0" aria-label={`Mais ações para o pedido de ${order.customerName}`}>
                              <MoreHorizontal className="size-3.5" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailOrderId(order.id)}>
                              <Eye className="size-3.5" /> Ver detalhes do pedido
                            </DropdownMenuItem>
                            {BOARD_COLUMNS[index + 1] ? (
                              <DropdownMenuItem
                                disabled={busy}
                                onClick={() => advanceOrder(order.id, BOARD_COLUMNS[index + 1].key)}
                              >
                                <ArrowRight className="size-3.5" /> Avançar para &quot;{BOARD_COLUMNS[index + 1].label}&quot;
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem onClick={() => viewCodes(order.id)}>
                              <Copy className="size-3.5" /> Ver códigos
                            </DropdownMenuItem>
                            {!order.provisionedAt ? (
                              <DropdownMenuItem onClick={() => provisionManually(order.id)}>
                                <CreditCard className="size-3.5" /> Provisionar manualmente
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem onClick={() => cancelOrder(order.id)} variant="destructive">
                              <XCircle className="size-3.5" /> Cancelar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {!order.provisionedAt ? (
                        <SmartBadge label="Webhook falhou — provisionar manualmente" tone="danger" icon={<AlertTriangle className="size-3" />} />
                      ) : null}
                      {isDisputeActive(order.disputeStatus) ? (
                        <SmartBadge label={`Disputa: ${order.disputeStatus}`} tone="danger" icon={<Gavel className="size-3" />} />
                      ) : null}
                      {order.trackingCode ? (
                        <SmartBadge
                          label={order.carrier ? `${order.carrier} · ${order.trackingCode}` : `Rastreio ${order.trackingCode}`}
                          tone="info"
                          icon={<Truck className="size-3" />}
                        />
                      ) : null}
                      {needsShippingInfo ? (
                        <SmartBadge label="Sem endereço de entrega" tone="danger" icon={<MapPin className="size-3" />} />
                      ) : null}
                      {column.key !== "ENTREGUE" && stageAge >= 3 ? (
                        <SmartBadge
                          label={`${stageAge} dias nesta etapa`}
                          tone={stageAge >= 7 ? "danger" : "warning"}
                          icon={<Clock className="size-3" />}
                        />
                      ) : null}
                    </div>

                    {expandedId === order.id && cardsByOrder[order.id] ? (
                      <div className="rounded-md border bg-background p-2 text-[11px]">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-muted-foreground">{cardsByOrder[order.id].length} cartão(ões)</span>
                          <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => copyAll(cardsByOrder[order.id])}>
                            <Copy className="size-3" /> Copiar
                          </Button>
                        </div>
                        {cardUrl && cardUrl.kind !== "final" ? (
                          <p className={`mb-1.5 rounded border px-2 py-1 ${cardUrl.blocked ? "border-destructive/40 text-destructive" : "border-amber-500/40 text-amber-700 dark:text-amber-400"}`}>
                            {cardUrl.message}
                          </p>
                        ) : null}
                        <div className="max-h-32 space-y-1 overflow-y-auto font-mono">
                          {cardsByOrder[order.id].map((c) => (
                            <div key={c.id} className="truncate text-muted-foreground">
                              {c.publicUrl ?? `${c.uniqueCode} — endereço bloqueado`}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </Fragment>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {pendingCount > 0 || canceledCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {pendingCount} aguardando pagamento · {canceledCount} cancelado(s) — não aparecem no quadro de produção.
        </p>
      ) : null}

      <Dialog open={!!shippingOrderId} onOpenChange={(open) => !open && setShippingOrderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como enviado</DialogTitle>
            <DialogDescription>Os dois campos são opcionais — pode confirmar sem preencher nenhum.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ship-carrier">Transportadora</Label>
              <Input id="ship-carrier" placeholder="Ex: Correios, Loggi" value={carrierInput} onChange={(e) => setCarrierInput(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ship-tracking">Código de rastreio</Label>
              <Input id="ship-tracking" value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShippingOrderId(null)}>Cancelar</Button>
            <Button onClick={confirmShipment} disabled={busy}>Confirmar envio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrderDetailSheet
        orderId={detailOrderId}
        onClose={() => setDetailOrderId(null)}
        onOrderChanged={updateOrderLocally}
      />
    </div>
  );
}
