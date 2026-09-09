import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, requireScopeAccess, type AuthContext } from "@/lib/auth";
import { computeDisplayStatus } from "@/domain/campaign/status";
import { validateScopeTarget } from "@/domain/campaign/assignment";
import { invalidateCompanyCampaigns, invalidateOrganizationCampaigns } from "@/lib/resolution-engine/cache";
import * as campaignRepo from "@/repositories/campaign.repository";
import { findBranchById } from "@/repositories/branch.repository";
import { findZoneById } from "@/repositories/zone.repository";
import { configSchemaForType } from "@/lib/validations/campaign";
import type { CampaignListFilters } from "@/repositories/campaign.repository";
import type { AssignCampaignInput, CreateCampaignInput, UpdateCampaignInput } from "@/lib/validations/campaign";
import type { CreateRuleInput, CreateVariantInput } from "@/lib/validations/rule";

export class CampaignConflictError extends Error {
  constructor(message = "Já existe uma campanha com esse escopo") {
    super(message);
    this.name = "CampaignConflictError";
  }
}

function withDisplayStatus<T extends { status: import("@/generated/prisma/client").CampaignStatus; startsAt: Date | null; endsAt: Date | null }>(
  campaign: T
) {
  return { ...campaign, displayStatus: computeDisplayStatus(campaign, new Date()) };
}

export async function listCampaigns(companyId: string, filters: CampaignListFilters) {
  const campaigns = await campaignRepo.findCampaigns(companyId, filters);
  return campaigns.map(withDisplayStatus);
}

export async function getCampaign(companyId: string, campaignId: string) {
  const campaign = await campaignRepo.findCampaignById(companyId, campaignId);
  if (!campaign) throw new ForbiddenError("Campanha não encontrada nesta empresa");
  return withDisplayStatus(campaign);
}

// New campaigns always start as DRAFT (enforced by the schema default and by
// createCampaignSchema never accepting a `status` field) — never eligible
// for resolution yet, so no cache invalidation is needed here.
export async function createCampaign(companyId: string, input: CreateCampaignInput) {
  return campaignRepo.createCampaign(companyId, {
    name: input.name,
    description: input.description || null,
    type: input.type,
    priority: input.priority,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    recurrenceType: input.recurrenceType,
    recurrenceConfig: input.recurrenceConfig ?? Prisma.JsonNull,
    tags: input.tags,
    ownerId: input.ownerId ?? null,
    config: input.config as Prisma.InputJsonValue,
    estimatedCost: input.estimatedCost ?? null,
  });
}

async function assertCampaignInCompany(companyId: string, campaignId: string) {
  const campaign = await campaignRepo.findCampaignById(companyId, campaignId);
  if (!campaign) throw new ForbiddenError("Campanha não encontrada nesta empresa");
  return campaign;
}

// Any field here can change resolution behavior (status, dates, priority,
// config, type) — always invalidate, even if the specific edit looks
// harmless today. Cheap (one Redis DEL) and impossible to get wrong later.
export async function updateCampaign(companyId: string, campaignId: string, input: UpdateCampaignInput) {
  const existing = await assertCampaignInCompany(companyId, campaignId);

  // A variant's config is validated against its campaign's type only once,
  // at creation (createVariant). If the type changed afterward, an old
  // WHATSAPP variant's {phone,message} config would silently fail
  // buildDestinationPreview's Zod check against the new type's schema —
  // not a crash, but the campaign would render "Em breve" instead of the
  // customer's actual intended destination. Blocking the type change (with
  // a clear message to remove variants first) is simpler and safer than
  // trying to migrate variant configs across incompatible shapes.
  if (input.type !== undefined && input.type !== existing.type) {
    const variantCount = await campaignRepo.findVariants(companyId, campaignId);
    if (variantCount.length > 0) {
      throw new ForbiddenError("Remova as variantes de A/B antes de mudar o tipo de destino da campanha");
    }
  }

  const updated = await campaignRepo.updateCampaign(campaignId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description || null } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
    ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
    ...(input.recurrenceType !== undefined ? { recurrenceType: input.recurrenceType } : {}),
    ...(input.recurrenceConfig !== undefined ? { recurrenceConfig: input.recurrenceConfig ?? Prisma.JsonNull } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
    ...(input.config !== undefined ? { config: input.config as Prisma.InputJsonValue } : {}),
    ...(input.estimatedCost !== undefined ? { estimatedCost: input.estimatedCost } : {}),
  });

  await invalidateCompanyCampaigns(companyId);
  return updated;
}

