import { Check, X } from "lucide-react";
import { BlurFade } from "@/components/ui/blur-fade";
import { cn } from "@/lib/utils";

/**
 * "Pulse não é um QR Code" (C12, ADR-087) — a objeção mais óbvia de quem
 * já viu um QR impresso numa mesa em algum lugar. Comparação direta, sem
 * inflar o concorrente pra parecer pior do que é: um QR Code genérico
 * genuinamente não faz nenhuma das quatro coisas abaixo — não é exagero.
 */
const ROWS: { label: string; qr: boolean; pulse: boolean }[] = [
  { label: "Leva o cliente até a avaliação", qr: true, pulse: true },
  { label: "Sabe quando cada toque aconteceu", qr: false, pulse: true },
  { label: "Dá um motivo pro cliente voltar", qr: false, pulse: true },
  { label: "Muda de destino sem trocar o adesivo", qr: false, pulse: true },
  { label: "Mostra os dados num painel", qr: false, pulse: true },
];

export function Comparison() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-20">
      <BlurFade inView>
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Não é só um QR Code melhorado</h2>
          <p className="mt-4 text-muted-foreground">
            Um QR Code comum leva a algum lugar. O cartão Pulse leva, registra e traz de volta.
          </p>
        </div>
      </BlurFade>

      <BlurFade delay={0.08} inView offset={12}>
        <div className="mt-12 overflow-hidden rounded-2xl border border-border/60">
          <div className="grid grid-cols-[1fr_auto_auto] items-center bg-muted/40 px-5 py-3 text-sm font-medium sm:px-6">
            <span className="text-muted-foreground">&nbsp;</span>
            <span className="w-24 text-center text-muted-foreground sm:w-28">QR Code comum</span>
            <span className="w-24 text-center text-foreground sm:w-28">Pulse</span>
          </div>
          {ROWS.map((row, i) => (
            <div
              key={row.label}
              className={cn(
                "grid grid-cols-[1fr_auto_auto] items-center px-5 py-4 text-sm sm:px-6",
                i % 2 === 1 && "bg-muted/20"
              )}
            >
              <span className="pr-4 text-foreground">{row.label}</span>
              <span className="flex w-24 justify-center sm:w-28">
                {row.qr ? (
                  <Check className="size-4 text-muted-foreground" />
                ) : (
                  <X className="size-4 text-muted-foreground/50" />
                )}
              </span>
              <span className="flex w-24 justify-center sm:w-28">
                {row.pulse ? <Check className="size-4 text-brand-ink" /> : <X className="size-4 text-muted-foreground/50" />}
              </span>
            </div>
          ))}
        </div>
      </BlurFade>
    </section>
  );
}
