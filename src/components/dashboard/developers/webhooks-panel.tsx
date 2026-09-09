"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Plus, RotateCw, Trash2 } from "lucide-react";
import { AnalyticsCard, SmartBadge } from "@nfc-os/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PUBLIC_WEBHOOK_EVENT_TYPES } from "@/domain/api-v1/webhook-events";
import type { WebhookDeliveryStatus } from "@/generated/prisma/client";

export interface WebhookEndpointRow {
  id: string;
  url: string;
  description: string | null;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: string | Date;
}

interface DeliveryRow {
  id: string;
  eventType: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  responseCode: number | null;
  errorMessage: string | null;
  lastAttemptAt: string | Date | null;
  createdAt: string | Date;
}

const STATUS_TONE: Record<WebhookDeliveryStatus, "success" | "warning" | "danger" | "neutral"> = {
  SUCCESS: "success",
  PENDING: "neutral",
  FAILED: "warning",
  EXHAUSTED: "danger",
};

function copy(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copiado");
}

export function WebhooksPanel({ initialWebhooks }: { initialWebhooks: WebhookEndpointRow[] }) {
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [deliveriesFor, setDeliveriesFor] = useState<WebhookEndpointRow | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  function toggleEvent(event: string, checked: boolean) {
    setEvents((prev) => {
      const next = new Set(prev);
      if (checked) next.add(event);
      else next.delete(event);
      return next;
    });
  }

  async function createWebhook() {
    if (!url.trim()) return toast.error("Informe a URL do seu endpoint.");
    if (events.size === 0) return toast.error("Selecione ao menos um evento.");

    setBusy(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), description: description.trim() || null, events: Array.from(events) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao criar webhook");
      setWebhooks((prev) => [data.endpoint, ...prev]);
      setUrl("");
      setDescription("");
      setEvents(new Set());
      setOpen(false);
      toast.success("Endpoint de webhook criado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar webhook");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(endpoint: WebhookEndpointRow) {
    try {
      const res = await fetch(`/api/webhooks/${endpoint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !endpoint.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao atualizar webhook");
      setWebhooks((prev) => prev.map((w) => (w.id === endpoint.id ? data.endpoint : w)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar webhook");
    }
  }

  async function deleteWebhook(id: string) {
    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? "Falha ao excluir webhook");
      }
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      toast.success("Endpoint removido");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir webhook");
    }
  }

  async function openDeliveries(endpoint: WebhookEndpointRow) {
    setDeliveriesFor(endpoint);
    setLoadingDeliveries(true);
    try {
      const res = await fetch(`/api/webhooks/${endpoint.id}/deliveries`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao carregar entregas");
      setDeliveries(data.deliveries);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao carregar entregas");
    } finally {
      setLoadingDeliveries(false);
    }
  }

  async function replay(deliveryId: string) {
    if (!deliveriesFor) return;
    try {
      const res = await fetch(`/api/webhooks/${deliveriesFor.id}/deliveries/${deliveryId}/replay`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao reenviar");
      setDeliveries((prev) => prev.map((d) => (d.id === deliveryId ? data.delivery : d)));
      toast.success(data.delivery.status === "SUCCESS" ? "Reenviado com sucesso" : "Reenviado — ainda falhou, veja o erro");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao reenviar");
    }
  }

  return (
    <>
      <AnalyticsCard
        title="Webhooks"
        description="Endpoints que recebem eventos em tempo real (assinados com HMAC-SHA256) quando algo acontece nesta empresa."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-3.5" /> Novo endpoint
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Novo endpoint de webhook</DialogTitle>
                <DialogDescription>Escolha quais eventos este endpoint deve receber.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>URL</Label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://sua-empresa.com/webhooks/nfc-os" />
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição (opcional)</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ex.: Sincronização com o CRM" />
                </div>
                <div className="space-y-1.5">
                  <Label>Eventos</Label>
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                    {PUBLIC_WEBHOOK_EVENT_TYPES.map((event) => (
                      <div key={event} className="flex items-center justify-between gap-3">
                        <code className="text-sm text-foreground">{event}</code>
                        <Switch checked={events.has(event)} onCheckedChange={(checked) => toggleEvent(event, checked)} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button disabled={busy} onClick={createWebhook}>
                  Criar endpoint
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {webhooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum endpoint de webhook configurado ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Eventos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((endpoint) => (
                <TableRow key={endpoint.id}>
                  <TableCell>
                    <p className="font-medium">{endpoint.url}</p>
                    {endpoint.description && <p className="text-xs text-muted-foreground">{endpoint.description}</p>}
                    <button
                      type="button"
                      onClick={() => copy(endpoint.secret)}
                      className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="size-3" /> Copiar segredo de assinatura
                    </button>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="flex flex-wrap gap-1">
                      {endpoint.events.map((e) => (
                        <SmartBadge key={e} label={e} tone="neutral" />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={endpoint.active} onCheckedChange={() => toggleActive(endpoint)} />
                      <SmartBadge label={endpoint.active ? "Ativo" : "Inativo"} tone={endpoint.active ? "success" : "neutral"} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openDeliveries(endpoint)}>
                        Ver entregas
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteWebhook(endpoint.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AnalyticsCard>

      <Dialog open={deliveriesFor !== null} onOpenChange={(next) => !next && setDeliveriesFor(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Entregas — {deliveriesFor?.url}</DialogTitle>
            <DialogDescription>Histórico real de tentativas de entrega deste endpoint.</DialogDescription>
          </DialogHeader>
          {loadingDeliveries ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento entregue ainda para este endpoint.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tentativas</TableHead>
                    <TableHead>Última tentativa</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.eventType}</TableCell>
                      <TableCell>
                        <SmartBadge label={d.status} tone={STATUS_TONE[d.status]} />
                        {d.errorMessage && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{d.errorMessage}</p>}
                      </TableCell>
                      <TableCell>{d.attempts}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {d.lastAttemptAt ? new Date(d.lastAttemptAt).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => replay(d.id)}>
                          <RotateCw className="size-3.5" /> Reenviar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
