import Link from "next/link";
import { CheckCircle2, Circle, Gift, MousePointerClick, Repeat2, Wallet } from "lucide-react";
import { AnalyticsCard, EmptyState } from "@nfc-os/ui";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { buildActivationChecklist, isActivationComplete } from "@/domain/return-offer/activation-checklist";
import { estimateReturnRevenue } from "@/domain/return-offer/revenue-estimate";
import { formatCentsToBRL } from "@/lib/store-products";
import type { ReturnSummary } from "@/services/return-offer.service";

/**
 * O bloco do Retorno na Visão geral (F5 do plano): os 3 números, a conta
 * simples de receita (só quando o dono já configurou o ticket médio — nunca
 * um valor inventado) e um checklist enquanto a ativação não termina. Some
 * sozinho assim que os 5 passos estiverem feitos — ninguém precisa de um
 * checklist permanente lembrando o que já fez.
 */
export function ReturnOverviewCard({
  summary,
  offerExists,
  hasPin,
  active,
  avgTicketReais,
}: {
  summary: ReturnSummary;
  offerExists: boolean;
  hasPin: boolean;
  active: boolean;
  avgTicketReais: number | null;
}) {
  const steps = buildActivationChecklist({ offerExists, hasPin, active, issued: summary.issued, redeemed: summary.redeemed });
  const complete = isActivationComplete(steps);
  const revenue = estimateReturnRevenue(summary.redeemed, avgTicketReais);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Toques no cartão" value={summary.taps.toLocaleString("pt-BR")} icon={MousePointerClick} hint={`Últimos ${summary.days} dias`} />
        <StatCard label="Brindes emitidos" value={summary.issued.toLocaleString("pt-BR")} icon={Gift} hint={`${summary.openNow} em aberto agora`} />
        <StatCard label="Voltaram e resgataram" value={summary.redeemed.toLocaleString("pt-BR")} icon={Repeat2} accent="positive" />
        <StatCard
          label="Receita estimada"
          value={revenue.configured ? formatCentsToBRL(revenue.estimatedCents!) : "—"}
          icon={Wallet}
          hint={revenue.configured ? "Ticket médio × quem voltou — não é lucro" : "Configure o ticket médio em Configurações"}
        />
      </div>

      {!complete ? (
        <AnalyticsCard title="Ativar o Retorno" description="Cinco passos, cada um marcado sozinho pelo que já aconteceu.">
          <ul className="space-y-2">
            {steps.map((step) => (
              <li key={step.id} className="flex items-center gap-2 text-sm">
                {step.done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className={step.done ? "text-muted-foreground line-through" : ""}>{step.label}</span>
              </li>
            ))}
          </ul>
          {!offerExists || !hasPin || !active ? (
            <Button asChild size="sm" className="mt-4">
              <Link href="/dashboard/retorno">Continuar configuração</Link>
            </Button>
          ) : null}
        </AnalyticsCard>
      ) : null}

      <AnalyticsCard title="Últimos resgates">
        {summary.recentRedemptions.length === 0 ? (
          <EmptyState
            icon={<Gift />}
            title="Ninguém resgatou ainda"
            description="Assim que o primeiro cliente voltar e resgatar, ele aparece aqui."
          />
        ) : (
          <ul className="divide-y divide-border">
            {summary.recentRedemptions.map((r, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span>{r.title}</span>
                <span className="text-muted-foreground">
                  {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(r.redeemedAt))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AnalyticsCard>
    </div>
  );
}
