"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Activity, ScrollText, Timer } from "lucide-react";
import { KpiCard, AnalyticsCard, EmptyState, SmartBadge } from "@nfc-os/ui";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface ApiRequestLogRow {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
  createdAt: string | Date;
}

export interface ApiUsageSummary {
  requestsLast24h: number;
  avgLatencyMs: number | null;
}

function statusTone(status: number): "success" | "warning" | "danger" {
  if (status < 400) return "success";
  if (status < 500) return "warning";
  return "danger";
}

export function LogsPanel({ initialLogs, initialSummary }: { initialLogs: ApiRequestLogRow[]; initialSummary: ApiUsageSummary }) {
  const [logs, setLogs] = useState(initialLogs);
  const [summary] = useState(initialSummary);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadMore() {
    const last = logs[logs.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/api-logs?cursor=${last.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao carregar mais logs");
      setLogs((prev) => [...prev, ...data.logs]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao carregar mais logs");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard label="Requisições (últimas 24h)" value={summary.requestsLast24h} icon={<Activity />} />
        <KpiCard label="Latência média (24h)" value={summary.avgLatencyMs !== null ? `${summary.avgLatencyMs}ms` : "—"} icon={<Timer />} />
      </div>

      <AnalyticsCard title="Chamadas recentes" description="Toda requisição feita à API pública v1 com uma chave desta empresa.">
        {logs.length === 0 ? (
          <EmptyState
            icon={<ScrollText />}
            title="Nenhuma chamada registrada ainda"
            description="Faça sua primeira requisição em Documentação rápida."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Método</TableHead>
                  <TableHead>Rota</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Latência</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.method}</TableCell>
                    <TableCell className="font-mono text-xs">{log.path}</TableCell>
                    <TableCell>
                      <SmartBadge label={String(log.statusCode)} tone={statusTone(log.statusCode)} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.latencyMs}ms</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3 flex justify-center">
              <Button size="sm" variant="outline" disabled={loadingMore} onClick={loadMore}>
                {loadingMore ? <Spinner className="size-3.5" /> : null}
                Carregar mais
              </Button>
            </div>
          </>
        )}
      </AnalyticsCard>
    </div>
  );
}
