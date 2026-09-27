import { Gift, MousePointerClick, Repeat2 } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import type { ReturnSummary } from "@/services/return-offer.service";

/**
 * "Três números. Nenhum gráfico para interpretar." (plano do Starter). O
 * terceiro é o que paga a assinatura — prova que alguém voltou, nunca que
 * voltou por causa do brinde (o painel não promete causalidade).
 */
export function SummaryCards({ summary }: { summary: ReturnSummary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Toques no cartão" value={summary.taps.toLocaleString("pt-BR")} icon={MousePointerClick} hint={`Últimos ${summary.days} dias`} />
      <StatCard
        label="Brindes emitidos"
        value={summary.issued.toLocaleString("pt-BR")}
        icon={Gift}
        hint={summary.openNow > 0 ? `${summary.openNow} ainda dentro da validade` : "Nenhum em aberto agora"}
      />
      <StatCard
        label="Voltaram e resgataram"
        value={summary.redeemed.toLocaleString("pt-BR")}
        icon={Repeat2}
        accent="positive"
        hint="O número que paga a assinatura"
      />
    </div>
  );
}
