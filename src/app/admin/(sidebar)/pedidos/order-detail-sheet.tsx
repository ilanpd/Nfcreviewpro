"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { copyText } from "@/hooks/use-copy";
import { AlertTriangle, Check, Copy, ExternalLink, Mail, MapPin, Package, RotateCcw, User } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SmartBadge } from "@nfc-os/ui";
import { formatCentsToBRL } from "@/lib/store-products";
import { buildOrderChecklist, isDisputeActive, STATUS_LABEL, STATUS_TONE } from "@/domain/store-order/checklist";
import type { StoreOrder, StoreOrderNote } from "@/generated/prisma/client";
import { OrderPlatesPanel } from "./order-plates-panel";
import { OrderStageControl } from "./order-stage-control";
import type { OrderCard } from "./assign-one-plate-dialog";

interface OrderDetail {
  order: StoreOrder;
  productLabel: string;
  cardUrl: { kind: "final" | "provisional" | "local" | "invalid"; host: string; message: string; blocked: boolean };
  cards: OrderCard[];
  notes: StoreOrderNote[];
  stripeDashboardUrl: string | null;
}

function SectionTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {icon}
      {children}
    </h3>
  );
}

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
 * Tudo sobre UM pedido, em ordem de uso: a ETAPA (e o botão que a avança), as
 * PLACAS de cada cartão (atribuir ou trocar ali mesmo), o resumo do pedido, o
 * cliente, a linha do tempo, os e-mails e as notas. Qualquer mudança aqui volta
 * para a lista na hora, sem recarregar a página.
 */
