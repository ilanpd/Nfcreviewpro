"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KpiCard, AnalyticsCard, SmartBadge } from "@nfc-os/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Radio, Zap, Gauge, AlertOctagon, Rocket } from "lucide-react";
import type { ReliabilitySnapshot } from "@/services/reliability.service";
import type { ChaosFlag } from "@/lib/chaos/flags";
import type { QueueName } from "@/lib/queues/definitions";

const POLL_MS = 5000;

const CHAOS_LABELS: Record<ChaosFlag, { label: string; description: string }> = {
  redisDown: { label: "Redis fora do ar", description: "Simula cache/rate-limit indisponível — o Resolution Engine deve continuar respondendo direto do Postgres." },
  queueStalled: { label: "Fila travada", description: "O dreno de workers para de processar — jobs se acumulam nas filas visivelmente." },
  workerSlow: { label: "Worker lento", description: "Cada job leva +4s para processar — simula um consumidor externo degradado." },
  timeout: { label: "Timeout externo", description: "Chamadas de webhook demoram 60s antes de expirar — testa o Circuit Breaker." },
  webhookFailure: { label: "Falha de webhook", description: "Toda entrega de webhook falha — testa retry/backoff/dead-letter de ponta a ponta." },
};

const QUEUE_LABELS: Record<QueueName, string> = {
  analytics: "Analytics",
  webhooks: "Webhooks",
  whatsapp: "WhatsApp",
  emails: "E-mails",
  exports: "Exportações",
  heavy: "Processamento pesado",
  playbooks: "Playbooks",
};

// Achado sob Zero Dívida Silenciosa (Fase 12): esta lista ficou desatualizada
// desde a Fase 11, que adicionou 3 eventos novos ao Event Bus — corrigido
// aqui em vez de deixar o seletor de Event Replay incapaz de filtrar por eles.
const EVENT_TYPES = [
  "NFCTocado",
  "RedirecionamentoResolvido",
  "CampanhaCriada",
  "CampanhaAtualizada",
  "CampanhaEncerrada",
  "FeedbackRecebido",
  "AvaliacaoPublicada",
  "ZonaAtualizada",
  "MesaAtualizada",
  "OrganizacaoAtualizada",
  "RecomendacaoGerada",
  "PlaybookExecutado",
  "PlaybookDesfeito",
];

interface ReplayEventRow {
  id: string;
  type: string;
  correlationId: string;
  companyId: string | null;
  createdAt: string;
}

