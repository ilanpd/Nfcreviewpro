import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { listCardsForMap, listActiveCampaignsForMap, listAssignmentsForStatus } from "@/services/table-map.service";
import { listZones } from "@/services/zone.service";
import { listBranches } from "@/services/branch.service";
import { getReliabilitySnapshot } from "@/services/reliability.service";
import { MissionControlView } from "./mission-control-view";
import { devToolsEnabled } from "@/lib/dev/gate";

/**
 * Mission Control (Fase 8) — um único ecrã estilo NOC (Network Operations
 * Center) combinando o Mapa de Mesas ao vivo (o mesmo `TableMapView` real do
 * Command Center) com o estado real do Event Bus/Queue Engine/Cache/Redis
 * (o mesmo `reliability.service` do Painel de Saúde). Nada aqui é uma tela
 * decorativa: cada número vem de um dos dois serviços reais construídos
 * nesta fase — pensado para demonstração a investidor/franquia, mas nunca à
 * custa de inventar um dado. Local dev/preview only.
 */
export default async function MissionControlPage() {
  if (!devToolsEnabled()) notFound();

  const company = await getDemoCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-10">
        <Link href="/dev/ceo" className="flex items-center gap-1 text-xs text-muted-foreground hover:underline">
          <ArrowLeft className="size-3" /> Modo CEO
        </Link>
        <p className="text-sm text-muted-foreground">
          A empresa de demonstração &ldquo;bella-vista&rdquo; ainda não existe neste banco. Rode{" "}
          <code className="rounded bg-muted px-1 py-0.5">npm run db:seed</code> e recarregue esta página.
        </p>
      </main>
    );
  }

  const [cards, zones, branches, trayCampaigns, assignments, reliability] = await Promise.all([
    listCardsForMap(company.id),
    listZones(company.id),
    listBranches(company.id),
    listActiveCampaignsForMap(company.id),
    listAssignmentsForStatus(company.id, company.organizationId),
    getReliabilitySnapshot(),
  ]);

  return (
    <MissionControlView
      cards={cards}
      zones={zones}
      branches={branches}
      trayCampaigns={trayCampaigns}
      initialAssignments={assignments}
      organizationId={company.organizationId}
      initialReliability={reliability}
    />
  );
}
