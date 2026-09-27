"use client";

import { Gift, Smartphone, MessageCircleHeart, LifeBuoy, BarChart3, Building2 } from "lucide-react";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { formatVoucherCode } from "@/domain/return-offer/code";

/**
 * Seis capacidades REAIS do produto — nunca recursos inventados para a
 * Landing parecer mais completa do que é. Os números/exemplos dentro de
 * cada mockup são ilustrativos (mesma convenção do "Rocket Rides" da
 * Stripe: uma prévia de produto, não uma promessa de resultado).
 *
 * C10 (ADR-085) — reescrito porque as 6 telas antigas eram 100%
 * recursos do Pro/Business (Analytics, Heatmap, Playbooks, API, White
 * Label, ROI Mode) — nenhuma mencionava o Retorno nem o cartão físico,
 * que são literalmente o que o Starter vende hoje (Pulse virou Starter
 * First, Pro/Business congelados). Um visitante lia a home inteira sendo
 * vendido em recursos que o próprio plano que ele assinaria não inclui —
 * prejudica venda (expectativa errada) e experiência (frustração pós-
 * cadastro). Agora: 4 blocos são o que o Starter realmente entrega hoje,
 * e os 2 últimos viram um convite honesto pra crescer — rotulados "No
 * Pro"/"No Business", nunca escondidos, mas nunca a promessa principal.
 */

function RetornoBackground() {
  const code = formatVoucherCode("K7X4QM");
  return (
    <div className="absolute inset-0 flex items-start justify-center overflow-hidden p-5 pt-16">
      <div className="w-full max-w-sm rounded-xl border border-border/60 bg-background/90 p-4 shadow-premium backdrop-blur-sm">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Exemplo ilustrativo</p>
        <div className="flex items-center gap-3 rounded-lg bg-brand-subtle/40 p-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <Gift className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Sobremesa grátis</p>
            <p className="text-xs text-muted-foreground">Válida na próxima visita</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-dashed border-border/60 px-3 py-2">
          <span className="font-mono text-sm font-semibold tracking-wider text-foreground">{code}</span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            Pronto pra resgatar
          </span>
        </div>
      </div>
    </div>
  );
}

function CardTapBackground() {
  return (
    <div className="absolute inset-0 flex items-start justify-center p-5 pt-16">
      <div className="relative flex size-28 items-center justify-center">
        <span className="heatmap-breathe absolute inset-0 rounded-full border-2 border-brand/40" />
        <span className="absolute inset-3 rounded-full border-2 border-brand/25" />
        <span className="flex size-14 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-premium">
          <Smartphone className="size-6" />
        </span>
      </div>
    </div>
  );
}

function FeedbackBackground() {
  return (
    <div className="absolute inset-0 flex items-start justify-center p-5 pt-16">
      <div className="w-full max-w-xs space-y-2">
        <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm bg-brand px-3.5 py-2 text-xs text-brand-foreground shadow-subtle">
          A fila hoje tava um pouco longa, mas o atendimento foi ótimo!
        </div>
        <div className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm border border-border/60 bg-background/90 px-3.5 py-2 text-xs text-foreground shadow-subtle backdrop-blur-sm">
          Obrigado pelo retorno! Vamos abrir mais um caixa no horário de pico 🙏
        </div>
      </div>
    </div>
  );
}

