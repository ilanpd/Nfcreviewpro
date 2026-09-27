import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { generateVoucherCode } from "@/domain/return-offer/code";
import type { VoucherLike } from "@/domain/return-offer/lifecycle";
import { randomBytes } from "node:crypto";

/**
 * Acesso a dados do Retorno (ADR-079). Recebe o cliente do banco (ou uma
 * transação) como parâmetro e não importa `server-only`, de propósito: é o núcleo
 * que garante o resgate atômico e a unicidade do código, e precisa poder ser
 * exercitado por um script contra um banco real (o teste de dois resgates
 * simultâneos), fora do Next.
 */

type Db = PrismaClient | Prisma.TransactionClient;

const MAX_CODE_ATTEMPTS = 8;

export interface NewVoucherData {
  companyId: string;
  offerId: string;
  cardId: string | null;
  visitId: string | null;
  visitorId: string | null;
  title: string;
  issuedAt: Date;
  availableAt: Date;
  expiresAt: Date;
}

/**
 * Cria o brinde com um código único por empresa. Usa `createMany` com
 * `skipDuplicates` (INSERT ... ON CONFLICT DO NOTHING): uma colisão de código
 * não aborta a transação, só devolve zero linhas, e o sorteio recomeça. A chance
 * de colidir cresce com o volume da empresa (100 mil brindes em 481 milhões de
 * códigos são 0,02% por emissão), então o tratamento é obrigatório.
 */
export async function createVoucherWithUniqueCode(db: Db, data: NewVoucherData) {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateVoucherCode((n) => randomBytes(n));
    const { count } = await db.voucher.createMany({ data: [{ ...data, code }], skipDuplicates: true });
    if (count === 1) {
      return db.voucher.findUniqueOrThrow({ where: { companyId_code: { companyId: data.companyId, code } } });
    }
  }
  throw new Error("Não foi possível gerar um código de brinde único depois de várias tentativas");
}

/**
 * Resgate atômico: um único UPDATE condicionado ao estado. Dois resgates
 * simultâneos do mesmo brinde disputam a mesma linha e o Postgres deixa passar
 * exatamente um (o segundo enxerga `status` já alterado e afeta zero linhas).
 * `true` = este chamador resgatou.
 */
export async function redeemVoucherAtomically(db: Db, voucherId: string, now: Date): Promise<boolean> {
  const { count } = await db.voucher.updateMany({
    where: { id: voucherId, status: "ISSUED", availableAt: { lte: now }, expiresAt: { gt: now } },
    data: { status: "REDEEMED", redeemedAt: now },
  });
  return count === 1;
}

/** Marca como vencidos os brindes deste aparelho que passaram da validade. */
export async function expireVisitorVouchers(db: Db, companyId: string, visitorId: string, now: Date) {
  await db.voucher.updateMany({
    where: { companyId, visitorId, status: "ISSUED", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
}

export async function findVisitorVouchers(db: Db, companyId: string, visitorId: string): Promise<(VoucherLike & { code: string; title: string })[]> {
  return db.voucher.findMany({
    where: { companyId, visitorId },
    orderBy: { issuedAt: "desc" },
    take: 20,
    select: { id: true, code: true, title: true, status: true, issuedAt: true, availableAt: true, expiresAt: true },
  });
}

export function countIssuedSince(db: Db, companyId: string, since: Date) {
  return db.voucher.count({ where: { companyId, issuedAt: { gte: since } } });
}
