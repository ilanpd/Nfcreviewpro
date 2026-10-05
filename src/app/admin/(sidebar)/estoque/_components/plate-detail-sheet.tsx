"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Copy, Download, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { useCopy } from "@/hooks/use-copy";
import { EVENT_LABEL, type PlateEventType, type PlateStage } from "@/domain/plates/status";
import type { PlateRowDTO } from "@/services/plates.service";
import { StageBadge } from "./stage-badge";
import { formatDateTime } from "./format";

interface Detail {
  plate: PlateRowDTO;
  publicUrl: string | null;
  events: { id: string; type: PlateEventType; note: string | null; actor: string | null; createdAt: string }[];
  order: { id: string; customerName: string; status: string; createdAt: string } | null;
}

async function call(url: string, init: RequestInit): Promise<{ ok: boolean; data: { error?: string; code?: string } & Record<string, unknown> }> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const { state, copy } = useCopy(value);
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-sm" title={value}>
          {value}
        </p>
      </div>
      <Button type="button" variant="ghost" size="icon" aria-label={`Copiar ${label.toLowerCase()}`} onClick={copy}>
        {state === "copied" ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      </Button>
    </div>
  );
}

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setReason("");
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="plate-reason">Motivo</Label>
          <Textarea id="plate-reason" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: o NFC não lê, QR borrado…" />
        </div>
        <DialogFooter>
          <Button
            disabled={busy || reason.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason.trim());
                onOpenChange(false);
                setReason("");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Salvando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Suggestion {
  id: string;
  serial: string;
  stage: PlateStage;
  modelName: string;
}

