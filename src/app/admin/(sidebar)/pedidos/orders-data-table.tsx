"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { copyText } from "@/hooks/use-copy";
import {
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  tableFeatures,
  useTable,
  type ColumnVisibilityState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  MapPin,
  MoreHorizontal,
  Search,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SmartBadge } from "@nfc-os/ui";
import { formatCentsToBRL } from "@/lib/store-products";
import { toCsv } from "@/lib/csv";
import { STATUS_LABEL, STATUS_TONE, isDisputeActive } from "@/domain/store-order/checklist";
import { stageEnteredAt, daysSince } from "@/domain/store-order/board";
import { OrderDetailSheet } from "./order-detail-sheet";
import type { StoreOrder, StoreOrderStatus } from "@/generated/prisma/client";

const ALL_STATUSES = Object.keys(STATUS_LABEL) as StoreOrderStatus[];

const features = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, datetime: sortFn_datetime },
});

const columnHelper = createColumnHelper<typeof features, StoreOrder>();

function getCityState(order: StoreOrder): string {
  const address = order.shippingAddress as { city?: string; state?: string } | null;
  if (!address?.city) return "";
  return address.state ? `${address.city}, ${address.state}` : address.city;
}

const columns = columnHelper.columns([
  columnHelper.display({
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Selecionar tudo"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Selecionar pedido"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  }),
  columnHelper.accessor("customerName", {
    id: "customerName",
    header: ({ column }) => (
      <Button variant="ghost" className="-ml-3 h-8" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Cliente <ArrowUpDown className="size-3.5" />
      </Button>
    ),
    sortFn: "alphanumeric",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.original.customerName}</p>
        <p className="truncate text-xs text-muted-foreground">{row.original.customerEmail}</p>
      </div>
    ),
  }),
  columnHelper.accessor("status", {
    id: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex flex-col items-start gap-1">
        <SmartBadge label={STATUS_LABEL[row.original.status]} tone={STATUS_TONE[row.original.status]} />
        {isDisputeActive(row.original.disputeStatus) ? (
          <SmartBadge label="Disputa aberta" tone="danger" />
        ) : null}
      </div>
    ),
  }),
  columnHelper.accessor("orderType", {
    id: "orderType",
    header: "Tipo",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {row.original.orderType === "CARD_PLUS_SAAS" ? "Cartão + SaaS" : "Só cartão"}
      </span>
    ),
  }),
  columnHelper.accessor((row) => getCityState(row), {
    id: "location",
    header: "Cidade/UF",
    sortFn: "alphanumeric",
    cell: ({ getValue }) => {
      const value = getValue();
      return value ? (
        <span className="flex items-center gap-1 text-sm">
          <MapPin className="size-3 shrink-0 text-muted-foreground" /> {value}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">sem endereço</span>
      );
    },
  }),
  columnHelper.accessor("quantity", {
    id: "quantity",
    header: ({ column }) => (
      <Button variant="ghost" className="-ml-3 h-8" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Qtd <ArrowUpDown className="size-3.5" />
      </Button>
    ),
    sortFn: "basic",
    cell: ({ getValue }) => <span className="tabular-nums">{getValue()}x</span>,
  }),
  columnHelper.accessor("amountTotalCents", {
    id: "amountTotalCents",
    header: ({ column }) => (
      <Button variant="ghost" className="-ml-3 h-8" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Valor <ArrowUpDown className="size-3.5" />
      </Button>
    ),
    sortFn: "basic",
    cell: ({ getValue }) => <span className="font-medium tabular-nums">{formatCentsToBRL(getValue())}</span>,
  }),
  columnHelper.accessor("createdAt", {
    id: "createdAt",
    header: ({ column }) => (
      <Button variant="ghost" className="-ml-3 h-8" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Criado em <ArrowUpDown className="size-3.5" />
      </Button>
    ),
    sortFn: "datetime",
    cell: ({ getValue }) => <span className="text-sm tabular-nums">{new Date(getValue()).toLocaleDateString("pt-BR")}</span>,
  }),
  columnHelper.accessor((row) => daysSince(stageEnteredAt(row)), {
    id: "stageAge",
    header: ({ column }) => (
      <Button variant="ghost" className="-ml-3 h-8" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Dias na etapa <ArrowUpDown className="size-3.5" />
      </Button>
    ),
    sortFn: "basic",
    cell: ({ getValue, row }) => {
      const isFinal = row.original.status === "DELIVERED" || row.original.status === "CANCELED" || row.original.status === "REFUNDED";
      const days = getValue();
      if (isFinal) return <span className="text-xs text-muted-foreground">—</span>;
      return (
        <span className={days >= 7 ? "font-medium text-red-600 dark:text-red-400" : days >= 3 ? "font-medium text-amber-600 dark:text-amber-400" : "text-sm tabular-nums"}>
          {days}
        </span>
      );
    },
  }),
]);

