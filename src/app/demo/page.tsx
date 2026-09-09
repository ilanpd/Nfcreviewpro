import { getDemoCompany, listWhiteLabelDemoBrands } from "@/lib/dev/demo-company";
import { listCardsForMap, listActiveCampaignsForMap, listAssignmentsForStatus } from "@/services/table-map.service";
import { listZones } from "@/services/zone.service";
import { listBranches } from "@/services/branch.service";
import { getExecutiveKpis, getRoiSummary } from "@/services/analytics-engine.service";
import { listTopActionableRecommendations } from "@/services/recommendation-engine.service";
import { listScenarios } from "@/services/scenario-engine.service";
import { DemoOSView } from "@/components/demo/demo-os-view";

// Achado real durante o build desta fase: sem isto, o Next.js tenta
// pré-renderizar `/demo` estaticamente (é um Server Component `async` sem
// nenhum sinal de dinamismo explícito) — o que congelaria os dados da Bella
// Vista no momento do build, o oposto de "eventos chegam ao vivo". Forçado
// a renderizar por requisição, sempre.
export const dynamic = "force-dynamic";

/**
 * Demo OS (Fase 12) — `/demo`. Deliberadamente PÚBLICA, sem cadastro, e
 * ALCANÇÁVEL EM PRODUÇÃO (ao contrário de `/dev/ceo/*`, que é uma
 * ferramenta de engenharia bloqueada por `NODE_ENV`): "qualquer pessoa
 * consegue abrir o NFC OS... em menos de 30 segundos" é um requisito
 * explícito, não uma sugestão. Roda sobre a mesma empresa "Bella Vista" do
 * seed, reaproveitando os MESMOS serviços do dashboard real e do Command
 * Center (Fase 6) — Zero Fake Demo: nenhuma linha de dado é inventada só
 * para esta tela.
 */
export default async function DemoOSPage() {
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
    />
  );
}