/** Troca a placa de um cartão por outra do estoque; a antiga vira defeituosa. */
function ReplaceDialog({ open, onOpenChange, plate, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; plate: PlateRowDTO; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Suggestion[]>([]);
  const [chosen, setChosen] = useState<Suggestion | null>(null);
  const [reason, setReason] = useState("");
  const [needsConfirm, setNeedsConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      const params = new URLSearchParams({ stage: "IN_STOCK", take: "6", fifo: "1" });
      if (query.trim().length >= 2) params.set("q", query.trim());
      else params.set("modelId", plate.modelId);
      const { ok, data } = await call(`/api/admin/plates/lookup?${params}`, { method: "GET" });
      if (ok) setOptions((data.plates as Suggestion[]) ?? []);
    }, 200);
    return () => clearTimeout(handle);
  }, [open, query, plate.modelId]);

  async function submit(acceptCodeChange: boolean) {
    if (!chosen || !plate.card) return;
    setBusy(true);
    try {
      const { ok, data } = await call(`/api/admin/plates/${chosen.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ cardId: plate.card.id, replace: true, replaceReason: reason.trim() || undefined, acceptCodeChange }),
      });
      if (!ok) {
        if (data.code === "CODE_CHANGE_CONFIRMATION") return void setNeedsConfirm(data.error ?? "");
        throw new Error(data.error ?? "Não foi possível trocar a placa");
      }
      toast.success(`Placa trocada: ${plate.serial} → ${chosen.serial}.`);
      onOpenChange(false);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trocar a placa {plate.serial}</DialogTitle>
          <DialogDescription>
            O cartão de {plate.card?.companyName} passa a usar a placa nova. A atual fica marcada como defeituosa e sai de circulação.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="replace-q">Placa nova (do estoque conferido)</Label>
            <Input id="replace-q" value={query} onChange={(e) => (setQuery(e.target.value), setChosen(null))} placeholder="Digite a série, ex.: L001-08, ou escolha abaixo" />
          </div>
          <ul className="max-h-40 space-y-1 overflow-y-auto" aria-label="Placas disponíveis no estoque">
            {options.length === 0 ? <li className="text-sm text-muted-foreground">Nenhuma placa conferida disponível com essa busca.</li> : null}
            {options.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  aria-pressed={chosen?.id === option.id}
                  onClick={() => setChosen(option)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${chosen?.id === option.id ? "border-brand bg-brand-subtle" : "hover:bg-muted"}`}
                >
                  <span className="font-mono font-medium">{option.serial}</span>
                  <span className="text-xs text-muted-foreground">{option.modelName}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="space-y-1.5">
            <Label htmlFor="replace-reason">Motivo da troca (opcional)</Label>
            <Input id="replace-reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: chip não lê" />
          </div>
          {needsConfirm ? (
            <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-200">
              {needsConfirm}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button disabled={busy || !chosen} onClick={() => submit(needsConfirm !== null)}>
            {busy ? "Trocando…" : needsConfirm ? "Entendi, trocar mesmo assim" : "Trocar placa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Tudo sobre UMA placa, no lado da tela: onde ela está, de quem é, o que já foi
 * feito com ela (trilha completa) e o que dá para fazer agora. Usada pela lista
 * de placas e pela tabela de cada lote.
 */
export function PlateDetailSheet({ plateId, onClose, onChanged }: { plateId: string | null; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"defective" | "void" | "replace" | "unassign" | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (id: string) => {
    const { ok, data } = await call(`/api/admin/plates/${id}`, { method: "GET" });
    if (!ok) return void setError(data.error ?? "Não foi possível carregar a placa");
    setError(null);
    setDetail(data as unknown as Detail);
  }, []);

  useEffect(() => {
    setDetail(null);
    setError(null);
    if (plateId) void load(plateId);
  }, [plateId, load]);

  async function refresh() {
    if (plateId) await load(plateId);
    onChanged();
  }

  async function act(body: Record<string, unknown>, success: string) {
    if (!plateId) return;
    const { ok, data } = await call(`/api/admin/plates/${plateId}`, { method: "PATCH", body: JSON.stringify(body) });
    if (!ok) {
      toast.error(data.error ?? "Não foi possível concluir");
      throw new Error(data.error);
    }
    toast.success(success);
    await refresh();
  }

  const plate = detail?.plate;
  const retired = plate?.stage === "DEFECTIVE" || plate?.stage === "VOIDED";

  return (
    <>
      <Sheet open={plateId !== null} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span className="font-mono">{plate?.serial ?? "Placa"}</span>
              {plate ? <StageBadge stage={plate.stage} /> : null}
            </SheetTitle>
            <SheetDescription>{plate ? `${plate.modelName} · lote ${plate.batch.code}` : "Carregando…"}</SheetDescription>
          </SheetHeader>

          {error ? (
            <p role="alert" className="px-4 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {plate && detail ? (
            <div className="space-y-5 px-4 pb-6">
              <div className="space-y-2 rounded-lg border p-3">
                <CopyRow label="Código" value={plate.uniqueCode} />
                {detail.publicUrl ? <CopyRow label="Endereço (chip e QR)" value={detail.publicUrl} /> : <p className="text-xs text-amber-700 dark:text-amber-300">Endereço indisponível: o ambiente recusa endereço provisório.</p>}
              </div>

              <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Lote</dt>
                <dd>
                  <Link href={`/admin/estoque/lotes/${plate.batch.id}`} className="underline-offset-4 hover:underline">
                    {plate.batch.code}
                  </Link>
                </dd>
                <dt className="text-muted-foreground">Cliente</dt>
                <dd>
                  {plate.card ? (
                    <Link href={`/admin/empresas/${plate.card.companyId}`} className="underline-offset-4 hover:underline">
                      {plate.card.companyName}
                    </Link>
                  ) : (
                    "Sem dono"
                  )}
                  {plate.card ? <span className="block text-xs text-muted-foreground">{plate.card.name}</span> : null}
                </dd>
                {detail.order ? (
                  <>
                    <dt className="text-muted-foreground">Pedido</dt>
                    <dd>
                      <Link href="/admin/pedidos" className="underline-offset-4 hover:underline">
                        {detail.order.customerName}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{detail.order.status} · {formatDateTime(detail.order.createdAt)}</span>
                    </dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">Conferência</dt>
                <dd>
                  NFC {plate.nfcChecked ? "✓" : "—"} · QR {plate.qrChecked ? "✓" : "—"} · Série {plate.serialChecked ? "✓" : "—"}
                  {plate.verifiedAt ? <span className="block text-xs text-muted-foreground">Conferida em {formatDateTime(plate.verifiedAt)}</span> : null}
                </dd>
                {!plate.card ? (
                  <>
                    <dt className="text-muted-foreground">Toques</dt>
                    <dd>
                      {plate.scanCount}
                      {plate.lastScannedAt ? <span className="block text-xs text-muted-foreground">Último em {formatDateTime(plate.lastScannedAt)}</span> : null}
                    </dd>
                  </>
                ) : null}
                {plate.defectReason ? (
                  <>
                    <dt className="text-muted-foreground">Motivo</dt>
                    <dd>{plate.defectReason}</dd>
                  </>
                ) : null}
              </dl>

              <div className="flex items-center gap-3 rounded-lg border p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- QR em SVG gerado pela própria API; esconde se o ambiente recusar */}
                <img src={`/api/qr/${plate.uniqueCode}?format=svg&size=256`} alt={`QR da placa ${plate.serial}`} width={88} height={88} className="size-22 rounded-md bg-white" onError={(e) => (e.currentTarget.style.display = "none")} />
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>QR desta placa, como será impresso.</p>
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api/qr/${plate.uniqueCode}?format=svg&size=1024&download=1`} download>
                      <Download className="size-3.5" /> Baixar SVG
                    </a>
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {!plate.card && !retired ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setDialog("defective")}>
                      Marcar defeituosa
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDialog("void")}>
                      Anular
                    </Button>
                  </>
                ) : null}
                {retired ? (
                  <Button variant="outline" size="sm" onClick={() => act({ action: "restore" }, "Placa restaurada: volta a ser conferida do zero.")}>
                    <RotateCcw className="size-3.5" /> Restaurar
                  </Button>
                ) : null}
                {plate.card ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setDialog("replace")}>
                      Trocar placa
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDialog("unassign")}>
                      <Undo2 className="size-3.5" /> Devolver ao estoque
                    </Button>
                  </>
                ) : null}
              </div>

              <section aria-labelledby="trilha-titulo" className="space-y-2">
                <h3 id="trilha-titulo" className="text-sm font-semibold">
                  Histórico
                </h3>
                <ol className="space-y-2 border-l pl-4">
                  {detail.events.map((event) => (
                    <li key={event.id} className="relative text-sm">
                      <span aria-hidden="true" className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-border" />
                      <p>{EVENT_LABEL[event.type] ?? event.type}</p>
                      {event.note ? <p className="text-xs text-muted-foreground">{event.note}</p> : null}
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(event.createdAt)}
                        {event.actor ? ` · ${event.actor}` : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          ) : !error ? (
            <p className="px-4 text-sm text-muted-foreground">Carregando…</p>
          ) : null}
        </SheetContent>
      </Sheet>

      <ReasonDialog
        open={dialog === "defective"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Marcar como defeituosa"
        description="A placa sai do estoque e não pode ser vendida. Dá para restaurar depois."
        confirmLabel="Marcar defeituosa"
        onConfirm={(reason) => act({ action: "defective", reason }, "Placa marcada como defeituosa.")}
      />
      <ReasonDialog
        open={dialog === "void"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Anular placa"
        description="Use para placas perdidas, quebradas ou que nunca devem ser usadas. Fica registrado no histórico."
        confirmLabel="Anular placa"
        onConfirm={(reason) => act({ action: "void", reason }, "Placa anulada.")}
      />
      {plate?.card ? <ReplaceDialog open={dialog === "replace"} onOpenChange={(open) => !open && setDialog(null)} plate={plate} onDone={refresh} /> : null}
      <ConfirmDialog
        open={dialog === "unassign"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Devolver a placa ao estoque?"
        description="A placa volta a ficar disponível e o cartão do cliente recebe um código novo. Se o cliente já tiver essa placa na mão, o QR dela deixa de funcionar."
        confirmLabel="Devolver ao estoque"
        busy={busy}
        onConfirm={async () => {
          if (!plateId) return;
          setBusy(true);
          try {
            const { ok, data } = await call(`/api/admin/plates/${plateId}/assign`, { method: "DELETE" });
            if (!ok) return void toast.error(data.error ?? "Não foi possível devolver");
            toast.success("Placa devolvida ao estoque.");
            setDialog(null);
            await refresh();
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
