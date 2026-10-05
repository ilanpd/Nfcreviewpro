"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, ChevronLeft, ChevronRight, Download, Eye, Gavel, MoreHorizontal, Search, XCircle } from "lucide-react";
import { copyText } from "@/hooks/use-copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SmartBadge } from "@nfc-os/ui";
import { cn } from "@/lib/utils";
import { formatCentsToBRL, getStoreProduct } from "@/lib/store-products";
import { toCsv } from "@/lib/csv";
import { STATUS_LABEL, isDisputeActive } from "@/domain/store-order/checklist";
import { BOARD_COLUMNS, daysSince, deriveBoardColumn, stageEnteredAt, type BoardColumn } from "@/domain/store-order/board";
import { columnLabel, nextColumn, stepsToReach } from "@/domain/store-order/stage";
import { OrderDetailSheet } from "./order-detail-sheet";
import { OrderStageControl, type PlateCoverage } from "./order-stage-control";
import type { StoreOrder } from "@/generated/prisma/client";

export type StageFilter = "ALL" | BoardColumn | "AGUARDANDO" | "CANCELADOS";

const PAGE_SIZE = 20;
const PRODUCTION = new Set(["PAID", "SHIPPED", "DELIVERED"]);

type SortKey = "recentes" | "antigos" | "parados" | "valor";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "recentes", label: "Mais recentes" },
  { key: "antigos", label: "Mais antigos" },
  { key: "parados", label: "Mais parados na etapa" },
  { key: "valor", label: "Maior valor" },
];

function filterOf(order: StoreOrder): StageFilter {
  if (order.status === "PENDING_PAYMENT") return "AGUARDANDO";
  if (order.status === "CANCELED" || order.status === "REFUNDED") return "CANCELADOS";
  return deriveBoardColumn(order);
}

function PlatesChip({ coverage, onOpen }: { coverage?: PlateCoverage; onOpen: () => void }) {
  if (!coverage || coverage.total === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const done = coverage.withPlate >= coverage.total;
  return (
    <button
      type="button"
      onClick={onOpen}
      title={done ? "Todos os cartões deste pedido têm placa" : "Faltam placas neste pedido — clique para atribuir"}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-opacity hover:opacity-80",
        done ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
      )}
    >
      {done ? `${coverage.withPlate}/${coverage.total} placas` : `${coverage.withPlate}/${coverage.total} · falta placa`}
    </button>
  );
}

/**
 * A lista de pedidos. Cada pedido é uma linha em GRADE (e não uma linha de tabela
 * de 10 colunas): as colunas dividem o espaço que existe, textos longos viram
 * reticências e, em telas estreitas, a linha vira um cartão empilhado. Nunca há
 * rolagem lateral — essa era a queixa — e a etapa e a placa de cada pedido ficam
 * à vista e editáveis na própria linha.
 */
