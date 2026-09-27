import Link from "next/link";
import { copyright } from "@/lib/brand";
import { BrandWordmark } from "@/components/brand/brand-wordmark";

export function SiteFooter() {
  return (
    <footer className="border-t border-black/5">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row">
        <Link href="/" className="flex items-center gap-2 font-medium text-foreground">
          <BrandWordmark />
        </Link>
        <nav aria-label="Legal" className="flex items-center gap-4">
          <Link href="/termos" className="hover:text-foreground">
            Termos de Uso
          </Link>
          <Link href="/privacidade" className="hover:text-foreground">
            Privacidade
          </Link>
        </nav>
        <p>{copyright(new Date().getFullYear())}</p>
      </div>
    </footer>
  );
}
