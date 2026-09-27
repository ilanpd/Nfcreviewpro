import type { PrismaClient } from "@/generated/prisma/client";
import { computeVoucherWindow, decideOnTouch, type VoucherLike } from "@/domain/return-offer/lifecycle";
import { localDay, startOfLocalDay } from "@/domain/return-offer/time";
import { countIssuedSince, createVoucherWithUniqueCode, expireVisitorVouchers, findVisitorVouchers } from "./store";

/**
 * O núcleo transacional do toque (ADR-079): decide e, se for o caso, emite o
 * brinde, tudo sob um lock de transação por aparelho. Fora de `server-only`
 * de propósito, como `store.ts`, para o teste de concorrência contra um banco
 * real exercitar exatamente este código.
 *
 * Dois toques simultâneos do mesmo aparelho (duplo clique, duas abas) disputam
 * o mesmo lock: o segundo espera o primeiro terminar, enxerga o brinde já
 * emitido e só o mostra. Sem o lock, os dois leriam "nenhum brinde ativo" e
 * emitiriam dois.
 */

export interface TouchTxInput {
  company: { id: string; timezone: string };
  offer: { id: string; title: string; windowDays: number; cooldownDays: number; dailyCap: number | null };
  cardId: string | null;
  visitId: string | null;
  visitorId: string;
  now: Date;
}

type StoredVoucher = VoucherLike & { code: string; title: string };

export type TouchTxOutcome =
  | { kind: "ISSUED"; voucher: StoredVoucher }
  | { kind: "EXISTING"; voucher: StoredVoucher }
  | { kind: "COOLDOWN"; nextEligibleAt: Date; lastStatus: "ISSUED" | "REDEEMED" | "EXPIRED" | "VOIDED" }
  | { kind: "CAP_REACHED" };

export function issueOrShowVoucher(db: PrismaClient, input: TouchTxInput): Promise<TouchTxOutcome> {
  const { company, offer, now } = input;
  const tz = company.timezone;

  return db.$transaction(
    async (tx): Promise<TouchTxOutcome> => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${company.id}:${input.visitorId}`}))`;
      // Com teto diário, a contagem do dia precisa ser exata: todos os toques da
      // empresa passam por um segundo lock, sempre depois do lock do aparelho
      // (mesma ordem em todo lugar, então dois toques nunca se travam um ao outro).
      if (offer.dailyCap !== null) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cap:${company.id}`}))`;
      }
      await expireVisitorVouchers(tx, company.id, input.visitorId, now);
      const vouchers = await findVisitorVouchers(tx, company.id, input.visitorId);
      const dayStart = startOfLocalDay(localDay(now, tz), tz);
      const issuedToday = offer.dailyCap !== null ? await countIssuedSince(tx, company.id, dayStart) : 0;

      const decision = decideOnTouch({
        now,
        cooldownDays: offer.cooldownDays,
        dailyCap: offer.dailyCap,
        issuedToday,
        visitorVouchers: vouchers,
      });

      switch (decision.kind) {
        case "ISSUE": {
          const window = computeVoucherWindow(now, tz, offer.windowDays);
          const voucher = await createVoucherWithUniqueCode(tx, {
            companyId: company.id,
            offerId: offer.id,
            cardId: input.cardId,
            visitId: input.visitId,
            visitorId: input.visitorId,
            title: offer.title,
            issuedAt: now,
            ...window,
          });
          return { kind: "ISSUED", voucher };
        }
        case "SHOW_EXISTING":
          return { kind: "EXISTING", voucher: vouchers.find((v) => v.id === decision.voucherId)! };
        case "COOLDOWN":
          return decision;
        case "CAP_REACHED":
          return decision;
      }
    },
    { timeout: 10_000 }
  );
}
