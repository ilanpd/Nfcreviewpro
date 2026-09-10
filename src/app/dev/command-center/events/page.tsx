import { notFound } from "next/navigation";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { listRecentEventLogs } from "@/services/replay.service";
import { EventExplorerView } from "./event-explorer-view";
import { devToolsEnabled } from "@/lib/dev/gate";

/**
 * Event Explorer (Fase 12) — inspirado em Temporal/Stripe Events/Supabase
 * Logs: cada evento abre e mostra payload/origem/destino/correlação/
 * replay/duração, tudo derivado do `EventLog` real (Fase 8), nunca inventado.
 */
export default async function EventExplorerPage() {
  if (!devToolsEnabled()) notFound();

  const company = await getDemoCompany();
  if (!company) {
    return <main className="p-10 text-sm text-muted-foreground">Rode o seed primeiro.</main>;
  }

  const events = await listRecentEventLogs({ companyId: company.id, limit: 50 });
  return <EventExplorerView initialEvents={events} />;
}
