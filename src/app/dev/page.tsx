import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, FileText, GitBranch, History, ShieldCheck } from "lucide-react";
import { KpiCard, AnalyticsCard, SmartBadge, Timeline, ActivityFeed, EmptyState } from "@nfc-os/ui";
import { readDevStatus, countArchitectureDecisions } from "@/lib/dev-status";
import { devToolsEnabled } from "@/lib/dev/gate";

// Local dev/preview only — este dashboard expõe status interno de build, não é uma rota voltada ao cliente.
export default function DevStatusPage() {
  if (!devToolsEnabled()) notFound();

  const status = readDevStatus();
  const adrCount = countArchitectureDecisions();
  const doneCount = status.phases.filter((p) => p.status === "done").length;
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

  const activityEntries = status.changelog
    .slice()
    .reverse()
    .map((entry, i) => ({
      id: String(i),
      actor: entry.phase !== null ? `Fase ${entry.phase}` : "Projeto",
      action: entry.text,
      timestamp: entry.date,
      icon: <History className="size-3.5" />,
    }));

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6 sm:p-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Developer Command Center</p>
          <h1 className="text-2xl font-semibold tracking-tight">NFC Review Pro — Status de build</h1>
          <p className="text-sm text-muted-foreground">
            Gerado em {status.generatedAt} · {doneCount}/{status.phases.length} fases concluídas
          </p>
        </div>
        <Link href="/dev/ceo" className="flex shrink-0 items-center gap-1 text-sm text-brand hover:underline">
          Modo CEO <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Progresso geral" value={`${status.overallPercent}%`} icon={<GitBranch />} />
        <KpiCard label="Fases concluídas" value={doneCount} icon={<CheckCircle2 />} />
        <KpiCard label="Decisões de arquitetura" value={adrCount} icon={<FileText />} hint="ADRs registradas" />
        <KpiCard
          label="Quality gates"
          value={allGatesPassing ? "OK" : "Atenção"}
          icon={<ShieldCheck />}
          valueClassName={allGatesPassing ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}
        />
      </div>

      <AnalyticsCard title="Quality gates">
        <div className="flex flex-wrap gap-2">
          {status.qualityGates.map((gate) => (
            <SmartBadge key={gate.name} label={gate.name} tone={gate.passing ? "success" : "danger"} />
          ))}
        </div>
      </AnalyticsCard>

      <AnalyticsCard title="Próxima tarefa">
        <p className="text-sm text-foreground">{status.nextTask}</p>
      </AnalyticsCard>

      <div className="grid gap-6 sm:grid-cols-2">
        <AnalyticsCard title="Módulos">
          <div className="flex flex-wrap gap-2">
            {status.modules.map((m) => (
              <SmartBadge
                key={m.name}
                label={m.name}
                tone={m.status === "done" ? "success" : m.status === "in_progress" ? "warning" : "neutral"}
              />
            ))}
          </div>
        </AnalyticsCard>

        <AnalyticsCard title="Riscos conhecidos">
          {status.knownRisks.length === 0 ? (
            <EmptyState icon={<ShieldCheck />} title="Nenhum risco em aberto." />
          ) : (
            <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">
              {status.knownRisks.map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ul>
          )}
        </AnalyticsCard>
      </div>

      <AnalyticsCard title="Fases">
        <Timeline items={timelineItems} />
      </AnalyticsCard>

      <AnalyticsCard title="Changelog">
        <ActivityFeed entries={activityEntries} />
      </AnalyticsCard>
    </main>
  );
}
