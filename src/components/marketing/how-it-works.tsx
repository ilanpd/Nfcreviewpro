import { CreditCard, MessageCircleHeart, Star } from "lucide-react";

const STEPS = [
  {
    icon: CreditCard,
    title: "Cliente aproxima o cartão",
    description: "Um toque do celular no cartão NFC (ou a leitura do QR Code) abre a página de avaliação em segundos.",
  },
  {
    icon: Star,
    title: "Avalia com estrelas",
    description: "Uma tela simples pergunta como foi a experiência — sem cadastro, sem fricção, direto do celular.",
  },
  {
    icon: MessageCircleHeart,
    title: "Direcionamento inteligente",
    description:
      "4 ou 5 estrelas vão direto para o Google Reviews. 1 a 3 estrelas viram um feedback privado, com aviso automático no seu WhatsApp.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Como funciona</h2>
        <p className="mt-4 text-muted-foreground">
          Do toque no cartão até a avaliação publicada, tudo acontece em menos de 30 segundos.
        </p>
      </div>

      <div className="mt-16 grid gap-8 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step.title} className="relative rounded-2xl border border-black/5 bg-card p-8 shadow-sm shadow-black/5">
            <span className="absolute -top-4 left-8 flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <step.icon className="mt-2 size-8 text-primary" strokeWidth={1.5} />
            <h3 className="mt-5 text-lg font-medium">{step.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
