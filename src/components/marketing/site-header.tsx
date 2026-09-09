import Link from "next/link";
import { Nfc } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Nfc className="size-5" />
          NFC Review Pro
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#como-funciona" className="hover:text-foreground">
            Como funciona
          </a>
          <a href="#planos" className="hover:text-foreground">
            Planos
          </a>
          <a href="#faq" className="hover:text-foreground">
            FAQ
          </a>
          <Link href="/developers" className="hover:text-foreground">
            Desenvolvedores
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/sign-in">
            <Button variant="ghost">Entrar</Button>
          </Link>
          <Link href="/sign-up">
            <Button>Começar grátis</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
