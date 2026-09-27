"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Mail,
  MapPin,
  Package,
  RotateCcw,
  User,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SmartBadge } from "@nfc-os/ui";
import { formatCentsToBRL } from "@/lib/store-products";
import { buildOrderChecklist, isDisputeActive, STATUS_LABEL, STATUS_TONE } from "@/domain/store-order/checklist";
import type { StoreOrder, StoreOrderNote } from "@/generated/prisma/client";

interface ProvisionedCard {
  id: string;
  name: string;
  uniqueCode: string;
  publicUrl: string;
}

interface OrderDetail {
  order: StoreOrder;
  productLabel: string;
  cards: ProvisionedCard[];
  notes: StoreOrderNote[];
  stripeDashboardUrl: string | null;
};

function EmailRow({ label, sentAt }: { label: string; sentAt: Date | string | null }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      {sentAt ? (
        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
          <Check className="size-3" /> {new Date(sentAt).toLocaleString("pt-BR")}
        </span>
      ) : (
        <span className="text-muted-foreground">não enviado</span>
      )}
    </div>
  );
}

/**
 * Auditoria do Fluxo de Vendas (12/09/2026) — item 2 da lista priorizada da
 * Auditoria de Vendas: um único painel que junta tudo que hoje vive
 * espalhado (dados do cliente, endereço, pagamento no Stripe, checklist de
 * produção, notas internas, e-mails enviados) — o "centro de controle" por
 * pedido que faltava no Admin.
 */