export async function duplicateCampaign(companyId: string, campaignId: string) {
  const original = await assertCampaignInCompany(companyId, campaignId);
  // Assignments are deliberately NOT copied — re-assigning is a conscious
  // choice, and copying would risk instantly cloning a COMPANY-scope
  // assignment (see the uniqueness invariant below).
  return campaignRepo.createCampaign(companyId, {
    name: `${original.name} (cópia)`,
    description: original.description,
    type: original.type,
    status: "DRAFT",
    priority: original.priority,
    startsAt: original.startsAt,
    endsAt: original.endsAt,
    recurrenceType: original.recurrenceType,
    recurrenceConfig: original.recurrenceConfig ?? Prisma.JsonNull,
    tags: original.tags,
    config: original.config as Prisma.InputJsonValue,
    estimatedCost: original.estimatedCost,
  });
}

export async function archiveCampaign(companyId: string, campaignId: string) {
  await assertCampaignInCompany(companyId, campaignId);
  const updated = await campaignRepo.updateCampaign(campaignId, { status: "ARCHIVED" });
  await invalidateCompanyCampaigns(companyId);
  return updated;
}

export async function deleteCampaign(companyId: string, campaignId: string) {
  await assertCampaignInCompany(companyId, campaignId);
  await campaignRepo.deleteCampaign(campaignId);
  await invalidateCompanyCampaigns(companyId);
}

export function listAssignments(companyId: string, campaignId: string) {
  return campaignRepo.findAssignments(companyId, campaignId);
}

/**
 * Assigning a campaign to COMPANY scope has a real race: two concurrent
 * requests could both see "zero existing COMPANY-scope rows" and both
 * insert, since Postgres treats NULL as distinct and the schema's @@unique
 * can't stop it (see the CampaignAssignment model comment). Prisma's schema
 * DSL has no partial-unique-index syntax to fix this at the database level,
 * so this uses a Serializable transaction instead: Postgres will abort one
 * of two conflicting transactions with a serialization failure (P2034),
 * which is caught and turned into a clean, retriable error.
 */
