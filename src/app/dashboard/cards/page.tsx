import { requireAuthContext } from "@/lib/auth";
import { listCards } from "@/services/card.service";
import { getCompanyById } from "@/services/company.service";
import { listBranches } from "@/services/branch.service";
import { listZones } from "@/services/zone.service";
import { cardLimitForPlan } from "@/lib/plans";
import { CardsView } from "@/components/dashboard/cards-view";

export default async function CardsPage() {
  const ctx = await requireAuthContext();
  const [cards, company, branches, zones] = await Promise.all([
    listCards(ctx.companyId),
    getCompanyById(ctx.companyId),
    listBranches(ctx.companyId),
    listZones(ctx.companyId),
  ]);

  return (
    <CardsView
      initialCards={cards}
      cardLimit={cardLimitForPlan(company.plan)}
      initialBranches={branches}
      initialZones={zones}
    />
  );
}
