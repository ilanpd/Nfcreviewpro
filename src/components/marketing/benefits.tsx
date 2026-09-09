import { BarChart3, ShieldCheck, Smartphone, Timer, Users, Zap } from "lucide-react";

const BENEFITS = [
  { icon: Zap, title: "Mais avaliações no Google", description: "Facilite ao máximo o passo que a maioria dos clientes nunca dá." },
  { icon: ShieldCheck, title: "Blindagem de reputação", description: "Clientes insatisfeitos falam com você primeiro — não com o mundo." },
  { icon: BarChart3, title: "Dados em tempo real", description: "Acompanhe acessos, conversões e satisfação por cartão e por período." },
  { icon: Users, title: "Ranking de equipe", description: "Descubra quem no seu time mais gera experiências memoráveis." },
  { icon: Smartphone, title: "Zero fricção", description: "Sem app para baixar, sem cadastro — funciona com um toque ou QR Code." },
  { icon: Timer, title: "Ativo em minutos", description: "Cadastre sua empresa, gere os cartões e comece a coletar hoje mesmo." },
];

export function Benefits() {
  return (
    <section className="bg-muted/30 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Feito para negócios que vivem de reputação</h2>
          <p className="mt-4 text-muted-foreground">
            Restaurantes, clínicas, academias, barbearias, hotéis e lojas já usam o NFC Review Pro.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="rounded-xl bg-background p-6 shadow-sm shadow-black/5">
              <benefit.icon className="size-6 text-primary" strokeWidth={1.5} />
              <h3 className="mt-4 font-medium">{benefit.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