export function OrderDetailSheet({
  orderId,
  onClose,
  onOrderChanged,
  onPlatesChanged,
}: {
  orderId: string | null;
  onClose: () => void;
  onOrderChanged?: (order: StoreOrder) => void;
  /** Placa atribuída ou trocada: quem mostra a cobertura de placas (a lista) precisa recarregar. */
  onPlatesChanged?: () => void;
}) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/orders/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Não foi possível carregar o pedido");
    return data as OrderDetail;
  }, []);

  useEffect(() => {
    if (!orderId) {
      setDetail(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setDetail(null);
    load(orderId)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : "Não foi possível carregar o pedido"))
      .finally(() => setLoading(false));
  }, [orderId, load]);

  /** Recarrega o detalhe (depois de mudar etapa ou placa) e avisa a lista. */
  async function refresh() {
    if (!orderId) return;
    try {
      const fresh = await load(orderId);
      setDetail(fresh);
      onOrderChanged?.(fresh.order);
    } catch {
      // o detalhe antigo continua válido; a próxima abertura recarrega
    }
  }

  function updateLocalOrder(order: StoreOrder) {
    setDetail((prev) => (prev ? { ...prev, order: { ...prev.order, ...order } } : prev));
    onOrderChanged?.(order);
    // o desfazer e a sincronização com as placas deixam uma nota: traz a lista de notas atualizada
    void refresh();
  }

  async function addNote() {
    if (!orderId || !noteBody.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: noteBody.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar a nota");
      setDetail((prev) => (prev ? { ...prev, notes: [data.note, ...prev.notes] } : prev));
      setNoteBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
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
      setDetail(await load(orderId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRefund() {
    if (!orderId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível reembolsar");
      updateLocalOrder(data.order);
      toast.success("Pedido reembolsado no Stripe");
      setRefundOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function copyCards() {
    if (!detail?.cards.length) return;
    if (detail.cardUrl.blocked) return void toast.error(detail.cardUrl.message);
    const ok = await copyText(detail.cards.map((c) => `${c.name}\t${c.uniqueCode}\t${c.publicUrl}`).join("\n"));
    if (ok) toast.success("Lista copiada");
    else toast.error("Não foi possível copiar — tente selecionar manualmente.");
  }

  const order = detail?.order;
  const address = (order?.shippingAddress ?? null) as Record<string, string> | null;
  const coverage = detail ? { total: detail.cards.length, withPlate: detail.cards.filter((c) => c.plate).length } : null;
  const platesEditable = !!order && (order.status === "PAID" || order.status === "SHIPPED" || order.status === "DELIVERED");

  return (
    <>
      <Sheet open={!!orderId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-xl">
          {loading ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">Carregando…</div>
          ) : error || !order || !detail ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle className="size-8 text-destructive" />
              <p className="text-sm font-medium">{error ?? "Não foi possível carregar este pedido"}</p>
              <Button variant="outline" size="sm" onClick={onClose}>
                Fechar
              </Button>
            </div>
          ) : (
            <>
              <SheetHeader className="border-b pr-12">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="min-w-0 break-words">{order.customerName}</SheetTitle>
                  <SmartBadge label={STATUS_LABEL[order.status] ?? order.status} tone={STATUS_TONE[order.status] ?? "neutral"} />
                  <SmartBadge label={order.orderType === "CARD_PLUS_SAAS" ? "Cartão + SaaS" : "Só cartão"} tone="neutral" />
                </div>
                <SheetDescription>
                  Pedido {order.id.slice(-8).toUpperCase()} · criado em {new Date(order.createdAt).toLocaleString("pt-BR")}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
                {isDisputeActive(order.disputeStatus) ? (
                  <Alert variant="destructive">
                    <AlertTriangle />
                    <AlertTitle>Contestação de pagamento em aberto</AlertTitle>
                    <AlertDescription>
                      Status no Stripe: <span className="font-medium">{order.disputeStatus}</span>
                      {order.disputedAt ? ` · aberta em ${new Date(order.disputedAt).toLocaleDateString("pt-BR")}` : ""}. Resolva direto no Stripe — dinheiro pode ser revertido automaticamente se você perder a
                      disputa.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <section aria-label="Etapa do pedido" className="rounded-xl border p-3.5">
                  <OrderStageControl order={order} coverage={coverage} variant="full" onChanged={updateLocalOrder} />
                </section>

                {detail.cards.length > 0 ? (
                  <OrderPlatesPanel
                    orderId={order.id}
                    cards={detail.cards}
                    editable={platesEditable}
                    onChanged={() => {
                      void refresh();
                      onPlatesChanged?.();
                    }}
                  />
                ) : (
                  <p className="rounded-xl border border-dashed p-3.5 text-sm text-muted-foreground">Os cartões deste pedido ainda não foram criados (o pedido precisa estar pago e provisionado).</p>
                )}

                <section className="space-y-2">
                  <SectionTitle icon={<Package className="size-3.5" />}>Pedido</SectionTitle>
                  <div className="space-y-1.5 rounded-lg border p-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Produto</span>
                      <span className="text-right">
                        {detail.productLabel} × {order.quantity}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Total pago</span>
                      <span className="font-medium tabular-nums">{formatCentsToBRL(order.amountTotalCents)}</span>
                    </div>
                    {order.refundAmountCents ? (
                      <div className="flex justify-between gap-3 text-red-600 dark:text-red-400">
                        <span>Reembolsado</span>
                        <span className="tabular-nums">{formatCentsToBRL(order.refundAmountCents)}</span>
                      </div>
                    ) : null}
                    {order.trackingCode ? (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Rastreio</span>
                        <span className="text-right">
                          {order.carrier ? `${order.carrier} · ` : ""}
                          {order.trackingCode}
                        </span>
                      </div>
                    ) : null}
                    {detail.stripeDashboardUrl ? (
                      <a href={detail.stripeDashboardUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-ink hover:underline">
                        Ver pagamento no Stripe <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                  </div>
                </section>

                <section className="space-y-2">
                  <SectionTitle icon={<User className="size-3.5" />}>Cliente</SectionTitle>
                  <div className="space-y-1 rounded-lg border p-3 text-sm">
                    <p className="break-words">{order.customerEmail}</p>
                    <p className="text-muted-foreground">{order.customerPhone || "Telefone não informado"}</p>
                    <p className="text-muted-foreground">{order.customerDocument || "CPF/CNPJ não informado"}</p>
                  </div>
                </section>

                {address ? (
                  <section className="space-y-2">
                    <SectionTitle icon={<MapPin className="size-3.5" />}>Endereço de entrega</SectionTitle>
                    <div className="space-y-0.5 rounded-lg border p-3 text-sm text-muted-foreground">
                      {[address.line1, address.line2, `${address.city ?? ""} ${address.state ?? ""}`, address.postal_code, address.country].filter(Boolean).map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="space-y-2">
                  <SectionTitle>Linha do tempo</SectionTitle>
                  <ol className="grid gap-x-4 gap-y-1.5 rounded-lg border p-3 sm:grid-cols-2">
                    {buildOrderChecklist(order).map((step) => (
                      <li key={step.key} className="flex items-center justify-between gap-2 text-sm">
                        <span className={step.done ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
                        {step.done ? (
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                            <Check className="size-3.5" /> {step.at ? new Date(step.at).toLocaleDateString("pt-BR") : "ok"}
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs text-muted-foreground">pendente</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>

                {detail.cards.length > 0 ? (
                  <details className="group rounded-lg border">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 text-sm font-medium">
                      Endereços dos cartões (para gravar o chip)
                      <span className="text-xs font-normal text-muted-foreground group-open:hidden">mostrar</span>
                    </summary>
                    <div className="space-y-2 border-t p-3">
                      {detail.cardUrl.kind !== "final" ? (
                        <p role="alert" className={`rounded-lg border px-2.5 py-1.5 text-xs ${detail.cardUrl.blocked ? "border-destructive/40 text-destructive" : "border-amber-500/40 text-amber-700 dark:text-amber-400"}`}>
                          {detail.cardUrl.message}
                        </p>
                      ) : null}
                      <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border p-2 font-mono text-[11px] text-muted-foreground">
                        {detail.cards.map((c) => (
                          <div key={c.id} className="truncate">
                            {c.publicUrl ?? `${c.uniqueCode} — endereço bloqueado`}
                          </div>
                        ))}
                      </div>
                      <Button size="sm" variant="outline" className="w-full text-xs" onClick={copyCards}>
                        <Copy className="size-3" /> Copiar lista (nome, código e endereço)
                      </Button>
                    </div>
                  </details>
                ) : null}

                <section className="space-y-2">
                  <SectionTitle icon={<Mail className="size-3.5" />}>E-mails transacionais</SectionTitle>
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
                  <SectionTitle>Notas internas ({detail.notes.length})</SectionTitle>
                  <div className="space-y-2">
                    <Textarea placeholder="Ex: cliente ligou perguntando sobre o prazo…" value={noteBody} onChange={(e) => setNoteBody(e.target.value)} className="text-sm" />
                    <Button size="sm" disabled={busy || !noteBody.trim()} onClick={addNote}>
                      Adicionar nota
                    </Button>
                  </div>
                  {detail.notes.length > 0 ? (
                    <ul className="space-y-2">
                      {detail.notes.map((note) => (
                        <li key={note.id} className="rounded-lg border bg-muted/30 p-2.5 text-sm">
                          <p className="break-words">{note.body}</p>
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
              Isso devolve {order ? formatCentsToBRL(order.amountTotalCents) : "o valor pago"} de verdade no Stripe e marca o pedido como reembolsado. Não pode ser desfeito por aqui.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={busy} onClick={confirmRefund}>
              Confirmar reembolso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
