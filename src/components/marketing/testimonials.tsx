"use client";

import { Star } from "lucide-react";
import { Marquee } from "@/components/ui/marquee";
import { MagicCard } from "@/components/ui/magic-card";
import { BlurFade } from "@/components/ui/blur-fade";

/** Depoimentos reais já usados pelo produto — nunca inventados para esta
 * seção parecer mais robusta. Ver `MANIFESTO_DO_DESIGN.md`/ADR-059. */
const TESTIMONIALS = [
  {
    quote: "Em dois meses nossas avaliações no Google mais que dobraram. O cartão fica no balcão e o cliente mesmo pede para avaliar.",
    name: "Marina Costa",
    role: "Restaurante Sabor & Arte",
  },
  {
    quote: "Os feedbacks negativos agora chegam no meu WhatsApp antes de virarem uma avaliação de 1 estrela pública.",
    name: "Rafael Nogueira",
    role: "Clínica OdontoVida",
  },
  {
    quote: "Consigo ver qual recepcionista recebe mais elogios. Virou parte da nossa avaliação de desempenho.",
    name: "Juliana Prado",
    role: "Academia Corpo & Cia",
  },
] as const;

function TestimonialCard({ testimonial }: { testimonial: (typeof TESTIMONIALS)[number] }) {
  return (
    <MagicCard
      className="w-80 shrink-0 rounded-2xl border-border/60 p-6"
      gradientFrom="var(--brand)"
      gradientTo="var(--chart-2)"
      gradientColor="var(--muted)"
      gradientOpacity={0.3}
    >
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
        ))}
      </div>
      <blockquote className="mt-4 text-sm text-muted-foreground">&ldquo;{testimonial.quote}&rdquo;</blockquote>
      <p className="mt-6 text-sm font-medium text-foreground">
        {testimonial.name}
        <span className="block font-normal text-muted-foreground">{testimonial.role}</span>
      </p>
    </MagicCard>
  );
}

export function Testimonials() {
  return (
    <section className="overflow-hidden py-24">
      <BlurFade inView>
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Quem usa, recomenda</h2>
        </div>
      </BlurFade>

      <div className="relative mt-16">
        <Marquee pauseOnHover className="[--duration:32s]">
          {TESTIMONIALS.map((testimonial) => (
            <TestimonialCard key={testimonial.name} testimonial={testimonial} />
          ))}
        </Marquee>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent" />
      </div>
    </section>
  );
}
