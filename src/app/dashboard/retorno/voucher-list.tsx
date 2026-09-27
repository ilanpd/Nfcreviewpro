"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Ban, Gift as GiftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnalyticsCard, EmptyState, SmartBadge } from "@nfc-os/ui";
import { formatVoucherCode } from "@/domain/return-offer/code";

export interface VoucherRow {
  id: string;
  code: string;
  title: string;
  status: "ISSUED" | "REDEEMED" | "EXPIRED" | "VOIDED";
  issuedAt: string;
  redeemedAt: string | null;
  voidedReason: string | null;
  cardName: string | null;
  isExpiredNow: boolean;
}

const STATUS_TONE = { ISSUED: "neutral", REDEEMED: "success", EXPIRED: "neutral", VOIDED: "danger" } as const;
const STATUS_LABEL: Record<VoucherRow["status"], string> = { ISSUED: "Emitido", REDEEMED: "Resgatado", EXPIRED: "Vencido", VOIDED: "Anulado" };

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

/** Histórico de brindes (ADR-081): resgatados, emitidos ainda em aberto, vencidos e anulados. */
export function VoucherList({ initial, canManage }: { initial: VoucherRow[]; canManage: boolean }) {
  const [vouchers, setVouchers] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleVoid(voucher: VoucherRow) {
    const reason = window.prompt(`Anular o brinde ${formatVoucherCode(voucher.code)}? Descreva o motivo:`);
    if (!reason || reason.trim().length < 3) {
      if (reason !== null) toast.error("Explique o motivo em poucas palavras.");
      return;
    }
    setBusyId(voucher.id);
    try {
      const res = await fetch(`/api/return/vouchers/${voucher.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível anular");
      }
      setVouchers((prev) => prev.map((v) => (v.id === voucher.id ? { ...v, status: "VOIDED", voidedReason: reason.trim() } : v)));
      toast.success("Brinde anulado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AnalyticsCard title="Brindes recentes" description="Os últimos 50, mais novos primeiro.">
      {vouchers.length === 0 ? (
        <EmptyState
          icon={<GiftIcon />}
          title="Nenhum brinde ainda"
          description="Assim que alguém tocar o cartão com o Retorno ativo, o primeiro brinde aparece aqui."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Cartão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Emitido</TableHead>
                <TableHead>Resgatado</TableHead>
                {canManage ? <TableHead className="text-right">Ações</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {vouchers.map((v) => {
                const effectiveStatus = v.status === "ISSUED" && v.isExpiredNow ? "EXPIRED" : v.status;
                const canVoid = canManage && (v.status === "ISSUED" || v.status === "REDEEMED");
                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">{formatVoucherCode(v.code)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.cardName ?? "—"}</TableCell>
                    <TableCell>
                      <SmartBadge label={STATUS_LABEL[effectiveStatus]} tone={STATUS_TONE[effectiveStatus]} />
                      {v.status === "VOIDED" && v.voidedReason ? (
                        <span className="ml-2 text-xs text-muted-foreground">{v.voidedReason}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(v.issuedAt)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {v.redeemedAt ? formatDateTime(v.redeemedAt) : "—"}
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        {canVoid ? (
                          <Button size="sm" variant="ghost" className="text-destructive" disabled={busyId === v.id} onClick={() => handleVoid(v)}>
                            <Ban className="size-3.5" /> Anular
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </AnalyticsCard>
  );
}