export function OrderDetailSheet({ orderId, onClose, onOrderChanged }: { orderId: string | null; onClose: () => void; onOrderChanged?: (order: StoreOrder) => void }) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setDetail(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setDetail(null);
    fetch(`/api/admin/orders/${orderId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Não foi possível carregar o pedido");
        setDetail(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Não foi possível carregar o pedido"))
      .finally(() => setLoading(false));
  }, [orderId]);

  function updateLocalOrder(order: StoreOrder) {
    setDetail((prev) => (prev ? { ...prev, order } : prev));
    onOrderChanged?.(order);
  }

  async function addNote() {
    if (!orderId || !noteBody.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar a nota");
      setDetail((prev) => (prev ? { ...prev, notes: [data.note, ...prev.notes] } : prev));
      setNoteBody("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function resendEmail() {
    if (!orderId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/resend-email`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível reenviar");
      toast.success(data.sent ? "E-mail reenviado" : "Sem provedor de e-mail configurado — verifique RESEND_API_KEY");
      const refreshed = await fetch(`/api/admin/orders/${orderId}`).then((r) => r.json());
      setDetail(refreshed);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRefund() {
    if (!orderId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível reembolsar");
      updateLocalOrder(data.order);
      toast.success("Pedido reembolsado no Stripe");
      setRefundOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  function copyCards() {
    if (!detail?.cards.length) return;
    navigator.clipboard.writeText(detail.cards.map((c) => `${c.name}\t${c.uniqueCode}\t${c.publicUrl}`).join("\n"));
    toast.success("Lista copiada");
  }

  const order = detail?.order;
  const address = (order?.shippingAddress ?? null) as Record<string, string> | null;

  return (
    <>
      <Sheet open={!!orderId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          {loading ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">Carregando…</div>
          ) : error || !order ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle className="size-8 text-destructive" />
              <p className="text-sm font-medium">{error ?? "Não foi possível carregar este pedido"}</p>
              <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
            </div>
          ) : (
            <>
              <SheetHeader className="border-b pr-12">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle>{order.customerName}</SheetTitle>
                  <SmartBadge label={STATUS_LABEL[order.status] ?? order.status} tone={STATUS_TONE[order.status] ?? "neutral"} />
                  <SmartBadge label={order.orderType === "CARD_PLUS_SAAS" ? "Cartão + SaaS" : "Só cartão"} tone="neutral" />
                </div>
                <SheetDescription>
                  Pedido {order.id.slice(0, 10)}… · criado em {new Date(order.createdAt).toLocaleString("pt-BR")}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
                {isDisputeActive(order.disputeStatus) ? (
                  <Alert variant="destructive">
                    <AlertTriangle />
                    <AlertTitle>Contestação de pagamento em aberto</AlertTitle>
                    <AlertDescription>
                      Status no Stripe: <span className="font-medium">{order.disputeStatus}</span>
                      {order.disputedAt ? ` · aberta em ${new Date(order.disputedAt).toLocaleDateString("pt-BR")}` : ""}. Resolva direto no
                      Stripe — dinheiro pode ser revertido automaticamente se você perder a disputa.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <section className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <User className="size-3.5" /> Cliente
                  </h3>
                  <div className="space-y-1 rounded-lg border p-3 text-sm">
                    <p>{order.customerEmail}</p>
                    <p className="text-muted-foreground">{order.customerPhone || "Telefone não informado"}</p>
                    <p className="text-muted-foreground">{order.customerDocument || "CPF/CNPJ não informado"}</p>
                  </div>
                </section>

                {address ? (
                  <section className="space-y-2">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <MapPin className="size-3.5" /> Endereço de entrega
                    </h3>
                    <div className="space-y-0.5 rounded-lg border p-3 text-sm text-muted-foreground">
                      {[address.line1, address.line2, `${address.city ?? ""} ${address.state ?? ""}`, address.postal_code, address.country]
                        .filter(Boolean)
                        .map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                    </div>
                  </section>
                ) : null}

                <section className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Package className="size-3.5" /> Pedido
                  </h3>
                  <div className="space-y-1.5 rounded-lg border p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Produto</span>
                      <span>{detail.productLabel} × {order.quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total pago</span>
                      <span className="font-medium tabular-nums">{formatCentsToBRL(order.amountTotalCents)}</span>
                    </div>
                    {order.refundAmountCents ? (
                      <div className="flex justify-between text-red-600 dark:text-red-400">
                        <span>Reembolsado</span>
                        <span className="tabular-nums">{formatCentsToBRL(order.refundAmountCents)}</span>
                      </div>
                    ) : null}
                    {detail.stripeDashboardUrl ? (
                      <a
                        href={detail.stripeDashboardUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-brand hover:underline"
                      >
                        Ver pagamento no Stripe <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linha do tempo</h3>
                  <ol className="space-y-2 rounded-lg border p-3">
                    {buildOrderChecklist(order).map((step) => (
                      <li key={step.key} className="flex items-center justify-between text-sm">
                        <span className={step.done ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
                        {step.done ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                            <Check className="size-3.5" /> {step.at ? new Date(step.at).toLocaleDateString("pt-BR") : "ok"}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">pendente</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>

                {detail.cards.length > 0 ? (
                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Cartões ({detail.cards.length})
                      </h3>
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={copyCards}>
                        <Copy className="size-3" /> Copiar tudo
                      </Button>
                    </div>
                    <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border p-2 font-mono text-[11px] text-muted-foreground">
                      {detail.cards.map((c) => (
                        <div key={c.id} className="truncate">{c.publicUrl}</div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Mail className="size-3.5" /> E-mails transacionais
                  </h3>
                  <div className="space-y-1.5 rounded-lg border p-3">
                    <EmailRow label="Confirmação" sentAt={order.confirmationEmailSentAt} />
                    <EmailRow label="Envio" sentAt={order.shippedEmailSentAt} />
                    <EmailRow label="Entrega" sentAt={order.deliveredEmailSentAt} />
                    <Button size="sm" variant="outline" className="mt-1 w-full text-xs" disabled={busy} onClick={resendEmail}>
                      Reenviar e-mail da etapa atual
                    </Button>
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Notas internas ({detail.notes.length})
                  </h3>
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Ex: cliente ligou perguntando sobre o prazo…"
                      value={noteBody}
                      onChange={(e) => setNoteBody(e.target.value)}
                      className="text-sm"
                    />
                    <Button size="sm" disabled={busy || !noteBody.trim()} onClick={addNote}>
                      Adicionar nota
                    </Button>
                  </div>
                  {detail.notes.length > 0 ? (
                    <ul className="space-y-2">
                      {detail.notes.map((note) => (
                        <li key={note.id} className="rounded-lg border bg-muted/30 p-2.5 text-sm">
                          <p>{note.body}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{new Date(note.createdAt).toLocaleString("pt-BR")}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              </div>

              {order.status !== "REFUNDED" && order.status !== "PENDING_PAYMENT" ? (
                <SheetFooter className="border-t">
                  <Button variant="destructive" disabled={busy} onClick={() => setRefundOpen(true)}>
                    <RotateCcw className="size-4" /> Reembolsar pedido
                  </Button>
                </SheetFooter>
              ) : null}
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reembolsar pedido?</DialogTitle>
            <DialogDescription>
              Isso devolve {order ? formatCentsToBRL(order.amountTotalCents) : "o valor pago"} de verdade no Stripe e marca o pedido como
              reembolsado. Não pode ser desfeito por aqui.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={busy} onClick={confirmRefund}>Confirmar reembolso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
