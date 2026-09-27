"use client";

import { useState } from "react";
import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { ArrowRight, Check, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlurFade } from "@/components/ui/blur-fade";
import { PremiumModal } from "@nfc-os/ui";
import { NfcCardMockup } from "@/components/marketing/nfc-card-mockup";
import { DestinationPicker } from "@/components/destination-picker";
import { cn } from "@/lib/utils";
import { formatCentsToBRL, type StoreProduct } from "@/lib/store-products";

// Consistência de tokens (Auditoria Nível Bilionário, 11/09/2026) — os três
// eram uma mistura de hex cru e variável CSS; agora os três são tokens reais.
const ACCENTS = ["var(--muted-foreground)", "var(--brand)", "var(--accent-premium)"];

/**
 * Catálogo, não tabela de planos (achado real de QA: com o layout anterior
 * — 3 cards com checklist de features — a loja parecia uma segunda tela de
 * assinatura de software, não um produto físico à venda). Cada "produto" é
 * na verdade o mesmo cartão em 3 tamanhos de pacote — o padrão exato de
 * "compre mais, pague menos por unidade" que Amazon/Mercado Livre usam para
 * uma variante de quantidade, não 3 SKUs diferentes. `products` já vem com
 * as fotos/preços do Painel Admin mesclados (ver `loja/page.tsx`) — este
 * componente nunca lê o catálogo estático direto.
 */
export function StoreProductGrid({ products }: { products: StoreProduct[] }) {
  const [selected, setSelected] = useState<StoreProduct | null>(null);

  return (
    <section id="produtos" className="bg-muted/30 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <BlurFade inView>
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-sm font-medium text-muted-foreground">Cartão NFC — o mesmo produto, em 3 tamanhos de pacote</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Escolha o tamanho do seu pacote</h2>
            <p className="mt-4 text-muted-foreground">Quanto maior o volume, menor o preço por cartão.</p>
          </div>
        </BlurFade>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {products.map((product, i) => (
            <BlurFade key={product.id} delay={0.08 * i} inView>
              <div
                className={cn(
                  "relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-subtle transition-shadow hover:shadow-elevated",
                  product.highlighted ? "border-brand shadow-premium" : "border-border/60"
                )}
              >
                <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 p-6">
                  {product.badge ? (
                    <span
                      className={cn(
                        "absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-medium",
                        product.highlighted ? "bg-brand text-brand-foreground" : "bg-white/10 text-white"
                      )}
                    >
                      {product.badge}
                    </span>
                  ) : null}
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="mx-auto aspect-[8/5] w-full max-w-[220px] rounded-xl object-cover shadow-lg"
                    />
                  ) : (
                    <NfcCardMockup accent={ACCENTS[i] ?? "var(--brand)"} className="mx-auto h-auto w-full max-w-[220px]" />
                  )}
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-lg font-semibold">{product.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-3xl font-semibold tracking-tight">{formatCentsToBRL(product.unitPriceCents)}</span>
                    <span className="text-sm text-muted-foreground">/ cartão</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {product.quantity}x cartões · total {formatCentsToBRL(product.unitPriceCents * product.quantity)}
                  </p>
                  <p className="mt-4 text-sm text-muted-foreground">{product.description}</p>
                  <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-ink" />
                      <span className="text-muted-foreground">Chip NFC + QR Code dinâmico no mesmo cartão</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-ink" />
                      <span className="text-muted-foreground">Link de destino configurado antes do envio</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-ink" />
                      <span className="text-muted-foreground">Acompanhamento do pedido por link direto</span>
                    </li>
                  </ul>
                  <Button
                    className="mt-6 w-full"
                    size="lg"
                    variant={product.highlighted ? "default" : "outline"}
                    onClick={() => setSelected(product)}
                  >
                    <CreditCard className="size-4" /> Comprar agora
                  </Button>
                </div>
              </div>
            </BlurFade>
          ))}
        </div>
      </div>

      <PurchaseDialog product={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </section>
  );
}

function PurchaseDialog({ product, onOpenChange }: { product: StoreProduct | null; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    if (!destinationUrl) {
      toast.error("Escolha ou preencha para onde o cartão deve redirecionar.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          customerName: name,
          customerEmail: email,
          customerDocument: document,
          customerPhone: phone,
          destinationUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível iniciar o pagamento");
      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
      setLoading(false);
    }
  }

  return (
    <PremiumModal
      open={!!product}
      onOpenChange={onOpenChange}
      icon={CreditCard}
      title={product ? `Comprar — ${product.name}` : ""}
      footer={
        <Button type="submit" form="store-purchase-form" disabled={loading}>
          {loading ? "Redirecionando…" : `Pagar ${product ? formatCentsToBRL(product.unitPriceCents * product.quantity) : ""}`}
        </Button>
      }
    >
      <form id="store-purchase-form" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store-name">Seu nome</Label>
            <Input id="store-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-email">E-mail</Label>
            <Input id="store-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <p className="text-xs text-muted-foreground">
              Se você já tem (ou vier a criar) uma conta no {BRAND.name} com este e-mail, seus cartões aparecem
              automaticamente nela.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="store-document">CPF ou CNPJ</Label>
              <Input
                id="store-document"
                inputMode="numeric"
                placeholder="Só números"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-phone">Telefone</Label>
              <Input
                id="store-phone"
                type="tel"
                placeholder="DDD + número"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </div>
          <DestinationPicker value={destinationUrl} onChange={setDestinationUrl} />
          <p className="text-xs text-muted-foreground">
            Ao pagar, você concorda com os{" "}
            <Link href="/termos" className="underline">
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" className="underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </div>
      </form>
      {product ? (
        <div className="mt-4 rounded-lg border border-dashed border-brand/40 bg-brand-subtle/20 p-3 text-center text-xs">
          <p className="text-muted-foreground">Já sabe que quer usar o software?</p>
          <a
            href={`/sign-up?plan=STARTER&cardProductId=${product.id}`}
            className="mt-1 inline-flex items-center gap-1 font-medium text-brand-ink hover:underline"
          >
            Assine com este cartão incluso <ArrowRight className="size-3.5" />
          </a>
        </div>
      ) : null}
    </PremiumModal>
  );
}
