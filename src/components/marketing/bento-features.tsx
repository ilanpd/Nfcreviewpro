"use client";

import { BarChart3, Flame, Wand2, Palette, Code2, TrendingUp, ArrowUpRight } from "lucide-react";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { NumberTicker } from "@/components/ui/number-ticker";
import { BorderBeam } from "@/components/ui/border-beam";

/**
 * Seis capacidades REAIS do produto (ROADMAP.md) — nunca recursos
 * inventados para a Landing parecer mais completa do que é. Os números
 * dentro de cada mockup são ilustrativos (mesma convenção do "Rocket
 * Rides" da Stripe: uma prévia de produto, não uma promessa de resultado
 * para quem está visitando a página).
 */

function AnalyticsBackground() {
  const bars = [40, 65, 50, 80, 60, 95, 70];
  return (
    <div className="absolute inset-0 flex items-start justify-center overflow-hidden p-5 pt-16">
      <div className="w-full max-w-sm rounded-xl border border-border/60 bg-background/90 p-4 shadow-premium backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Avaliações captadas</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              <NumberTicker value={1284} />
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Conversão</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
              <NumberTicker value={68} decimalPlaces={1} />%
            </p>
          </div>
        </div>
        <div className="mt-5 flex h-16 items-end gap-1.5">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm bg-brand/70"
              style={{ height: `${h}%`, animation: `bento-bar-rise 0.6s var(--ease-spring) ${i * 0.06}s backwards` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function HeatmapBackground() {
  const cells = Array.from({ length: 24 }, (_, i) => {
    const intensity = [0.15, 0.3, 0.55, 0.85, 0.35, 0.2][i % 6];
    const breathing = intensity > 0.7;
    return { intensity, breathing };
  });
  return (
    <div className="absolute inset-0 flex items-start justify-center p-5 pt-16">
      <div className="grid grid-cols-4 gap-2">
        {cells.map((cell, i) => (
          <div
            key={i}
            className={cell.breathing ? "heatmap-breathe rounded-md" : "rounded-md"}
            style={{
              width: 22,
              height: 22,
              backgroundColor: `color-mix(in oklch, var(--brand) ${cell.intensity * 100}%, transparent)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PlaybooksBackground() {
  return (
    <div className="absolute inset-0 flex flex-col justify-start gap-3 p-5 pt-16">
      {[
        { name: "Happy Hour Boost", confidence: 92 },
        { name: "Silent Zone Rescue", confidence: 78 },
      ].map((p) => (
        <div
          key={p.name}
          className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/90 px-4 py-3 shadow-subtle backdrop-blur-sm"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand">
            <Wand2 className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
            <p className="text-xs text-muted-foreground">{p.confidence}% de confiança</p>
          </div>
          <span className="shrink-0 rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            Aplicar
          </span>
        </div>
      ))}
    </div>
  );
}

function WhiteLabelBackground() {
  const colors = ["var(--brand)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
  return (
    <div className="absolute inset-0 flex items-start justify-center p-5 pt-14">
      <div className="flex items-center gap-2">
        {colors.map((c, i) => (
          <div
            key={i}
            className="size-8 rounded-full border-2 border-background shadow-subtle"
            style={{ backgroundColor: c, marginLeft: i === 0 ? 0 : -10 }}
          />
        ))}
      </div>
    </div>
  );
}

function ApiBackground() {
  return (
    <div className="absolute inset-0 flex items-start justify-center p-5 pt-14">
      <div className="w-full rounded-lg bg-[#0B0E14] p-4 font-mono text-[11px] leading-relaxed shadow-premium">
        <p className="text-emerald-400">POST /api/v1/campaigns</p>
        <p className="text-slate-400">
          {"{"} <span className="text-sky-300">&quot;type&quot;</span>: <span className="text-amber-300">&quot;GOOGLE_REVIEW&quot;</span> {"}"}
        </p>
        <p className="text-slate-500">200 OK · 82ms</p>
      </div>
    </div>
  );
}

function RoiBackground() {
  return (
    <>
      {/* Único card com Border Beam — "destaque" do grid, o único cuja
          receita é a mensagem principal (Princípio 2: comunica o estado
          "isto é a métrica que mais importa"), nunca aplicado nos outros. */}
      <BorderBeam colorFrom="var(--brand)" colorTo="var(--chart-2)" size={90} duration={6} />
      <div className="absolute inset-0 flex items-start justify-center p-5 pt-14">
        <div className="text-center">
          <p className="flex items-center justify-center gap-1 text-4xl font-semibold tracking-tight text-foreground">
            R$ <NumberTicker value={4820} />
          </p>
          <p className="mt-2 flex items-center justify-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <ArrowUpRight className="size-3.5" />
            receita estimada este mês
          </p>
        </div>
      </div>
    </>
  );
}

const FEATURES = [
  {
    name: "Analytics em tempo real",
    description: "KPIs, funil e ranking de equipe — atualizados enquanto o salão funciona, não no fim do dia.",
    Icon: BarChart3,
    href: "/sign-up",
    cta: "Ver Analytics",
    background: <AnalyticsBackground />,
    className: "md:col-span-2 md:row-span-2",
  },
  {
    name: "Heatmap das mesas",
    description: "Veja quais mesas aquecem e quais esfriam, em tempo real.",
    Icon: Flame,
    href: "/sign-up",
    cta: "Ver Mapa de Mesas",
    background: <HeatmapBackground />,
    className: "md:col-span-1 md:row-span-2",
  },
  {
    name: "Playbooks inteligentes",
    description: "O sistema recomenda a próxima ação — e executa com um clique, sempre com Desfazer.",
    Icon: Wand2,
    href: "/sign-up",
    cta: "Ver Playbooks",
    background: <PlaybooksBackground />,
    className: "md:col-span-2 md:row-span-1",
  },
  {
    name: "API Pública",
    description: "SDK oficial, webhooks e documentação real — pronto para integrar.",
    Icon: Code2,
    href: "/developers",
    cta: "Ver documentação",
    background: <ApiBackground />,
    className: "md:col-span-1 md:row-span-1",
  },
  {
    name: "White Label",
    description: "Cor, logo e domínio próprios em cada tela, QR Code e impressão.",
    Icon: Palette,
    href: "/sign-up",
    cta: "Ver Theme Studio",
    background: <WhiteLabelBackground />,
    className: "md:col-span-1 md:row-span-1",
  },
  {
    name: "ROI Mode",
    description: "Cada toque convertido em receita estimada — a fórmula sempre visível, nunca uma caixa-preta.",
    Icon: TrendingUp,
    href: "/sign-up",
    cta: "Calcular ROI",
    background: <RoiBackground />,
    className: "md:col-span-2 md:row-span-1",
  },
] as const;

export function BentoFeatures() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Um sistema operacional, não uma planilha de QR Codes
        </h2>
        <p className="mt-4 text-muted-foreground">
          Cada cartão NFC alimenta o mesmo motor — analytics, automação e marca própria, desde o primeiro toque.
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
