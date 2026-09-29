import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { copyright } from "@/lib/brand";
import { BrandWordmark } from "@/components/brand/brand-wordmark";

/**
 * Achado de auditoria de potencial de venda (29/09/2026): o rodapé não tinha
 * nenhum sinal de confiança perto de onde a compra acontece — comum em
 * qualquer loja online, e mais ainda pra uma marca nova sem depoimento
 * nenhum ainda (ADR-075 removeu os fabricados; nada honesto ocupou o
 * espaço). Deliberadamente SEM logo de bandeira de cartão (Visa/Mastercard):
 * exigiria aprovar o uso da marca de cada uma, e o código não sabe — nem
 * deveria adivinhar — quais métodos estão de fato ativados na conta Stripe.
 * "Processado com segurança pela Stripe" é verdade em qualquer configuração.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-black/5">
      <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted-foreground">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Link href="/" className="flex items-center gap-2 font-medium text-foreground">
            <BrandWordmark />
          </Link>
          <nav aria-label="Links" className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/ajuda" className="hover:text-foreground">
              Central de Ajuda
            </Link>
            <Link href="/contato" className="hover:text-foreground">
              Contato
            </Link>
            <Link href="/termos" className="hover:text-foreground">
              Termos de Uso
            </Link>
            <Link href="/privacidade" className="hover:text-foreground">
              Privacidade
            </Link>
          </nav>
          <p>{copyright(new Date().getFullYear())}</p>
        </div>
        <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-black/5 pt-6 text-xs text-muted-foreground/80 sm:justify-start">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
          Pagamento processado com segurança pela Stripe
        </div>
      </div>
    </footer>
  );
}
