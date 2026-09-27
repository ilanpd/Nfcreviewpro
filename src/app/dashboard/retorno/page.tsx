import { AlertTriangle } from "lucide-react";
import { requireAuthContext } from "@/lib/auth";
import { roleHasPermission } from "@/domain/rbac/roles";
import { getOfferSettings, getReturnSummary, listVouchers } from "@/services/return-offer.service";
import { ownerAvailabilityMessage } from "@/domain/return-offer/owner-copy";
import { formatVoucherCode } from "@/domain/return-offer/code";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SummaryCards } from "./summary-cards";
import { OfferForm } from "./offer-form";
import { PinForm } from "./pin-form";
import { VoucherList, type VoucherRow } from "./voucher-list";

export const dynamic = "force-dynamic";

/**
 * Painel do Retorno (ADR-081): o brinde, o PIN, os três números e o
 * histórico. Todo mundo com acesso ao painel vê; só quem tem
 * \`return:manage\` (OWNER/ADMIN) configura, troca o PIN ou anula um brinde.
 */
export default async function RetornoPage() {
  const ctx = await requireAuthContext();
  const canManage = roleHasPermission(ctx.role, "return:manage");

  const [settings, summary, vouchers] = await Promise.all([
    getOfferSettings(ctx.companyId),
    getReturnSummary(ctx.companyId, 30),
    listVouchers(ctx.companyId, { take: 50 }),
  ]);

  const offerInitial = {
    title: settings.offer?.title ?? "",
    description: settings.offer?.description ?? null,
    windowDays: settings.offer?.windowDays ?? 14,
    cooldownDays: settings.offer?.cooldownDays ?? 30,
    dailyCap: settings.offer?.dailyCap ?? null,
    primaryUrl: settings.offer?.primaryUrl ?? null,
    active: settings.offer?.active ?? false,
  };

  const voucherRows: VoucherRow[] = vouchers.map((v) => ({
    id: v.id,
    code: v.code,
    title: v.title,
    status: v.status,
    issuedAt: v.issuedAt.toISOString(),
    redeemedAt: v.redeemedAt ? v.redeemedAt.toISOString() : null,
    voidedReason: v.voidedReason,
    cardName: v.card?.name ?? null,
    isExpiredNow: v.isExpiredNow,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Retorno</h1>
        <p className="text-sm text-muted-foreground">
          Um brinde para a próxima visita, do jeito que você escolher. {formatVoucherCode("K7X4QM")} é como o código aparece para o cliente.
        </p>
      </div>

      {!settings.availability.available ? (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Retorno indisponível no momento</AlertTitle>
          <AlertDescription>{ownerAvailabilityMessage(settings.availability.reason)}</AlertDescription>
        </Alert>
      ) : null}

      {!settings.access.canWrite ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Só leitura</AlertTitle>
          <AlertDescription>Sua assinatura não está ativa — você vê os dados, mas não pode alterar o brinde ou o PIN agora.</AlertDescription>
        </Alert>
      ) : null}

      <SummaryCards summary={summary} />

      <div className="grid gap-6 lg:grid-cols-2">
        <OfferForm
          initial={offerInitial}
          hasPin={settings.offer?.hasPin ?? false}
          offerExists={!!settings.offer}
          canManage={canManage}
          canActivate={settings.access.canWrite}
        />
        <div className="space-y-6">
          <PinForm hasPin={settings.offer?.hasPin ?? false} offerExists={!!settings.offer} canManage={canManage && settings.access.canWrite} />
          <p className="text-xs text-muted-foreground">
            O botão principal da tela é o destino escolhido acima; sem ele, o cartão usa o que você já configurou (destino do cartão ou avaliação no
            Google) — o mesmo para todo cliente, sempre.
          </p>
        </div>
      </div>

      <VoucherList initial={voucherRows} canManage={canManage} />
    </div>
  );
}
