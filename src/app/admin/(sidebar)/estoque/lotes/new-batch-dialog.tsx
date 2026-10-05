"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { selectClass } from "../_components/field-styles";

interface WaitingOrder {
  id: string;
  customerName: string;
  createdAt: string;
  missing: number;
}

const MAX = 500;

/**
 * Novo lote. Dois caminhos, com o mesmo resultado (séries, códigos e arquivos
 * para a gráfica): "para estoque" gera N placas sem dono, para vender depois;
 * "para pedidos pagos" gera uma placa por cartão dos pedidos escolhidos, já
 * com o código que cada cartão tem — a produção sob demanda.
 */
export function NewBatchDialog({ models, defaultOpen = false, defaultModelId }: { models: { id: string; name: string }[]; defaultOpen?: boolean; defaultModelId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<"STOCK" | "ORDERS">("STOCK");
  const [modelId, setModelId] = useState(defaultModelId && models.some((m) => m.id === defaultModelId) ? defaultModelId : (models[0]?.id ?? ""));
  const [quantity, setQuantity] = useState("20");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [orders, setOrders] = useState<WaitingOrder[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || mode !== "ORDERS" || orders !== null) return;
    void fetch("/api/admin/plates/orders")
      .then((res) => res.json())
      .then((data) => setOrders(data.orders ?? []))
      .catch(() => setOrders([]));
  }, [open, mode, orders]);

  const platesFromOrders = (orders ?? []).filter((o) => selected.has(o.id)).reduce((sum, o) => sum + o.missing, 0);
  const qty = Number(quantity);
  const validQty = Number.isInteger(qty) && qty >= 1 && qty <= MAX;
  const canSubmit = !!modelId && (mode === "STOCK" ? validQty : selected.size > 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const common = { modelId, supplier: supplier.trim() || undefined, notes: notes.trim() || undefined };
      const body = mode === "STOCK" ? { mode, quantity: qty, ...common } : { mode, orderIds: [...selected], ...common };
      const res = await fetch("/api/admin/plates/batches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível gerar o lote");
      toast.success(`Lote ${data.batch.code} gerado com ${data.batch.quantity} placas.`);
      setOpen(false);
      router.push(`/admin/estoque/lotes/${data.batch.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={models.length === 0}>
          <Plus className="size-4" /> Novo lote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo lote de placas</DialogTitle>
          <DialogDescription>O sistema gera as séries e os códigos. Depois você baixa os arquivos para a gráfica na página do lote.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div role="group" aria-label="Para quê é o lote" className="grid grid-cols-2 gap-2">
            {(
              [
                ["STOCK", "Para estoque", "Placas sem dono, para vender depois"],
                ["ORDERS", "Para pedidos pagos", "Uma placa por cartão já vendido"],
              ] as const
            ).map(([value, title, hint]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={cn("rounded-lg border p-3 text-left text-sm transition-colors", mode === value ? "border-brand bg-brand-subtle" : "hover:bg-muted")}
              >
                <span className="block font-medium">{title}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="batch-model">Modelo</Label>
            <select id="batch-model" className={selectClass} value={modelId} onChange={(e) => setModelId(e.target.value)} required>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {mode === "STOCK" ? (
            <div className="space-y-1.5">
              <Label htmlFor="batch-qty">Quantidade de placas</Label>
              <div className="flex items-center gap-2">
                <Input id="batch-qty" type="number" inputMode="numeric" min={1} max={MAX} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-28" />
                {[10, 20, 50, 100].map((n) => (
                  <Button key={n} type="button" size="sm" variant="outline" onClick={() => setQuantity(String(n))}>
                    {n}
                  </Button>
                ))}
              </div>
              {!validQty ? <p className="text-xs text-destructive">Use um número de 1 a {MAX}.</p> : null}
            </div>
          ) : (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Pedidos pagos que ainda estão sem placa</legend>
              {orders === null ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
              {orders?.length === 0 ? <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Nenhum pedido pago está esperando placa.</p> : null}
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {orders?.map((order) => (
                  <li key={order.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={selected.has(order.id)}
                        onChange={(e) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(order.id);
                            else next.delete(order.id);
                            return next;
                          })
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{order.customerName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {order.missing} placa{order.missing === 1 ? "" : "s"} · {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {selected.size > 0 ? <p className="text-xs text-muted-foreground">O lote terá {platesFromOrders} placa{platesFromOrders === 1 ? "" : "s"}.</p> : null}
            </fieldset>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="batch-supplier">Fornecedor (opcional)</Label>
              <Input id="batch-supplier" maxLength={120} value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch-notes">Observações (opcional)</Label>
              <Input id="batch-notes" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading || !canSubmit}>
              {loading ? "Gerando…" : "Gerar lote"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
