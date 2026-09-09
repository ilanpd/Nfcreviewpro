import "server-only";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth";
import { generateCardCode } from "@/lib/codes";
import { cardPublicUrl, generateQrCodeDataUrl } from "@/lib/qrcode";
import { canCreateCard } from "@/lib/plans";
import { invalidateCard } from "@/lib/resolution-engine/cache";
import type { CreateCardInput, UpdateCardInput, UpdateCardLayoutInput, BulkUpdateCardLayoutInput } from "@/lib/validations/card";

/** Public lookup used by /r/[code] — only ever returns cards for active companies. */
export function getActiveCardByCode(code: string) {
  return prisma.nFCCard.findFirst({
    where: { uniqueCode: code, active: true },
    include: { company: true },
  });
}

export function listCards(companyId: string) {
  return prisma.nFCCard.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { visits: true } } },
  });
}

export async function getCardForCompany(companyId: string, cardId: string) {
  const card = await prisma.nFCCard.findFirst({ where: { id: cardId, companyId } });
  if (!card) throw new ForbiddenError("Cartão não encontrado nesta empresa");
  return card;
}

export async function createCard(companyId: string, input: CreateCardInput) {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const currentCount = await prisma.nFCCard.count({ where: { companyId } });

  if (!canCreateCard(company.plan, currentCount)) {
    throw new ForbiddenError(`O plano ${company.plan} atingiu o limite de cartões. Faça upgrade para criar mais.`);
  }

  let uniqueCode = generateCardCode();
  while (await prisma.nFCCard.findUnique({ where: { uniqueCode } })) {
    uniqueCode = generateCardCode();
  }

  const qrCodeUrl = await generateQrCodeDataUrl(cardPublicUrl(uniqueCode));

  return prisma.nFCCard.create({
    data: { companyId, uniqueCode, qrCodeUrl, ...input },
  });
}

// A branchId/zoneId belonging to another company must never be accepted
// here — without this check, a card could be silently reassigned across
// tenants (the update itself has no other guard against it, since Prisma
// happily accepts any valid cuid as a foreign key regardless of ownership).
async function assertTargetsInCompany(companyId: string, input: UpdateCardInput) {
  if (input.branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: input.branchId, companyId } });
    if (!branch) throw new ForbiddenError("Unidade não encontrada nesta empresa");
  }
  if (input.zoneId) {
    const zone = await prisma.zone.findFirst({ where: { id: input.zoneId, companyId } });
    if (!zone) throw new ForbiddenError("Zona não encontrada nesta empresa");
  }
}

export async function updateCard(companyId: string, cardId: string, input: UpdateCardInput) {
  const existing = await getCardForCompany(companyId, cardId);
  await assertTargetsInCompany(companyId, input);
  const updated = await prisma.nFCCard.update({ where: { id: cardId }, data: input });
  await invalidateCard(existing.uniqueCode);
  return updated;
}

export async function deleteCard(companyId: string, cardId: string) {
  const existing = await getCardForCompany(companyId, cardId);
  await prisma.nFCCard.delete({ where: { id: cardId } });
  await invalidateCard(existing.uniqueCode);
}

// --- Table Map (Phase 5) ---
// Layout is a pure dashboard/editing concern (see the NFCCard schema
// comment) — never read by the resolution engine, so none of this needs to
// invalidate the resolver's cache the way name/branch/zone/active changes do.

export async function updateCardLayout(companyId: string, cardId: string, input: UpdateCardLayoutInput) {
  await getCardForCompany(companyId, cardId);
  return prisma.nFCCard.update({ where: { id: cardId }, data: input });
}

/**
 * One transaction for a multi-select drag (or a marquee-move of hundreds of
 * tables) instead of one round trip per table — every id is verified to
 * belong to this company before any write happens, so a request can't move
 * another tenant's table by id-guessing.
 */
export async function bulkUpdateCardLayout(companyId: string, input: BulkUpdateCardLayoutInput) {
  const ids = input.updates.map((u) => u.id);
  const owned = await prisma.nFCCard.findMany({ where: { id: { in: ids }, companyId }, select: { id: true } });
  const ownedIds = new Set(owned.map((c) => c.id));
  const invalid = ids.filter((id) => !ownedIds.has(id));
  if (invalid.length > 0) throw new ForbiddenError("Um ou mais cartões não pertencem a esta empresa");

  await prisma.$transaction(
    input.updates.map((u) => prisma.nFCCard.update({ where: { id: u.id }, data: { layoutX: u.layoutX, layoutY: u.layoutY } }))
  );
}

/** Duplicates a table's identity (new NFCCard, new uniqueCode/QR — never
 * reused, per ADR-001) and its layout, offset so the copy doesn't render
 * exactly on top of the original. Campaign assignments are deliberately NOT
 * copied — same reasoning as duplicateCampaign in campaign.service.ts: a
 * cloned CARD-scope assignment would silently double-target whatever the
 * original was already pointed at. */
export async function duplicateCard(companyId: string, cardId: string) {
  const original = await getCardForCompany(companyId, cardId);
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const currentCount = await prisma.nFCCard.count({ where: { companyId } });

  if (!canCreateCard(company.plan, currentCount)) {
    throw new ForbiddenError(`O plano ${company.plan} atingiu o limite de cartões. Faça upgrade para criar mais.`);
  }

  let uniqueCode = generateCardCode();
  while (await prisma.nFCCard.findUnique({ where: { uniqueCode } })) {
    uniqueCode = generateCardCode();
  }
  const qrCodeUrl = await generateQrCodeDataUrl(cardPublicUrl(uniqueCode));

  return prisma.nFCCard.create({
    data: {
      companyId,
      uniqueCode,
      qrCodeUrl,
      name: `${original.name} (cópia)`,
      tags: original.tags,
      branchId: original.branchId,
      zoneId: original.zoneId,
      layoutX: original.layoutX !== null ? original.layoutX + 24 : null,
      layoutY: original.layoutY !== null ? original.layoutY + 24 : null,
      layoutWidth: original.layoutWidth,
      layoutHeight: original.layoutHeight,
      layoutRotation: original.layoutRotation,
      tableShape: original.tableShape,
      seats: original.seats,
    },
  });
}
