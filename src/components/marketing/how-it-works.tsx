"use client";

import { useRef } from "react";
import { CreditCard, Nfc, Cpu, Target, BarChart3, Wand2 } from "lucide-react";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { GridPattern } from "@/components/ui/grid-pattern";
import { BlurFade } from "@/components/ui/blur-fade";
import { cn } from "@/lib/utils";

/**
 * O pipeline real do NFC OS (ROADMAP.md, Fase 1 em diante — nunca inventado
 * para a Landing): um Ativo NFC nunca aponta direto para um Destino, tudo
 * passa por um Resolvedor. Esta seção visualiza esse pipeline de verdade,
 * não uma ilustração genérica de "como funciona".
 */
const NODES = [
  { key: "cliente", icon: CreditCard, label: "Cliente" },
  { key: "nfc", icon: Nfc, label: "Toque NFC" },
  { key: "engine", icon: Cpu, label: "Resolution Engine" },
  { key: "destino", icon: Target, label: "Destino inteligente" },
  { key: "analytics", icon: BarChart3, label: "Analytics" },
  { key: "playbooks", icon: Wand2, label: "Playbooks" },
] as const;

function FlowNode({
  icon: Icon,
  label,
  nodeRef,
  index,
}: {
  icon: React.ElementType;
  label: string;
  nodeRef: React.RefObject<HTMLDivElement | null>;
  index: number;
}) {
  return (
    <BlurFade delay={0.06 * index} inView inViewMargin="-80px">
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          ref={nodeRef}
          className="flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-card shadow-elevated"
        >
          <Icon className="size-6 text-brand" strokeWidth={1.5} />
        </div>
        <p className="w-20 text-xs font-medium text-muted-foreground">{label}</p>
      </div>
    </BlurFade>
  );
}

export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];

  return (
    <section id="como-funciona" className="relative overflow-hidden py-24">
      <GridPattern
        width={40}
        height={40}
        className={cn(
          "absolute inset-0 -z-10 fill-foreground/[0.025] stroke-foreground/[0.06]",
          "[mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]"
        )}
      />

      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Como funciona</h2>
        <p className="mt-4 text-muted-foreground">
          Nenhum cartão NFC aponta direto para um destino — tudo passa por um motor de decisão em tempo real. Do
          toque à ação seguinte, em menos de 30 segundos.
        </p>
      </div>

      <div ref={containerRef} className="relative mx-auto mt-16 max-w-4xl px-6">
        <div className="flex flex-wrap items-start justify-center gap-x-4 gap-y-10 sm:flex-nowrap sm:justify-between">
          {NODES.map((node, i) => (
            <FlowNode key={node.key} icon={node.icon} label={node.label} nodeRef={refs[i]} index={i} />
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 hidden sm:block">
          {refs.slice(0, -1).map((fromRef, i) => (
            <AnimatedBeam
              key={NODES[i].key}
              containerRef={containerRef}
              fromRef={fromRef}
              toRef={refs[i + 1]}
              curvature={0}
              duration={4}
              delay={i * 0.4}
              pathColor="var(--border)"
              pathWidth={2}
              pathOpacity={0.4}
              gradientStartColor="var(--brand)"
              gradientStopColor="var(--chart-2)"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
