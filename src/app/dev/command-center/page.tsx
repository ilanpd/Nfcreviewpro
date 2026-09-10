import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDemoCompany } from "@/lib/dev/demo-company";
import { getCommandCenterSnapshot } from "@/services/command-center.service";
import { listCardsForMap } from "@/services/table-map.service";
import { DevCommandCenterView } from "./dev-command-center-view";
import { devToolsEnabled } from "@/lib/dev/gate";

/**
 * Dev Command Center v2 (Fase 12) — `/dev/command-center`, inspirado em
 * Vercel/Stripe/Linear. Ferramenta de engenharia, sempre bloqueada em
 * produção (mesmo gate de toda `/dev/*` desde a Fase 2) — diferente do
 * Demo OS público (`/demo`). Consolida o que já existia espalhado (Mission
 * Control, Painel de Saúde) com o que ainda não tinha um lugar (webhooks,
 * playbooks/AutoPilot, cenário atual, Network/State Inspector, Visual
 * Event Flow) — nunca recalcula, só compõe (ver `command-center.service.ts`).
 */
export default async function DevCommandCenterPage() {
  if (!devToolsEnabled()) notFound();

  const company = await getDemoCompany();
  if (!company) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-10">
        <Link href="/dev/ceo" className="flex items-center gap-1 text-xs text-muted-foreground hover:underline">
          <ArrowLeft className="size-3" /> Modo CEO
        </Link>
        <p className="text-sm text-muted-foreground">
          A empresa de demonstração ainda não existe neste banco. Rode <code className="rounded bg-muted px-1 py-0.5">npm run db:seed</code> e recarregue esta página.
        </p>
      </main>
    );
  }

  const [snapshot, cards] = await Promise.all([getCommandCenterSnapshot(company.id), listCardsForMap(company.id)]);

  return <DevCommandCenterView initialSnapshot={snapshot} cards={cards.map((c) => ({ id: c.id, name: c.name }))} />;
}
