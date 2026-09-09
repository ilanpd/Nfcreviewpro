import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Cta() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="rounded-3xl bg-foreground px-8 py-16 text-center text-background sm:px-16">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pronto para transformar sua reputação online?</h2>
        <p className="mx-auto mt-4 max-w-xl text-background/70">
          Configure sua empresa em minutos e receba seu primeiro cartão NFC pronto para uso.
        </p>
        <Link href="/sign-up" className="mt-8 inline-block">
          <Button size="lg" variant="secondary" className="gap-2">
            Começar grátis
            <ArrowRight className="size-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