export async function assignCampaign(ctx: AuthContext, campaignId: string, input: AssignCampaignInput) {
  const companyId = ctx.companyId;
  await assertCampaignInCompany(companyId, campaignId);

  const shapeError = validateScopeTarget(input.scope, input);
  if (shapeError) throw new ForbiddenError(shapeError);

  // A user restricted to specific branches/zones (UserAccessScope) can never
  // reach beyond that restriction by picking a wider scope — COMPANY and
  // ORGANIZATION both affect targets outside anything a restriction could
  // express. Only unrestricted users (the default) may use them.
  if ((input.scope === "COMPANY" || input.scope === "ORGANIZATION") && ctx.accessScopes.length > 0) {
    throw new ForbiddenError("Seu acesso é restrito a unidades/zonas específicas — não é possível atribuir para toda a empresa/organização");
  }

  if (input.scope === "ORGANIZATION") {
    // The one field that deliberately reaches across the company boundary
    // (see the CampaignAssignment model comment / ADR-013) — only valid
    // when it matches the acting company's own organization, never an
    // arbitrary id supplied by the client.
    if (!ctx.organizationId || input.organizationId !== ctx.organizationId) {
      throw new ForbiddenError("Esta empresa não pertence a essa organização");
    }
  }
  if (input.scope === "BRANCH") {
    const branch = await findBranchById(companyId, input.branchId!);
    if (!branch) throw new ForbiddenError("Unidade não encontrada nesta empresa");
    requireScopeAccess(ctx, { branchId: branch.id });
  }
  if (input.scope === "ZONE") {
    const zone = await findZoneById(companyId, input.zoneId!);
    if (!zone) throw new ForbiddenError("Zona não encontrada nesta empresa");
    requireScopeAccess(ctx, { branchId: zone.branchId, zoneId: zone.id });
  }
  if (input.scope === "CARD") {
    const card = await prisma.nFCCard.findFirst({ where: { id: input.cardId!, companyId } });
    if (!card) throw new ForbiddenError("Cartão não encontrado nesta empresa");
    requireScopeAccess(ctx, { branchId: card.branchId, zoneId: card.zoneId });
  }

  try {
    const assignment = await prisma.$transaction(
      async (tx) => {
        // The @@unique constraint on CampaignAssignment can't actually stop
        // a duplicate here, for ANY scope — Postgres's "NULLs are distinct"
        // rule means a composite unique constraint never flags two rows as
        // conflicting if even one of its columns is NULL in either row, and
        // every scope here has at least 3 of its 4 target columns
        // (organizationId/branchId/zoneId/cardId) null. COMPANY has all 4
        // null; CARD/ZONE/BRANCH each have 3 null. So this explicit
        // existence check — matched on the exact target columns, using real
        // equality (Prisma turns `null` into `IS NULL`, not the constraint's
        // broken NULL-vs-NULL comparison) — is the only thing actually
        // preventing a duplicate row for every scope, not just COMPANY/
        // ORGANIZATION. See the CampaignAssignment model comment.
        const existing = await tx.campaignAssignment.count({
          where: {
            campaignId,
            scope: input.scope,
            organizationId: input.organizationId ?? null,
            branchId: input.branchId ?? null,
            zoneId: input.zoneId ?? null,
            cardId: input.cardId ?? null,
          },
        });
        if (existing > 0) throw new CampaignConflictError("Essa campanha já está atribuída a este alvo");
        return tx.campaignAssignment.create({
          data: {
            companyId,
            campaignId,
            scope: input.scope,
            organizationId: input.organizationId ?? null,
            branchId: input.branchId ?? null,
            zoneId: input.zoneId ?? null,
            cardId: input.cardId ?? null,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await invalidateCompanyCampaigns(companyId);
    if (input.scope === "ORGANIZATION" && input.organizationId) {
      await invalidateOrganizationCampaigns(input.organizationId);
    }
    return assignment;
  } catch (err) {
    if (err instanceof CampaignConflictError) throw err;
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      throw new CampaignConflictError("Conflito ao atribuir a campanha — tente novamente");
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new CampaignConflictError("Essa campanha já está atribuída a este alvo");
    }
    throw err;
  }
}

/**
 * Table Map (Phase 5) batch-assignment: dropping a campaign onto a
 * marquee-selected group of tables. One transaction, CARD-scope only (a
 * batch of *specific* tables is not the same claim as "this whole zone" —
 * ZONE scope already covers that case via the single-assignment endpoint).
 * Idempotent: a card that already has this exact campaign CARD-assigned is
 * silently skipped rather than erroring the whole batch, so re-dropping the
 * same campaign onto an overlapping selection is always safe.
 *
 * Returns the IDs of the assignments actually created (via
 * `createManyAndReturn`, not `createMany`) so the caller — the Table Map's
 * Ghost Mode Evolution "Preview Inteligente" (Fase 6) — can Undo precisely
 * those rows within its short confirmation window, without touching any
 * assignment that already existed before this batch.
 */
export async function bulkAssignCampaignToCards(ctx: AuthContext, campaignId: string, cardIds: string[]) {
  const companyId = ctx.companyId;
  await assertCampaignInCompany(companyId, campaignId);

  const uniqueCardIds = [...new Set(cardIds)];
  if (uniqueCardIds.length === 0) return { created: 0, skipped: 0, assignmentIds: [] as string[] };

  const cards = await prisma.nFCCard.findMany({ where: { id: { in: uniqueCardIds }, companyId } });
  if (cards.length !== uniqueCardIds.length) {
    throw new ForbiddenError("Um ou mais cartões não pertencem a esta empresa");
  }

  for (const card of cards) {
    requireScopeAccess(ctx, { branchId: card.branchId, zoneId: card.zoneId });
  }

  const existing = await prisma.campaignAssignment.findMany({
    where: { campaignId, scope: "CARD", cardId: { in: uniqueCardIds } },
    select: { cardId: true },
  });
  const alreadyAssigned = new Set(existing.map((a) => a.cardId));
  const toCreate = cards.filter((c) => !alreadyAssigned.has(c.id));

  let created: { id: string }[] = [];
  if (toCreate.length > 0) {
    created = await prisma.campaignAssignment.createManyAndReturn({
      data: toCreate.map((c) => ({ companyId, campaignId, scope: "CARD" as const, cardId: c.id })),
      select: { id: true },
    });
    await invalidateCompanyCampaigns(companyId);
  }

  return { created: created.length, skipped: cards.length - toCreate.length, assignmentIds: created.map((a) => a.id) };
}

/**
 * Desfaz um lote específico de atribuições por ID — usado pelo botão
 * "Desfazer" do Ghost Mode Evolution logo após um `bulkAssignCampaignToCards`.
 * Deliberadamente não usa `unassignCampaign` (que faz uma checagem de escopo
 * por atribuição): todas as atribuições de um mesmo lote já passaram por
 * `requireScopeAccess` no momento da criação, então revalidar aqui seria
 * refazer trabalho sem mudar o resultado — a única invariante que falta
 * garantir é que o lote pertence mesmo a esta empresa.
 */
export async function undoBulkAssignment(companyId: string, assignmentIds: string[]) {
  if (assignmentIds.length === 0) return { deleted: 0 };
  const result = await prisma.campaignAssignment.deleteMany({
    where: { id: { in: assignmentIds }, companyId, scope: "CARD" },
  });
  await invalidateCompanyCampaigns(companyId);
  return { deleted: result.count };
}

export async function unassignCampaign(ctx: AuthContext, assignmentId: string) {
  const companyId = ctx.companyId;
  const assignment = await campaignRepo.findAssignmentById(companyId, assignmentId);
  if (!assignment) throw new ForbiddenError("Atribuição não encontrada nesta empresa");

  // Symmetric with assignCampaign: a scope-restricted user can only remove
  // assignments within their own branch(es)/zone(s) — otherwise they could
  // undo something outside their access even though they couldn't have
  // created it. COMPANY/ORGANIZATION-scope assignments are unreachable this
  // way for a restricted user (same reasoning as the assign-side check).
  if (assignment.scope === "COMPANY" || assignment.scope === "ORGANIZATION") {
    if (ctx.accessScopes.length > 0) {
      throw new ForbiddenError("Seu acesso é restrito a unidades/zonas específicas");
    }
  } else if (assignment.scope === "CARD") {
    // The assignment row itself only carries cardId — the branch/zone to
    // check against is the card's own, same as assignCampaign's CARD branch.
    const card = await prisma.nFCCard.findFirst({ where: { id: assignment.cardId!, companyId } });
    requireScopeAccess(ctx, { branchId: card?.branchId ?? null, zoneId: card?.zoneId ?? null });
  } else {
    requireScopeAccess(ctx, { branchId: assignment.branchId, zoneId: assignment.zoneId });
  }

  await campaignRepo.deleteAssignment(companyId, assignmentId);
  await invalidateCompanyCampaigns(companyId);
  if (assignment.scope === "ORGANIZATION" && assignment.organizationId) {
    await invalidateOrganizationCampaigns(assignment.organizationId);
  }
}

// --- Rules (Phase 3) ---
// Rules are read into the resolution engine's own cached campaigns blob
// (src/lib/resolution-engine/data.ts), so any change here must invalidate
// it — same reasoning as assignments/campaign edits above.

export function listRules(companyId: string, campaignId: string) {
  return campaignRepo.findRules(companyId, campaignId);
}

export async function createRule(companyId: string, campaignId: string, input: CreateRuleInput) {
  await assertCampaignInCompany(companyId, campaignId);
  const rule = await campaignRepo.createRule({ companyId, campaignId, type: input.type, config: input.config as Prisma.InputJsonValue });
  await invalidateCompanyCampaigns(companyId);
  return rule;
}

export async function deleteRule(companyId: string, ruleId: string) {
  const rule = await campaignRepo.findRuleById(companyId, ruleId);
  if (!rule) throw new ForbiddenError("Regra não encontrada nesta empresa");
  await campaignRepo.deleteRule(companyId, ruleId);
  await invalidateCompanyCampaigns(companyId);
}

// --- A/B variants (Phase 3) ---

export function listVariants(companyId: string, campaignId: string) {
  return campaignRepo.findVariants(companyId, campaignId);
}

export async function createVariant(companyId: string, campaignId: string, input: CreateVariantInput) {
  const campaign = await assertCampaignInCompany(companyId, campaignId);

  // A variant's config must match the shape its own campaign type expects —
  // the same Zod schemas Campaign.config itself is validated with, so a
  // variant can never carry a config the render function can't handle.
  const configCheck = configSchemaForType(campaign.type).safeParse(input.config);
  if (!configCheck.success) throw new ForbiddenError("Configuração da variante inválida para o tipo da campanha");

  const variant = await campaignRepo.createVariant({
    companyId,
    campaignId,
    name: input.name,
    weight: input.weight,
    config: input.config as Prisma.InputJsonValue,
  });
  await invalidateCompanyCampaigns(companyId);
  return variant;
}

export async function deleteVariant(companyId: string, variantId: string) {
  const variant = await campaignRepo.findVariantById(companyId, variantId);
  if (!variant) throw new ForbiddenError("Variante não encontrada nesta empresa");
  await campaignRepo.deleteVariant(companyId, variantId);
  await invalidateCompanyCampaigns(companyId);
}
