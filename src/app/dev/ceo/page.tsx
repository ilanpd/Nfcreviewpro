import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, FileText, Layers, TrendingUp, Radio, HeartPulse, Satellite, Sparkles, Gauge } from "lucide-react";
import { KpiCard, AnalyticsCard, SmartBadge, Timeline } from "@nfc-os/ui";
import { Button } from "@/components/ui/button";
import { readDevStatus, countArchitectureDecisions } from "@/lib/dev-status";

// Mesmos dados de /dev, vistos como um resumo executivo: quanto está
// pronto, o que está pendente, riscos conhecidos, arquitetura e o backlog
// priorizado — sem detalhe de implementação linha a linha. Local dev/preview only.
export default function CeoModePage() {
  if (process.env.NODE_ENV === "production") notFound();

  const status = readDevStatus();
  const adrCount = countArchitectureDecisions();
  const readyModules = status.modules.filter((m) => m.status === "done");
  const pendingModules = status.modules.filter((m) => m.status !== "done");
  const backlog = status.phases.filter((p) => p.status !== "done");
  const shipped = status.phases.filter((p) => p.status === "done");
  const allGatesPassing = status.qualityGates.every((g) => g.passing);

  const timelineItems = status.phases.map((phase) => ({
    id: String(phase.id),
    title: `Fase ${phase.id} — ${phase.name}`,
    description: phase.summary,
    status: (phase.status === "done" ? "done" : phase.status === "in_progress" ? "current" : "upcoming") as
      | "done"
      | "current"
      | "upcoming",
  }));

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6 sm:p-10">
      <div className="space-y-2">
        <Link href="/dev" className="flex items-center gap-1 text-xs text-muted-foreground hover:underline">
          <ArrowLeft className="size-3" /> Status de build
        </Link>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Modo CEO</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">NFC Review Pro</h1>
            <p className="text-sm text-muted-foreground">Sistema Operacional de Marketing Físico — visão executiva</p>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dev/ceo/reliability">
                <HeartPulse className="size-3.5" /> Painel de Saúde
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dev/ceo/mission-control">
                <Satellite className="size-3.5" /> Mission Control
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dev/ceo/command-center">
                <Radio className="size-3.5" /> Command Center
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dev/command-center">
                <Gauge className="size-3.5" /> Command Center v2
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/demo">
                <Sparkles className="size-3.5" /> Demo OS
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Concluído no roadmap" value={`${status.overallPercent}%`} icon={<TrendingUp />} />
        <KpiCard label="Fases entregues" value={shipped.length} icon={<Layers />} />
        <KpiCard label="Fases no backlog" value={backlog.length} icon={<Clock />} />
        <KpiCard label="Decisões de arquitetura" value={adrCount} icon={<FileText />} hint="registradas em DECISOES_DE_ARQUITETURA.md" />
      </div>

      <AnalyticsCard
        title="Saúde do projeto"
        description="Os quatro quality gates obrigatórios ao final de toda fase — nenhuma fase é entregue com algum deles quebrado."
        action={
          <SmartBadge
            label={allGatesPassing ? "Tudo verde" : "Atenção necessária"}
            tone={allGatesPassing ? "success" : "danger"}
            pulse={allGatesPassing}
          />
        }
      >
        <div className="flex flex-wrap gap-2">
          {status.qualityGates.map((gate) => (
            <SmartBadge key={gate.name} label={gate.name} tone={gate.passing ? "success" : "danger"} />
          ))}
        </div>
      </AnalyticsCard>

      <AnalyticsCard title="Arquitetura" description="Os quatro pilares estruturais do produto até aqui.">
        <div className="grid gap-3 sm:grid-cols-2">
          {status.architecture.map((pillar) => (
            <div key={pillar.name} className="rounded-lg border border-border/60 p-3">
              <p className="text-sm font-semibold text-foreground">{pillar.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{pillar.description}</p>
            </div>
          ))}
        </div>
      </AnalyticsCard>

      <div className="grid gap-6 sm:grid-cols-2">
        <AnalyticsCard title="Módulos prontos">
          <div className="flex flex-wrap gap-2">
            {readyModules.map((m) => (
              <SmartBadge key={m.name} label={m.name} tone="success" />
            ))}
          </div>
        </AnalyticsCard>

        <AnalyticsCard title="Pendências">
          {pendingModules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma pendência de módulo no momento.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pendingModules.map((m) => (
                <SmartBadge key={m.name} label={m.name} tone="warning" />
              ))}
            </div>
          )}
        </AnalyticsCard>
      </div>

      <AnalyticsCard title="Bugs / riscos conhecidos" description="Registrados explicitamente — nenhum é uma surpresa.">
        {status.knownRisks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum risco em aberto registrado.</p>
        ) : (
          <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">
            {status.knownRisks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        )}
      </AnalyticsCard>

      <AnalyticsCard title="Linha do tempo" description="Todo o roadmap, em ordem, com o que já foi entregue.">
        <Timeline items={timelineItems} />
      </AnalyticsCard>

      <AnalyticsCard title="Backlog priorizado" description="Próximos marcos, na ordem em que serão atacados.">
        <div className="space-y-3">
          {backlog.map((phase, index) => (
            <div key={phase.id} className="flex items-start gap-3 border-b border-border/40 pb-3 last:border-0 last:pb-0">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-medium text-brand">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Fase {phase.id} — {phase.name}
                </p>
                <p className="text-xs text-muted-foreground">{phase.summary}</p>
              </div>
            </div>
          ))}
        </div>
      </AnalyticsCard>

      <p className="text-xs text-muted-foreground">
        Este projeto evolui em fases com aprovação entre elas — não há estimativas de prazo fixas; a próxima entrega é
        sempre a próxima linha do backlog acima, na ordem listada em{" "}
        <code className="rounded bg-muted px-1 py-0.5">ROADMAP.md</code>.
      </p>
    </main>
  );
}