/**
 * Transformação do Painel Admin (13/09/2026) — "melhor que Excel para
 * controle": ordenar clicando no cabeçalho, filtrar por status, esconder
 * coluna, selecionar em massa, exportar. Filtro de texto/status acontece
 * ANTES de entrar na tabela (useMemo simples) — o TanStack Table cuida só
 * de ordenação/paginação/seleção/visibilidade sobre o resultado já filtrado,
 * mantendo a integração pequena e previsível.
 */
export function OrdersDataTable({ initialOrders }: { initialOrders: StoreOrder[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<StoreOrderStatus>>(new Set());
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);

  const statusCounts = useMemo(() => {
    const counts = new Map<StoreOrderStatus, number>();
    for (const order of initialOrders) counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
    return counts;
  }, [initialOrders]);

  const filteredData = useMemo(() => {
    const term = search.trim().toLowerCase();
    return initialOrders.filter((order) => {
      if (statusFilter.size > 0 && !statusFilter.has(order.status)) return false;
      if (!term) return true;
      return (
        order.customerName.toLowerCase().includes(term) ||
        order.customerEmail.toLowerCase().includes(term) ||
        (order.trackingCode ?? "").toLowerCase().includes(term) ||
        order.id.toLowerCase().includes(term)
      );
    });
  }, [initialOrders, search, statusFilter]);

  const table = useTable({
    features,
    data: filteredData,
    columns,
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    state: { sorting, columnVisibility, rowSelection, pagination },
  });

  function toggleStatus(status: StoreOrderStatus) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }

  function exportSelected() {
    const selectedIds = new Set(Object.keys(rowSelection).filter((id) => rowSelection[id as keyof typeof rowSelection]));
    const rows = filteredData.filter((o) => selectedIds.has(o.id));
    if (rows.length === 0) return;
    const csv = toCsv(
      rows.map((o) => ({
        id: o.id,
        data: o.createdAt.toString(),
        status: STATUS_LABEL[o.status],
        cliente: o.customerName,
        email: o.customerEmail,
        cidade: getCityState(o),
        quantidade: o.quantity,
        valor: (o.amountTotalCents / 100).toFixed(2),
      })),
      [
        { key: "id", header: "ID" },
        { key: "data", header: "Data" },
        { key: "status", header: "Status" },
        { key: "cliente", header: "Cliente" },
        { key: "email", header: "E-mail" },
        { key: "cidade", header: "Cidade/UF" },
        { key: "quantidade", header: "Quantidade" },
        { key: "valor", header: "Valor (R$)" },
      ]
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-selecionados-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} pedido(s) exportado(s)`);
  }

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, e-mail, rastreio ou ID…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Status {statusFilter.size > 0 ? `(${statusFilter.size})` : ""} <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Filtrar por status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ALL_STATUSES.map((status) => (
              <DropdownMenuCheckboxItem
                key={status}
                checked={statusFilter.has(status)}
                onCheckedChange={() => toggleStatus(status)}
                onSelect={(e) => e.preventDefault()}
              >
                {STATUS_LABEL[status]} <span className="ml-auto text-xs text-muted-foreground">{statusCounts.get(status) ?? 0}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Colunas <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-2">
          {selectedCount > 0 ? (
            <Button variant="outline" size="sm" onClick={exportSelected}>
              <Download className="size-3.5" /> Exportar {selectedCount} selecionado(s)
            </Button>
          ) : null}
          <Button variant="outline" size="sm" asChild>
            <Link href="/api/admin/orders/export">
              <Download className="size-3.5" /> Exportar tudo (CSV)
            </Link>
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
                <TableHead />
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className="cursor-pointer"
                  onClick={() => setDetailOrderId(row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8" aria-label={`Mais ações para o pedido de ${row.original.customerName}`}>
                          <MoreHorizontal className="size-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailOrderId(row.original.id)}>
                          <Eye className="size-3.5" /> Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            const ok = await copyText(row.original.customerEmail);
                            if (ok) toast.success("E-mail copiado");
                            else toast.error("Não foi possível copiar — selecione manualmente.");
                          }}
                        >
                          Copiar e-mail
                        </DropdownMenuItem>
                        {row.original.status !== "CANCELED" && row.original.status !== "REFUNDED" && row.original.status !== "DELIVERED" ? (
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={async () => {
                              const res = await fetch(`/api/admin/orders/${row.original.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: "CANCELED" }),
                              });
                              if (res.ok) toast.success("Pedido cancelado");
                              else toast.error((await res.json().catch(() => ({}))).error ?? "Não foi possível cancelar");
                            }}
                          >
                            <XCircle className="size-3.5" /> Cancelar
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="h-24 text-center text-muted-foreground">
                  Nenhum pedido encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {selectedCount} de {filteredData.length} selecionado(s) · {initialOrders.length} pedido(s) no total
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
            <ChevronLeft className="size-4" /> Anterior
          </Button>
          <span>
            Página {pagination.pageIndex + 1} de {Math.max(1, table.getPageCount())}
          </span>
          <Button size="sm" variant="outline" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
            Próxima <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <OrderDetailSheet orderId={detailOrderId} onClose={() => setDetailOrderId(null)} />
    </div>
  );
}