function HelpBackground() {
  const rows = ["Como ativo o brinde?", "Perdi meu link, e agora?", "Cobrança atrasou, o que muda?"];
  return (
    <div className="absolute inset-0 flex items-start justify-center p-5 pt-16">
      <div className="w-full max-w-sm space-y-2">
        {rows.map((row) => (
          <div
            key={row}
            className="flex items-center justify-between rounded-lg border border-border/60 bg-background/90 px-3 py-2 text-xs text-foreground shadow-subtle backdrop-blur-sm"
          >
            {row}
            <span className="text-muted-foreground">→</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GrowthBadge({ label }: { label: string }) {
  return (
    <span className="absolute right-4 top-4 rounded-full border border-border/60 bg-background/90 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-subtle backdrop-blur-sm">
      {label}
    </span>
  );
}

function AnalyticsGrowthBackground() {
  const bars = [40, 65, 50, 80, 60, 95, 70];
  return (
    <div className="absolute inset-0 flex items-start justify-center overflow-hidden p-5 pt-16">
      <GrowthBadge label="No Pro" />
      <div className="w-full max-w-sm rounded-xl border border-border/60 bg-background/90 p-4 shadow-premium backdrop-blur-sm">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Exemplo ilustrativo</p>
        <div className="flex h-16 items-end gap-1.5">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm bg-brand/70"
              style={{ height: `${h}%`, animation: `bento-bar-rise 0.6s var(--ease-spring) ${i * 0.06}s backwards` }}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Analytics, Mapa de Mesas e Playbooks automáticos</p>
      </div>
    </div>
  );
}

function ApiGrowthBackground() {
  return (
    <div className="absolute inset-0 flex items-start justify-center p-5 pt-14">
      <GrowthBadge label="No Business" />
      <div className="w-full rounded-lg bg-[#0B0E14] p-4 font-mono text-[11px] leading-relaxed shadow-premium">
        <p className="text-emerald-400">POST /api/v1/campaigns</p>
        <p className="text-slate-400">
          {"{"} <span className="text-sky-300">&quot;type&quot;</span>: <span className="text-amber-300">&quot;GOOGLE_REVIEW&quot;</span> {"}"}
        </p>
        <p className="text-slate-500">200 OK · marca própria em cada tela</p>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    name: "Retorno: o brinde que traz o cliente de volta",
    description: "Todo toque no cartão já sai com um código de brinde reservado pra próxima visita — sem cupom pra imprimir, sem aplicativo.",
    Icon: Gift,
    href: "/ajuda",
    cta: "Ver como funciona",
    background: <RetornoBackground />,
    className: "md:col-span-2 md:row-span-2",
  },
  {
    name: "Cartão NFC + QR Code",
    description: "Toque ou escaneie — funciona em qualquer celular, sem instalar nada.",
    Icon: Smartphone,
    href: "/sign-up",
    cta: "Começar grátis",
    background: <CardTapBackground />,
    className: "md:col-span-1 md:row-span-2",
  },
  {
    name: "Canal de feedback privado",
    description: "Cliente insatisfeito fala direto com você no WhatsApp — nunca vira avaliação pública de 1 estrela.",
    Icon: MessageCircleHeart,
    href: "/sign-up",
    cta: "Ver Mensagens",
    background: <FeedbackBackground />,
    className: "md:col-span-2 md:row-span-1",
  },
  {
    name: "Central de Ajuda",
    description: "Respostas diretas pro seu cliente e pra você, sem precisar abrir chamado.",
    Icon: LifeBuoy,
    href: "/ajuda",
    cta: "Ver a Central",
    background: <HelpBackground />,
    className: "md:col-span-1 md:row-span-1",
  },
  {
    name: "Quando crescer: Analytics, Mapa de Mesas e Playbooks",
    description: "Automação, heatmap de mesas e recomendações com um clique — libera no Pro, quando fizer sentido pro seu volume.",
    Icon: BarChart3,
    href: "/#planos",
    cta: "Ver planos",
    background: <AnalyticsGrowthBackground />,
    className: "md:col-span-1 md:row-span-1",
  },
  {
    name: "Quando crescer: API pública e marca própria",
    description: "Múltiplas unidades, domínio e login com a sua cara, integrações via API — libera no Business.",
    Icon: Building2,
    href: "/#planos",
    cta: "Ver planos",
    background: <ApiGrowthBackground />,
    className: "md:col-span-2 md:row-span-1",
  },
] as const;

export function BentoFeatures() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Feito pra fazer o cliente voltar, não só avaliar
        </h2>
        <p className="mt-4 text-muted-foreground">
          O cartão físico, o brinde do Retorno e o canal de feedback já vêm no Starter — o mesmo motor cresce com
          você quando chegar a hora do Pro ou do Business.
        </p>
      </div>

      <BentoGrid className="mt-16 grid-cols-1 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <BentoCard key={feature.name} {...feature} />
        ))}
      </BentoGrid>
    </section>
  );
}
