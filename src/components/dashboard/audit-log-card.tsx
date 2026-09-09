import { History } from "lucide-react";
import { AnalyticsCard, ActivityFeed } from "@nfc-os/ui";
import { AUDIT_ACTION_LABEL } from "@/domain/audit/labels";
import type { listAuditLogs } from "@/services/audit.service";

type AuditLogItem = Awaited<ReturnType<typeof listAuditLogs>>[number];

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function AuditLogCard({ logs }: { logs: AuditLogItem[] }) {
  return (
    <AnalyticsCard
      title="Auditoria"
      description={`Quem fez, quando fez, e o que mudou — as últimas ${logs.length} ações.`}
      className="max-w-2xl"
    >
      <ActivityFeed
        emptyLabel="Nenhuma ação registrada ainda."
        entries={logs.map((log) => ({
          id: log.id,
          actor: log.user?.name || log.user?.email || "Alguém",
          action: AUDIT_ACTION_LABEL[log.action],
          timestamp: formatWhen(log.createdAt),
          icon: <History className="size-3.5" />,
        }))}
      />
    </AnalyticsCard>
  );
}
