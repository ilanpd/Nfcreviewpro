import { getDemoCompany, listWhiteLabelDemoBrands } from "@/lib/dev/demo-company";
import { listCardsForMap, listActiveCampaignsForMap, listAssignmentsForStatus } from "@/services/table-map.service";
import { listZones } from "@/services/zone.service";
import { listBranches } from "@/services/branch.service";
import { getExecutiveKpis, getRoiSummary } from "@/services/analytics-engine.service";
import { listTopActionableRecommendations } from "@/services/recommendation-engine.service";
import { listScenarios } from "@/services/scenario-engine.service";
import { DemoOSView } from "@/components/demo/demo-os-view";

// Ver o mesmo comentário em `../page.tsx` — sem isto o Next.js tentaria
// pré-renderizar esta página estaticamente no build.
export const dynamic = "force-dynamic";

/**
 * Investor Mode (Fase 12) — `/demo/investor`. A MESMA experiência do Demo
 * OS, com `autoPlay` avançando sozinho pelos mesmos 9 momentos reais, sem
 * exigir clique — pensado para caber em ~2 minutos (9 momentos × ~12s cada
 * ≈ 108s, mais o tempo de leitura da narração). Nenhuma tela nova, nenhum
 * dado paralelo: é o `DemoOSView` com os controles manuais escondidos.
 */
export default async function InvestorModePage() {
  const company = await getDemoCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-lg space-y-3 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          A empresa de demonstração ainda não existe neste banco. Rode <code className="rounded bg-muted px-1 py-0.5">npm run db:seed</code> e recarregue esta página.
        </p>
      </main>
    );
  }

  const [cards, zones, branches, trayCampaigns, assignments, kpis, roi, recommendations, brands, scenarios] = await Promise.all([
    listCardsForMap(company.id),
    listZones(company.id),
    listBranches(company.id),
    listActiveCampaignsForMap(company.id),
    listAssignmentsForStatus(company.id, company.organizationId),
    getExecutiveKpis(company.id, 30),
    getRoiSummary(company.id, 30),
    listTopActionableRecommendations(company.id, 5),
    listWhiteLabelDemoBrands(),
    Promise.resolve(listScenarios()),
  ]);

  return (
    <DemoOSView
      cards={cards}
      zones={zones}
      branches={branches}
      trayCampaigns={trayCampaigns}
      initialAssignments={assignments}
      organizationId={company.organizationId}
      initialKpis={kpis}
      initialRoi={roi}
      initialRecommendations={recommendations}
      brands={brands}
      scenarios={scenarios}
      autoPlay
    />
  );
}