export function OrdersList({ initialOrders, plateCoverage, initialStage = "ALL" }: { initialOrders: StoreOrder[]; plateCoverage: Record<string, PlateCoverage>; initialStage?: StageFilter }) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [stage, setStage] = useState<StageFilter>(initialStage);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recentes");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<StoreOrder | null>(null);
  const [busy, setBusy] = useState(false);

  // quando o servidor manda dados novos (depois de atribuir placa, por exemplo), eles valem
  useEffect(() => setOrders(initialOrders), [initialOrders]);

  const counts = useMemo(() => {
    const map = new Map<StageFilter, number>();
    for (const order of orders) map.set(filterOf(order), (map.get(filterOf(order)) ?? 0) + 1);
    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = orders.filter((order) => {
      if (stage !== "ALL" && filterOf(order) !== stage) return false;
      if (!term) return true;
      return (
        order.customerName.toLowerCase().includes(term) ||
        order.customerEmail.toLowerCase().includes(term) ||
        (order.trackingCode ?? "").toLowerCase().includes(term) ||
        order.id.toLowerCase().includes(term)
      );
    });
    const time = (o: StoreOrder) => new Date(o.createdAt).getTime();
    return list.sort((a, b) => {
      if (sort === "antigos") return time(a) - time(b);
      if (sort === "valor") return b.amountTotalCents - a.amountTotalCents;
      if (sort === "parados") return daysSince(stageEnteredAt(b)) - daysSince(stageEnteredAt(a));
      return time(b) - time(a);
    });
  }, [orders, stage, search, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const allVisibleSelected = visible.length > 0 && visible.every((o) => selected.has(o.id));

  function applyUpdated(updated: StoreOrder) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
  }

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function chooseStage(next: StageFilter) {
    setStage(next);
    setPage(0);
    setSelected(new Set());
  }

  /** Avança uma etapa de cada pedido selecionado — só onde é seguro em lote (produção, sem envio/entrega). */
  async function bulkAdvance() {
    const targets = orders.filter((o) => selected.has(o.id) && PRODUCTION.has(o.status));
    const eligible = targets.flatMap((o) => {
      const next = nextColumn(deriveBoardColumn(o));
      return next && stepsToReach(deriveBoardColumn(o), next).every((s) => s !== "SHIPPED" && s !== "DELIVERED") ? [{ order: o, next }] : [];
    });
    const skipped = selected.size - eligible.length;
    if (eligible.length === 0) return void toast.error("Nenhum dos selecionados pode avançar em lote (enviar e entregar são individuais).");
    setBusy(true);
    let ok = 0;
    for (const { order, next } of eligible) {
      const res = await fetch(`/api/admin/orders/${order.id}/stage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ADVANCE_TO", target: next }) });
      if (res.ok) {
        applyUpdated((await res.json()).order as StoreOrder);
        ok++;
      }
    }
    setBusy(false);
    setSelected(new Set());
    toast.success(`${ok} pedido(s) avançado(s)${skipped > 0 ? `; ${skipped} ficaram de fora (envio e entrega são um a um)` : ""}.`);
  }

  async function cancelOrder() {
    if (!cancelTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${cancelTarget.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CANCELED" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível cancelar");
      applyUpdated(data.order as StoreOrder);
      toast.success("Pedido cancelado.");
      setCancelTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv(rows: StoreOrder[], label: string) {
    if (rows.length === 0) return;
    const city = (o: StoreOrder) => {
      const a = o.shippingAddress as { city?: string; state?: string } | null;
      return a?.city ? (a.state ? `${a.city}, ${a.state}` : a.city) : "";
    };
    const csv = toCsv(
      rows.map((o) => ({
        id: o.id,
        data: new Date(o.createdAt).toISOString(),
        status: STATUS_LABEL[o.status],
        etapa: PRODUCTION.has(o.status) ? columnLabel(deriveBoardColumn(o)) : "",
        cliente: o.customerName,
        email: o.customerEmail,
        cidade: city(o),
        quantidade: o.quantity,
        valor: (o.amountTotalCents / 100).toFixed(2),
      })),
      [
        { key: "id", header: "ID" },
        { key: "data", header: "Data" },
        { key: "status", header: "Status" },
        { key: "etapa", header: "Etapa" },
        { key: "cliente", header: "Cliente" },
        { key: "email", header: "E-mail" },
        { key: "cidade", header: "Cidade/UF" },
        { key: "quantidade", header: "Quantidade" },
        { key: "valor", header: "Valor (R$)" },
      ]
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-${label}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} pedido(s) exportado(s)`);
  }

  const chips: { key: StageFilter; label: string }[] = [
    { key: "ALL", label: "Todos" },
    { key: "AGUARDANDO", label: "Aguardando pagamento" },
    ...BOARD_COLUMNS.map((c) => ({ key: c.key as StageFilter, label: c.label })),
    { key: "CANCELADOS", label: "Cancelados" },
  ];

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Filtrar pedidos por etapa" className="flex flex-wrap gap-1.5">
        {chips.map((chip) => {
          const count = chip.key === "ALL" ? orders.length : (counts.get(chip.key) ?? 0);
          const active = stage === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              aria-pressed={active}
              onClick={() => chooseStage(chip.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active ? "border-brand bg-brand text-brand-foreground" : count === 0 ? "text-muted-foreground/70 hover:bg-muted" : "hover:bg-muted"
              )}
            >
              {chip.label}
              <span className={cn("tabular-nums", active ? "opacity-90" : "text-muted-foreground")}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 max-w-sm flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            aria-label="Buscar pedido"
            placeholder="Buscar por cliente, e-mail, rastreio ou ID…"
            className="pl-8"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Ordenar
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCsv(filtered, "filtrados")} disabled={filtered.length === 0}>
            <Download className="size-3.5" /> Exportar {filtered.length === orders.length ? "tudo" : "filtrados"} (CSV)
          </Button>
        </div>
      </div>

      {selected.size > 0 ? (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/40 bg-brand-subtle px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} selecionado(s)</span>
          <Button size="sm" disabled={busy} onClick={bulkAdvance}>
            Avançar uma etapa <ArrowRight className="size-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportCsv(orders.filter((o) => selected.has(o.id)), "selecionados")}>
            <Download className="size-3.5" /> Exportar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Limpar seleção
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border">
        <div className="hidden items-center gap-x-4 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.6fr)_7.5rem_2rem]">
          <span className="flex items-center gap-2.5">
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={(value) => setSelected((prev) => {
                const next = new Set(prev);
                for (const o of visible) {
                  if (value) next.add(o.id);
                  else next.delete(o.id);
                }
                return next;
              })}
              aria-label="Selecionar todos os pedidos desta página"
            />
            Cliente
          </span>
          <span>Pedido</span>
          <span>Etapa</span>
          <span>Placas</span>
          <span className="sr-only">Ações</span>
        </div>

        {visible.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {orders.length === 0 ? (
              "Nenhum pedido ainda. Os pedidos da loja e as vendas diretas aparecem aqui assim que o primeiro for pago."
            ) : (
              <>
                Nenhum pedido neste filtro.{" "}
                {stage !== "ALL" || search ? (
                  <button type="button" className="underline underline-offset-4" onClick={() => (chooseStage("ALL"), setSearch(""))}>
                    Ver todos
                  </button>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <ul className="divide-y">
            {visible.map((order) => {
              const age = daysSince(stageEnteredAt(order));
              const isFinal = order.status === "DELIVERED" || !PRODUCTION.has(order.status);
              const product = getStoreProduct(order.productId)?.name ?? order.productId;
              const coverage = plateCoverage[order.id];
              return (
                <li key={order.id} data-state={selected.has(order.id) ? "selected" : undefined} className="relative grid gap-x-4 gap-y-3 px-3 py-3 data-[state=selected]:bg-brand-subtle/50 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.6fr)_7.5rem_2rem] lg:items-center">
                  <div className="flex min-w-0 items-start gap-2.5 pr-9 lg:pr-0">
                    <Checkbox className="mt-0.5" checked={selected.has(order.id)} onCheckedChange={(v) => toggle(order.id, !!v)} aria-label={`Selecionar o pedido de ${order.customerName}`} />
                    <button type="button" className="min-w-0 text-left" onClick={() => setDetailId(order.id)}>
                      <p className="truncate font-medium hover:underline">{order.customerName}</p>
                      <p className="truncate text-xs text-muted-foreground">{order.customerEmail}</p>
                      {order.orderType === "CARD_PLUS_SAAS" || isDisputeActive(order.disputeStatus) ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {order.orderType === "CARD_PLUS_SAAS" ? <SmartBadge label="Cartão + SaaS" tone="neutral" /> : null}
                          {isDisputeActive(order.disputeStatus) ? <SmartBadge label="Disputa aberta" tone="danger" icon={<Gavel className="size-3" />} /> : null}
                        </span>
                      ) : null}
                    </button>
                  </div>

                  <div className="min-w-0 pl-7 lg:pl-0">
                    <p className="truncate text-sm font-medium">
                      <span className="tabular-nums">{order.quantity}×</span> {product}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="tabular-nums">{formatCentsToBRL(order.amountTotalCents)}</span> · {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  <div className="min-w-0 pl-7 lg:pl-0">
                    <OrderStageControl order={order} coverage={coverage} onChanged={applyUpdated} />
                    {!isFinal && age >= 3 ? (
                      <p className={cn("mt-1 text-[11px] font-medium", age >= 7 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")}>{age} dias parado nesta etapa</p>
                    ) : null}
                  </div>

                  <div className="pl-7 lg:pl-0">
                    <PlatesChip coverage={coverage} onOpen={() => setDetailId(order.id)} />
                  </div>

                  <div className="absolute top-3 right-2 lg:static">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8" aria-label={`Mais ações para o pedido de ${order.customerName}`}>
                          <MoreHorizontal className="size-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailId(order.id)}>
                          <Eye className="size-3.5" /> Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            const ok = await copyText(order.customerEmail);
                            if (ok) toast.success("E-mail copiado");
                            else toast.error("Não foi possível copiar — selecione manualmente.");
                          }}
                        >
                          Copiar e-mail
                        </DropdownMenuItem>
                        {order.status === "PAID" || order.status === "PENDING_PAYMENT" ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setCancelTarget(order)}>
                              <XCircle className="size-3.5" /> Cancelar pedido
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {filtered.length === 0 ? "0 pedidos" : `${safePage * PAGE_SIZE + 1}–${Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)} de ${filtered.length}`}
          {filtered.length !== orders.length ? ` (${orders.length} no total)` : ""}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            <ChevronLeft className="size-4" /> Anterior
          </Button>
          <span>
            Página {safePage + 1} de {pages}
          </span>
          <Button size="sm" variant="outline" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>
            Próxima <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Prefere ver a produção como colunas?{" "}
        <Link href="/admin/pedidos?visao=quadro" className="underline underline-offset-4">
          Abrir o quadro
        </Link>
        .
      </p>

      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancelar este pedido?"
        description={`O pedido de ${cancelTarget?.customerName ?? ""} sai da produção. Se já foi pago, o reembolso é feito à parte, pelo detalhe do pedido.`}
        confirmLabel="Cancelar pedido"
        busy={busy}
        onConfirm={cancelOrder}
      />

      <OrderDetailSheet orderId={detailId} onClose={() => setDetailId(null)} onOrderChanged={applyUpdated} onPlatesChanged={() => router.refresh()} />
    </div>
  );
}
