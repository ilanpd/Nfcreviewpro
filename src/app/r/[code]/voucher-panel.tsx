"use client";

import { Check, Copy, Gift, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { screenCopy, shareMessage, type TouchScreen } from "@/domain/return-offer/public-screen";
import { canNativeShare, nativeShare, useCopy } from "./use-copy";

/**
 * O brinde na tela do cliente (ADR-080): o texto do que ganhou, a validade e o
 * código, que é o brinde em si. Vale em qualquer celular: por isso o código fica
 * grande, copiável, e o aviso de salvá-lo está sempre aqui (o cookie é só
 * atalho). Sem animação: a página é leve de propósito.
 */
export function VoucherPanel({
  screen,
  companyName,
  onRedeem,
}: {
  screen: Extract<TouchScreen, { kind: "VOUCHER_NEW" | "VOUCHER_WAITING" | "VOUCHER_READY" }>;
  companyName: string;
  onRedeem: () => void;
}) {
  const copy = screenCopy(screen)!;
  const code = screen.voucher.code;
  const { state, copy: copyCode } = useCopy(code);
  const share = shareMessage(screen.voucher, companyName);
  const ready = screen.kind === "VOUCHER_READY";

  return (
    <section aria-label="Seu brinde" className="w-full rounded-2xl border border-brand/30 bg-brand-subtle p-5 text-left text-foreground">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-ink">
        <Gift className="size-4" aria-hidden />
        {copy.eyebrow}
      </div>
      <p className="mt-2 text-2xl font-semibold leading-tight">{copy.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{copy.detail}</p>

      <div className="mt-4 rounded-xl bg-background/80 px-4 py-3 text-center">
        <p className="text-xs text-muted-foreground">Código</p>
        <p className="select-all font-mono text-3xl font-semibold tracking-[0.2em]" data-testid="voucher-code">
          {code}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-11 gap-2" onClick={copyCode}>
          {state === "copied" ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {state === "copied" ? "Copiado" : "Copiar código"}
        </Button>
        {canNativeShare() ? (
          <Button type="button" variant="outline" className="h-11 gap-2" onClick={() => nativeShare(share)}>
            <Share2 className="size-4" aria-hidden />
            Enviar para mim
          </Button>
        ) : (
          <a
            href={`https://wa.me/?text=${encodeURIComponent(share)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
          >
            <Share2 className="size-4" aria-hidden />
            Enviar por WhatsApp
          </a>
        )}
      </div>
      {state === "manual" ? (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Não deu para copiar sozinho. Toque e segure o código para copiar.
        </p>
      ) : null}

      {ready ? (
        <Button type="button" className="mt-4 h-12 w-full text-base" onClick={onRedeem}>
          Resgatar agora
        </Button>
      ) : null}

      <p className="mt-4 text-xs text-muted-foreground">
        Guarde o código: ele vale em qualquer celular e só pode ser usado uma vez. Este brinde fica salvo neste aparelho e não pedimos nome nem telefone.
      </p>
    </section>
  );
}

/** Aviso sem código: brinde já usado, vencido, cancelado, ou a espera da carência. */
export function NoticePanel({ screen }: { screen: TouchScreen }) {
  const copy = screenCopy(screen);
  if (!copy) return null;
  return (
    <section aria-label="Aviso sobre o brinde" className="w-full rounded-2xl bg-muted p-5 text-left">
      <p className="text-base font-semibold">{copy.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{copy.detail}</p>
    </section>
  );
}
