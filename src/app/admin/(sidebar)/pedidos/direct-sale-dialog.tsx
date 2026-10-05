"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DestinationPicker } from "@/components/destination-picker";
import { PlatePicker, isPickReady, pickToPayload, type PickValue } from "@/components/admin/plate-picker";
import { STORE_PRODUCTS, formatCentsToBRL } from "@/lib/store-products";
import { cn } from "@/lib/utils";
import { useCopy } from "@/hooks/use-copy";

/**
 * Venda direta (C14, ADR-089) — o dono pediu explicitamente: ele vende
 * cartão físico por fora do site (pessoalmente, PIX, o que for). Este
 * diálogo registra a venda no MESMO pipeline de um pedido online
 * (`createDirectSaleOrder` → `provisionStoreOrder`) — os cartões e o link
 * de edição já existem ao fechar o diálogo, prontos pra compartilhar com o
 * cliente ali mesmo.
 */
export function DirectSaleDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState(STORE_PRODUCTS[0]?.id ?? "");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [editLinks, setEditLinks] = useState<string[] | null>(null);
  // Estoque de placas (ADR-092): sem escolha, nada muda — a venda segue sob demanda como sempre.
  const [platePick, setPlatePick] = useState<PickValue>({ mode: "NONE" });
  const [deliveredPlates, setDeliveredPlates] = useState<string[]>([]);
  const [plateError, setPlateError] = useState<string | null>(null);
  const needed = STORE_PRODUCTS.find((p) => p.id === productId)?.quantity ?? 1;

  function reset() {
    setProductId(STORE_PRODUCTS[0]?.id ?? "");
    setDestinationUrl("");
    setName("");
    setEmail("");
    setDocument("");
    setPhone("");
    setEditLinks(null);
    setPlatePick({ mode: "NONE" });
    setDeliveredPlates([]);
    setPlateError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!destinationUrl) {
      toast.error("Escolha ou preencha para onde o cartão deve redirecionar.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orders/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, destinationUrl, customerName: name, customerEmail: email, customerDocument: document, customerPhone: phone, plates: pickToPayload(platePick) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível registrar a venda");

      setDeliveredPlates(((data.plates ?? []) as { serial: string }[]).map((p) => p.serial));
      setPlateError(data.plateError ?? null);
      const links: string[] = data.editLinks ?? [];
      setEditLinks(links.length > 0 ? links : ["Cartão(ões) criado(s) — veja em Empresas → cartões."]);
      if (data.plateError) toast.warning("Venda registrada, mas a placa não foi atribuída. Veja o aviso.");
      else toast.success("Venda registrada — cartão(ões) já provisionado(s).");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <ShoppingBag className="size-4" /> Registrar venda direta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar venda direta</DialogTitle>
          <DialogDescription>
            Para uma venda feita por fora do site (pessoalmente, PIX, o que for) — o pagamento já foi recebido por
            você. Isto cria o pedido como pago e já libera o(s) cartão(ões).
          </DialogDescription>
        </DialogHeader>

        {editLinks ? (
          <div className="space-y-3">
            {deliveredPlates.length > 0 ? (
              <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
                Entregue a placa <strong className="font-mono">{deliveredPlates.join(", ")}</strong>. Encoste o celular nela para testar antes de deixar com o cliente.
              </p>
            ) : null}
            {plateError ? (
              <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-200">
                A venda foi registrada, mas a placa não foi atribuída: {plateError} Atribua pelo detalhe do pedido.
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">Link(s) de edição do cliente — compartilhe agora:</p>
            {editLinks.map((link) => (
              <EditLinkCopyRow key={link} link={link} />
            ))}
            <Button className="w-full" onClick={() => setOpen(false)}>
              Concluir
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Pacote</Label>
              <div className="flex flex-wrap gap-2">
                {STORE_PRODUCTS.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setProductId(product.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      productId === product.id ? "border-brand bg-brand text-brand-foreground" : "hover:bg-muted"
                    )}
                  >
                    {product.quantity}x — {formatCentsToBRL(product.unitPriceCents * product.quantity)}
                  </button>
                ))}
              </div>
            </div>

            <DestinationPicker value={destinationUrl} onChange={setDestinationUrl} />

            <PlatePicker needed={needed} allowNone value={platePick} onChange={setPlatePick} idPrefix="direct" />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="direct-name">Nome do cliente</Label>
                <Input id="direct-name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="direct-email">E-mail</Label>
                <Input id="direct-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="direct-document">CPF ou CNPJ</Label>
                <Input id="direct-document" inputMode="numeric" required value={document} onChange={(e) => setDocument(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="direct-phone">Telefone</Label>
                <Input id="direct-phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full" disabled={loading || !isPickReady(platePick, needed)}>
                {loading ? "Registrando…" : "Registrar venda e liberar cartão"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Achado de auditoria (28/09/2026): usava `navigator.clipboard.writeText`
 * direto, sem tratar falha (e o botão de copiar não tinha `aria-label`) —
 * num clipboard bloqueado, dizia "Copiado" mesmo sem copiar nada. Reaproveita
 * `useCopy` (mesmo hook do cartão público em `/r/[code]` e de
 * `loja/sucesso/edit-link-list.tsx`), com uma segunda via e um aviso sincero
 * quando nenhuma funciona.
 */
function EditLinkCopyRow({ link }: { link: string }) {
  const { state, copy } = useCopy(link);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm" title={link}>
          {link}
        </span>
        <Button type="button" variant="ghost" size="icon" aria-label="Copiar link" onClick={copy}>
          {state === "copied" ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        </Button>
      </div>
      {state === "manual" ? (
        <p role="status" className="text-xs text-muted-foreground">
          Não deu para copiar sozinho. Toque e segure o link para copiar.
        </p>
      ) : null}
    </div>
  );
}
