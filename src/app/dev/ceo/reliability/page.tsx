import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getReliabilitySnapshot } from "@/services/reliability.service";
import { ReliabilityView } from "./reliability-view";
import { devToolsEnabled } from "@/lib/dev/gate";

/**
 * Painel de Saúde / Centro de Confiabilidade (Fase 8) — a contraparte
 * operacional do Command Center: em vez de campanhas/mesas/funil, mostra o
 * estado real do Event Bus/Queue Engine/Worker Engine/Cache Enterprise —
 * exatamente os módulos que esta fase construiu, lidos ao vivo, nunca uma
 * tela decorativa. Local dev/preview only, como todo `/dev/ceo/*`.
 */
export default async function ReliabilityPage() {
  if (!devToolsEnabled()) notFound();

  const snapshot = await getReliabilitySnapshot();

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6 sm:p-10">
      <div className="space-y-2">
        <Link href="/dev/ceo" className="flex items-center gap-1 text-xs text-muted-foreground hover:underline">
          <ArrowLeft className="size-3" /> Modo CEO
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Painel de Saúde</h1>
          <p className="text-sm text-muted-foreground">
            Event Bus, filas, workers, cache e Redis — dados reais dos módulos da Fase 8, atualizados a cada 5s.
          </p>
        </div>
      </div>

      <ReliabilityView initialSnapshot={snapshot} />
    </main>
  );
}
