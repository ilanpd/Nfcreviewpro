import { Star } from "lucide-react";

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
];

export function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Quem usa, recomenda</h2>
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((testimonial) => (
          <figure key={testimonial.name} className="flex flex-col rounded-2xl border border-black/5 bg-card p-8 shadow-sm shadow-black/5">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <blockquote className="mt-4 flex-1 text-sm text-muted-foreground">“{testimonial.quote}”</blockquote>
            <figcaption className="mt-6 text-sm font-medium">
              {testimonial.name}
              <span className="block font-normal text-muted-foreground">{testimonial.role}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