export function ReliabilityView({ initialSnapshot }: { initialSnapshot: ReliabilitySnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [chaosSaving, setChaosSaving] = useState<ChaosFlag | null>(null);
  const [replayType, setReplayType] = useState<string>("");
  const [replayCorrelationId, setReplayCorrelationId] = useState("");
  const [replayResults, setReplayResults] = useState<ReplayEventRow[] | null>(null);
  const [replayBusy, setReplayBusy] = useState(false);
  const [simulatorBusy, setSimulatorBusy] = useState(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/dev/reliability");
        if (!res.ok) return;
        const { snapshot: next } = await res.json();
        setSnapshot(next);
      } catch {
        // best-effort — o próximo tick tenta de novo
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  async function toggleChaos(flag: ChaosFlag, active: boolean) {
    setChaosSaving(flag);
    try {
      const res = await fetch("/api/dev/chaos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag, active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao aplicar Chaos Mode");
      setSnapshot((prev) => ({ ...prev, chaos: data.flags }));
      toast.success(active ? `${CHAOS_LABELS[flag].label} ativado` : `${CHAOS_LABELS[flag].label} desativado`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao aplicar Chaos Mode");
    } finally {
      setChaosSaving(null);
    }
  }

  async function runReconstruct() {
    setReplayBusy(true);
    try {
      const params = new URLSearchParams();
      if (replayType) params.set("type", replayType);
      if (replayCorrelationId) params.set("correlationId", replayCorrelationId);
      const res = await fetch(`/api/dev/replay?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao reconstruir sequência");
      setReplayResults(data.events);
      toast.success(`${data.events.length} evento(s) encontrado(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao reconstruir sequência");
    } finally {
      setReplayBusy(false);
    }
  }

  async function runReplayToQueues() {
    setReplayBusy(true);
    try {
      const res = await fetch("/api/dev/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: replayType || undefined, correlationId: replayCorrelationId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao reenfileirar");
      toast.success(`${data.result.replayed}/${data.result.matched} evento(s) reenfileirado(s) (${data.result.failed} falha(s))`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao reenfileirar");
    } finally {
      setReplayBusy(false);
    }
  }

  async function runLoadSimulator() {
    setSimulatorBusy(true);
    try {
      const res = await fetch("/api/dev/load-simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 100 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao simular carga");
      toast.success(`${data.published} eventos publicados contra a Bella Vista`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao simular carga");
    } finally {
      setSimulatorBusy(false);
    }
  }

  const resolutionCache = snapshot.cache.find((c) => c.namespace === "resolution");
  const analyticsCache = snapshot.cache.find((c) => c.namespace === "analytics");
  const anyChaosActive = Object.values(snapshot.chaos).some(Boolean);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Saúde geral"
          value={snapshot.overallHealthy ? "Saudável" : "Atenção"}
          icon={<Gauge />}
          hint={anyChaosActive ? "Chaos Mode ativo — degradação simulada" : undefined}
        />
        <KpiCard label="Eventos/min" value={snapshot.events.lastMinute} icon={<Zap />} hint={`${snapshot.events.last5Minutes} nos últimos 5min`} />
        <KpiCard
          label="Conexões SSE ativas"
          value={snapshot.sseConnections ?? "—"}
          icon={<Radio />}
          hint={snapshot.sseConnections === null ? "Redis REST não configurado" : undefined}
        />
        <KpiCard
          label="Cache (resolução)"
          value={resolutionCache?.hitRate !== null && resolutionCache?.hitRate !== undefined ? `${Math.round(resolutionCache.hitRate * 100)}%` : "—"}
          icon={<Database />}
          hint={resolutionCache ? `${resolutionCache.hits} hits / ${resolutionCache.misses} misses` : undefined}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Spans registrados nos últimos ~2min: <strong className="text-foreground">{snapshot.recentSpanCount ?? "—"}</strong>{" "}
        — contagem de spans já finalizados (ver <code className="rounded bg-muted px-1 py-0.5">ConsoleSpanExporter</code>
        em ADR-034), não requisições em andamento: sem um coletor OTel real, não existe &ldquo;traces ativos&rdquo; honesto de mostrar.
      </p>

      <AnalyticsCard
        title="Redis"
        description="Dois clientes independentes: REST (cache/rate-limit/idempotência) e TCP via ioredis (BullMQ)."
        action={<SmartBadge label={snapshot.overallHealthy ? "OK" : "Verificar"} tone={snapshot.overallHealthy ? "success" : "danger"} />}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-sm font-semibold text-foreground">Redis REST (Upstash)</p>
            <p className="mt-1 text-xs text-muted-foreground">Cache, rate limit, idempotência, métricas.</p>
            <div className="mt-2">
              {!snapshot.redis.restConfigured ? (
                <SmartBadge label="Não configurado" tone="neutral" />
              ) : (
                <SmartBadge label={snapshot.redis.restHealthy ? "Respondendo" : "Sem resposta"} tone={snapshot.redis.restHealthy ? "success" : "danger"} pulse={!!snapshot.redis.restHealthy} />
              )}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-sm font-semibold text-foreground">Redis TCP (ioredis / BullMQ)</p>
            <p className="mt-1 text-xs text-muted-foreground">Queue Engine — REDIS_URL.</p>
            <div className="mt-2">
              {!snapshot.redis.queueConfigured ? (
                <SmartBadge label="Não configurado" tone="neutral" />
              ) : (
                <SmartBadge label={snapshot.redis.queueHealthy ? "Respondendo" : "Sem resposta"} tone={snapshot.redis.queueHealthy ? "success" : "danger"} pulse={!!snapshot.redis.queueHealthy} />
              )}
            </div>
          </div>
        </div>
      </AnalyticsCard>

      <AnalyticsCard
        title="Filas e Workers"
        description="Contagem real por fila (BullMQ) e o último heartbeat de cada worker."
        action={
          <Button variant="outline" size="sm" disabled={simulatorBusy} onClick={runLoadSimulator}>
            <Rocket className="size-3.5" /> Simular carga (Bella Vista)
          </Button>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fila</TableHead>
              <TableHead>Aguardando</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead>Concluído</TableHead>
              <TableHead>Falhou</TableHead>
              <TableHead>Dead-letter</TableHead>
              <TableHead>Worker</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshot.queues.map((q) => (
              <TableRow key={q.name}>
                <TableCell className="font-medium">{QUEUE_LABELS[q.name]}</TableCell>
                <TableCell>{q.counts?.waiting ?? "—"}</TableCell>
                <TableCell>{q.counts?.active ?? "—"}</TableCell>
                <TableCell>{q.counts?.completed ?? "—"}</TableCell>
                <TableCell>{q.counts?.failed ?? "—"}</TableCell>
                <TableCell>
                  {q.deadLetterCount !== null && q.deadLetterCount > 0 ? (
                    <SmartBadge label={String(q.deadLetterCount)} tone="danger" />
                  ) : (
                    (q.deadLetterCount ?? "—")
                  )}
                </TableCell>
                <TableCell>
                  {!q.available ? (
                    <SmartBadge label="Fila indisponível" tone="neutral" />
                  ) : (
                    <SmartBadge label={q.worker.healthy ? "Ativo" : "Parado"} tone={q.worker.healthy ? "success" : "warning"} pulse={q.worker.healthy} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!snapshot.redis.queueConfigured && (
          <p className="mt-3 text-xs text-muted-foreground">
            Queue Engine sem <code className="rounded bg-muted px-1 py-0.5">REDIS_URL</code> configurado — eventos continuam
            gravados de forma durável em <code className="rounded bg-muted px-1 py-0.5">EventLog</code>, só não são
            roteados para filas.
          </p>
        )}
      </AnalyticsCard>

      <AnalyticsCard title="Cache Enterprise" description="Hit/miss real por namespace de cache, desde o último reinício do contador.">
        <div className="grid gap-3 sm:grid-cols-2">
          {[resolutionCache, analyticsCache].filter(Boolean).map((c) => (
            <div key={c!.namespace} className="rounded-lg border border-border/60 p-3">
              <p className="text-sm font-semibold capitalize text-foreground">{c!.namespace}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {c!.hits} hits · {c!.misses} misses{c!.hitRate !== null ? ` · ${Math.round(c!.hitRate * 100)}% de acerto` : ""}
              </p>
            </div>
          ))}
        </div>
      </AnalyticsCard>

      <AnalyticsCard
        title="Chaos Mode"
        description="Só em desenvolvimento — bloqueado de forma redundante em produção. Injeta falha real nos módulos da Fase 8 para provar degradação graciosa."
        action={anyChaosActive ? <SmartBadge label="Ativo" tone="danger" pulse icon={<AlertOctagon className="size-3" />} /> : undefined}
      >
        <div className="space-y-3">
          {(Object.keys(CHAOS_LABELS) as ChaosFlag[]).map((flag) => (
            <div key={flag} className="flex items-center justify-between gap-4 border-b border-border/40 pb-3 last:border-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-foreground">{CHAOS_LABELS[flag].label}</p>
                <p className="text-xs text-muted-foreground">{CHAOS_LABELS[flag].description}</p>
              </div>
              <Switch
                checked={Boolean(snapshot.chaos[flag])}
                disabled={chaosSaving === flag}
                onCheckedChange={(checked) => toggleChaos(flag, checked)}
              />
            </div>
          ))}
        </div>
      </AnalyticsCard>

      <AnalyticsCard
        title="Event Replay"
        description="Reconstrua a sequência exata de eventos gravados (somente leitura) ou reenfileire-os para seus consumidores (efeito colateral real — usa o mesmo id do evento original para deduplicar)."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Tipo de evento</Label>
            <Select value={replayType || "all"} onValueChange={(v) => setReplayType(v === "all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Correlation ID (opcional)</Label>
            <Input value={replayCorrelationId} onChange={(e) => setReplayCorrelationId(e.target.value)} placeholder="ex.: reproduzir uma sequência de toques" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={replayBusy} onClick={runReconstruct}>
            Reconstruir sequência
          </Button>
          <Button variant="destructive" size="sm" disabled={replayBusy} onClick={runReplayToQueues}>
            Reenfileirar para consumidores
          </Button>
        </div>

        {replayResults !== null && (
          <div className="mt-4">
            {replayResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento encontrado para este filtro.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Correlation ID</TableHead>
                    <TableHead>Empresa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {replayResults.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="font-medium">{e.type}</TableCell>
                      <TableCell className="text-xs">{e.correlationId}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.companyId ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </AnalyticsCard>
    </div>
  );
}
