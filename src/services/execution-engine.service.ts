import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { AuthContext } from "@/lib/auth";
import { ForbiddenError } from "@/lib/auth";
import { publishEvent } from "@/lib/event-bus";
import { getQueue } from "@/lib/queues/definitions";
import { getApproaches } from "./heatmap.service";
import { buildSyntheticAuthContext } from "@/lib/api-v1/auth";
import { assignCampaign, createCampaign, updateCampaign, unassignCampaign } from "./campaign.service";
import { createRule, deleteRule } from "./campaign.service";
import type { PlaybookActionType, TargetScope } from "@/generated/prisma/client";

/**
 * Execution Engine (Fase 11) — o único lugar que de fato MUDA algo em nome
 * de um Playbook. Nunca chama Prisma direto para mexer em Campaign/Rule/
 * CampaignAssignment — sempre via `services/campaign.service.ts`, os
 * MESMOS caminhos que o dashboard manual e a API v1 (Fase 9) já usam. Isso
 * garante que uma execução de playbook nunca pode fazer algo que um usuário
 * não pudesse fazer manualmente, e que o cache do Resolution Engine é
 * sempre invalidado corretamente (a invalidação já vive dentro de
 * `campaign.service.ts`, nunca duplicada aqui).
 *
 * One-Tap Execution: "reutilizar Ghost Mode; mostrar Preview Inteligente;
 * calcular impacto; permitir Desfazer. Nunca executar silenciosamente." —
 * `previewExecution` reaproveita a MESMA rota de estimativa que o
 * `GhostModePreviewDialog` do Mapa de Mesas usa (`heatmap.service`'s
 * `getApproaches`), e toda execução grava `actionsTaken` com estado
 * suficiente para `undoExecution` reverter por completo, nunca parcial.
 */

interface ActionTaken {
  type: PlaybookActionType;
  campaignId: string;
  campaignWasCreated: boolean;
  assignmentIds: string[];
  ruleId: string | null;
  previousStatus: string | null;
  previousPriority: number | null;
}

async function getRecommendationOrThrow(companyId: string, recommendationId: string) {
  const recommendation = await prisma.playbookRecommendation.findFirst({
    where: { id: recommendationId, companyId },
    include: { playbook: true, execution: true },
  });
  if (!recommendation) throw new ForbiddenError("Recomendação não encontrada nesta empresa");
  return recommendation;
}

async function resolveScopeCardIds(companyId: string, scopeType: TargetScope, scopeId: string | null): Promise<string[]> {
  if (scopeType === "CARD" && scopeId) return [scopeId];
  if (scopeType === "ZONE" && scopeId) {
    const cards = await prisma.nFCCard.findMany({ where: { companyId, zoneId: scopeId }, select: { id: true } });
    return cards.map((c) => c.id);
  }
  if (scopeType === "BRANCH" && scopeId) {
    const cards = await prisma.nFCCard.findMany({ where: { companyId, branchId: scopeId }, select: { id: true } });
    return cards.map((c) => c.id);
  }
  const cards = await prisma.nFCCard.findMany({ where: { companyId }, select: { id: true } });
  return cards.map((c) => c.id);
}

function scopeLabel(scopeType: TargetScope, scopeName: string): string {
  switch (scopeType) {
    case "CARD":
      return `a mesa "${scopeName}"`;
    case "ZONE":
      return `a zona "${scopeName}"`;
    case "BRANCH":
      return `a unidade "${scopeName}"`;
    default:
      return "toda a empresa";
  }
}

export interface ExecutionPreview {
  scopeLabel: string;
  affectedCardIds: string[];
  affectedCount: number;
  recentApproaches: number;
  estimatedImpact: unknown;
  reversalDescription: string;
  actionType: PlaybookActionType;
}

export async function previewExecution(companyId: string, recommendationId: string): Promise<ExecutionPreview> {
  const recommendation = await getRecommendationOrThrow(companyId, recommendationId);
  const cardIds = await resolveScopeCardIds(companyId, recommendation.scopeType, recommendation.scopeId);

  const since = new Date(Date.now() - 24 * 3_600_000);
  const approaches = cardIds.length > 0 ? await getApproaches(companyId, since) : [];
  const recentApproaches = approaches.filter((a) => cardIds.includes(a.cardId)).reduce((sum, a) => sum + a.count, 0);

  return {
    scopeLabel: scopeLabel(recommendation.scopeType, recommendation.headline),
    affectedCardIds: cardIds,
    affectedCount: cardIds.length,
    recentApproaches,
    estimatedImpact: recommendation.estimatedImpact,
    reversalDescription: recommendation.playbook.reversalDescription,
    actionType: recommendation.playbook.actionType,
  };
}

export interface ScheduleOptions {
  mode: "now" | "later" | "repeat";
  runAt?: Date;
  recurrence?: { type: "DAILY" | "WEEKLY" };
}

// Repetir só é permitido para ações idempotentes (atribuir/criar) — nunca
// para BOOST_CAMPAIGN_PRIORITY/PAUSE_CAMPAIGN, cuja repetição indefinida
// composta seria exatamente o "loop infinito de automação" que o Architect
// Review desta fase pede para caçar ativamente. Ver ADR-050.
const REPEATABLE_ACTION_TYPES: PlaybookActionType[] = ["ASSIGN_CAMPAIGN_TO_SCOPE", "CREATE_AND_ASSIGN_CAMPAIGN"];

export async function executeRecommendation(
  ctx: AuthContext,
  recommendationId: string,
  options: { schedule?: ScheduleOptions; triggeredBy?: "USER" | "AUTOPILOT" } = {}
): Promise<{ executionId: string }> {
  const recommendation = await getRecommendationOrThrow(ctx.companyId, recommendationId);
  if (recommendation.status !== "PENDING") {
    throw new ForbiddenError("Esta recomendação já foi respondida");
  }

  const triggeredBy = options.triggeredBy ?? "USER";
  const schedule = options.schedule;

  if (schedule?.mode === "repeat" && !REPEATABLE_ACTION_TYPES.includes(recommendation.playbook.actionType)) {
    throw new ForbiddenError("Este tipo de ação não pode ser repetido automaticamente — aplique manualmente a cada vez");
  }

  const scheduledFor = schedule?.mode === "later" ? schedule.runAt ?? null : null;
  const isRepeating = schedule?.mode === "repeat";

  const execution = await prisma.playbookExecution.create({
    data: {
      companyId: ctx.companyId,
      recommendationId,
      status: scheduledFor || isRepeating ? "SCHEDULED" : "RUNNING",
      triggeredBy,
      triggeredByUserId: triggeredBy === "USER" ? ctx.userId : null,
      scheduledFor,
      recurrence: isRepeating ? (schedule!.recurrence as unknown as Prisma.InputJsonValue) : undefined,
      startedAt: scheduledFor || isRepeating ? null : new Date(),
    },
  });

  await prisma.playbookRecommendation.update({
    where: { id: recommendationId },
    data: { status: "APPLIED", respondedAt: new Date(), respondedByUserId: triggeredBy === "USER" ? ctx.userId : null },
  });

  if (scheduledFor) {
    await enqueueDelayed(execution.id, scheduledFor.getTime() - Date.now());
    return { executionId: execution.id };
  }
  if (isRepeating) {
    await enqueueRepeating(execution.id, schedule!.recurrence!.type);
    return { executionId: execution.id };
  }

  await runExecution(execution.id);
  return { executionId: execution.id };
}

async function enqueueDelayed(executionId: string, delayMs: number) {
  const queue = getQueue("playbooks");
  if (!queue) {
    // Sem Queue Engine disponível: roda imediatamente em vez de perder a
    // execução — degradação graciosa, mesmo padrão de toda fila deste
    // produto (nunca bloqueia por causa de infraestrutura de apoio ausente).
    await runExecution(executionId);
    return;
  }
  await queue.add("execute-scheduled-playbook", { executionId }, { delay: Math.max(0, delayMs), jobId: `exec:${executionId}` });
}

async function enqueueRepeating(executionId: string, recurrenceType: "DAILY" | "WEEKLY") {
  const queue = getQueue("playbooks");
  if (!queue) {
    await runExecution(executionId);
    return;
  }
  const every = recurrenceType === "DAILY" ? 24 * 3_600_000 : 7 * 24 * 3_600_000;
  // BullMQ 6.x move job recorrente para sua própria API de "Job Scheduler" —
  // `add({repeat})` não existe mais nesta versão. `jobSchedulerId` é o
  // identificador estável que `cancelRepeatingJob`/`cancelScheduledExecution`
  // usam depois para pausar/remover exatamente este agendamento.
  await queue.upsertJobScheduler(`exec:${executionId}`, { every }, { name: "execute-scheduled-playbook", data: { executionId } });
}

/** Chamado pelo `playbooksProcessor` (fila "playbooks") para uma execução
 * agendada/recorrente — nunca chamado diretamente por uma rota. */
export async function runScheduledExecution(executionId: string): Promise<void> {
  const execution = await prisma.playbookExecution.findUnique({ where: { id: executionId } });
  if (!execution) return;
  if (execution.status === "PAUSED" || execution.status === "CANCELLED" || execution.status === "UNDONE") return;

  const recommendation = await prisma.playbookRecommendation.findUnique({ where: { id: execution.recommendationId } });
  if (recommendation?.expiresAt && recommendation.expiresAt.getTime() < Date.now()) {
    await cancelRepeatingJob(executionId);
    await prisma.playbookExecution.update({ where: { id: executionId }, data: { status: "COMPLETED", completedAt: new Date() } });
    return;
  }

  await runExecution(executionId);
}

async function cancelRepeatingJob(executionId: string) {
  const queue = getQueue("playbooks");
  if (!queue) return;
  await queue.removeJobScheduler(`exec:${executionId}`);
}

async function runExecution(executionId: string): Promise<void> {
  const execution = await prisma.playbookExecution.findUniqueOrThrow({
    where: { id: executionId },
    include: { recommendation: { include: { playbook: true } } },
  });
  const { recommendation } = execution;
  const { playbook } = recommendation;
  const ctx = await buildSyntheticAuthContext(execution.companyId);

  try {
    await prisma.playbookExecution.update({ where: { id: executionId }, data: { status: "RUNNING", startedAt: execution.startedAt ?? new Date() } });

    const actionsTaken = await runAction(ctx, playbook.actionType, playbook.actionConfig as Record<string, unknown>, recommendation);

    const isRepeating = execution.recurrence !== null;
    await prisma.playbookExecution.update({
      where: { id: executionId },
      data: {
        status: isRepeating ? "SCHEDULED" : "COMPLETED",
        actionsTaken: actionsTaken as unknown as Prisma.InputJsonValue,
        completedAt: isRepeating ? null : new Date(),
      },
    });

    await publishEvent(
      "PlaybookExecutado",
      { executionId, recommendationId: recommendation.id, playbookKey: playbook.key, triggeredBy: execution.triggeredBy as "USER" | "AUTOPILOT" },
      { companyId: execution.companyId }
    );
  } catch (err) {
    await prisma.playbookExecution.update({
      where: { id: executionId },
      data: { status: "FAILED", failureReason: err instanceof Error ? err.message : "Erro desconhecido" },
    });
    throw err;
  }
}

async function runAction(
  ctx: AuthContext,
  actionType: PlaybookActionType,
  actionConfig: Record<string, unknown>,
  recommendation: { id: string; scopeType: TargetScope; scopeId: string | null; targetCampaignId: string | null }
): Promise<ActionTaken> {
  switch (actionType) {
    case "CREATE_AND_ASSIGN_CAMPAIGN":
      return runCreateAndAssign(ctx, actionConfig, recommendation);
    case "ASSIGN_CAMPAIGN_TO_SCOPE":
      return runAssignExisting(ctx, recommendation);
    case "BOOST_CAMPAIGN_PRIORITY":
      return runBoostPriority(ctx, actionConfig, recommendation);
    case "PAUSE_CAMPAIGN":
      return runPause(ctx, recommendation);
  }
}

async function runCreateAndAssign(
  ctx: AuthContext,
  actionConfig: Record<string, unknown>,
  recommendation: { scopeType: TargetScope; scopeId: string | null }
): Promise<ActionTaken> {
  const preferredType = (actionConfig.preferredCampaignType as "WHATSAPP" | "GOOGLE_REVIEWS") ?? "WHATSAPP";
  const messageTemplate = (actionConfig.messageTemplate as string | undefined) ?? "Temos uma novidade especial para você agora — aproveite!";
  const ruleSpec = actionConfig.rule as { type: "TIME_WINDOW" | "DAY_OF_WEEK"; config: Record<string, unknown> } | undefined;

  const company = await prisma.company.findUniqueOrThrow({ where: { id: ctx.companyId } });
  const campaignName = (actionConfig.campaignName as string | undefined) ?? "Playbook automático";

  const config = preferredType === "GOOGLE_REVIEWS" ? { url: company.googleReviewUrl } : { phone: company.whatsapp, message: messageTemplate };

  const campaign = await createCampaign(ctx.companyId, {
    name: campaignName,
    description: "Criada automaticamente por um Smart Campaign Playbook.",
    type: preferredType,
    priority: 50,
    recurrenceType: "NONE",
    tags: ["playbook"],
    config,
  } as Parameters<typeof createCampaign>[1]);

  await updateCampaign(ctx.companyId, campaign.id, { status: "ACTIVE" } as Parameters<typeof updateCampaign>[2]);

  let ruleId: string | null = null;
  if (ruleSpec) {
    const rule = await createRule(ctx.companyId, campaign.id, { type: ruleSpec.type, config: ruleSpec.config } as Parameters<typeof createRule>[2]);
    ruleId = rule.id;
  }

  const assignmentIds = await assignToScope(ctx, campaign.id, recommendation.scopeType, recommendation.scopeId);

  return { type: "CREATE_AND_ASSIGN_CAMPAIGN", campaignId: campaign.id, campaignWasCreated: true, assignmentIds, ruleId, previousStatus: null, previousPriority: null };
}

async function runAssignExisting(
  ctx: AuthContext,
  recommendation: { scopeType: TargetScope; scopeId: string | null; targetCampaignId: string | null }
): Promise<ActionTaken> {
  if (!recommendation.targetCampaignId) throw new Error("Nenhuma campanha alvo definida para esta recomendação");
  const assignmentIds = await assignToScope(ctx, recommendation.targetCampaignId, recommendation.scopeType, recommendation.scopeId);
  return { type: "ASSIGN_CAMPAIGN_TO_SCOPE", campaignId: recommendation.targetCampaignId, campaignWasCreated: false, assignmentIds, ruleId: null, previousStatus: null, previousPriority: null };
}

async function assignToScope(ctx: AuthContext, campaignId: string, scopeType: TargetScope, scopeId: string | null): Promise<string[]> {
  if (scopeType === "COMPANY") {
    const assignment = await assignCampaign(ctx, campaignId, { scope: "COMPANY" } as Parameters<typeof assignCampaign>[2]);
    return [assignment.id];
  }
  if (scopeType === "ZONE" && scopeId) {
    const assignment = await assignCampaign(ctx, campaignId, { scope: "ZONE", zoneId: scopeId } as Parameters<typeof assignCampaign>[2]);
    return [assignment.id];
  }
  if (scopeType === "BRANCH" && scopeId) {
    const assignment = await assignCampaign(ctx, campaignId, { scope: "BRANCH", branchId: scopeId } as Parameters<typeof assignCampaign>[2]);
    return [assignment.id];
  }
  if (scopeType === "CARD" && scopeId) {
    const assignment = await assignCampaign(ctx, campaignId, { scope: "CARD", cardId: scopeId } as Parameters<typeof assignCampaign>[2]);
    return [assignment.id];
  }
  return [];
}

async function runBoostPriority(
  ctx: AuthContext,
  actionConfig: Record<string, unknown>,
  recommendation: { targetCampaignId: string | null }
): Promise<ActionTaken> {
  if (!recommendation.targetCampaignId) throw new Error("Nenhuma campanha alvo definida para esta recomendação");
  const delta = (actionConfig.priorityDelta as number | undefined) ?? 20;
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: recommendation.targetCampaignId } });
  const newPriority = Math.min(100, campaign.priority + delta);

  await updateCampaign(ctx.companyId, campaign.id, { priority: newPriority } as Parameters<typeof updateCampaign>[2]);

  return { type: "BOOST_CAMPAIGN_PRIORITY", campaignId: campaign.id, campaignWasCreated: false, assignmentIds: [], ruleId: null, previousStatus: null, previousPriority: campaign.priority };
}

async function runPause(ctx: AuthContext, recommendation: { targetCampaignId: string | null }): Promise<ActionTaken> {
  if (!recommendation.targetCampaignId) throw new Error("Nenhuma campanha alvo definida para esta recomendação");
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: recommendation.targetCampaignId } });

  await updateCampaign(ctx.companyId, campaign.id, { status: "PAUSED" } as Parameters<typeof updateCampaign>[2]);

  return { type: "PAUSE_CAMPAIGN", campaignId: campaign.id, campaignWasCreated: false, assignmentIds: [], ruleId: null, previousStatus: campaign.status, previousPriority: null };
}

/**
 * Undo completo, nunca parcial (Architect Review): desfaz exatamente o que
 * `actionsTaken` registrou — remove as atribuições criadas, restaura
 * prioridade/status anteriores, e arquiva (nunca exclui) uma campanha que
 * esta própria execução criou, mas só se nada mais além dela ainda a
 * referencia.
 */
export async function undoExecution(ctx: AuthContext, executionId: string): Promise<void> {
  const execution = await prisma.playbookExecution.findFirst({
    where: { id: executionId, companyId: ctx.companyId },
    include: { recommendation: { include: { playbook: true } } },
  });
  if (!execution) throw new ForbiddenError("Execução não encontrada nesta empresa");
  if (execution.status === "UNDONE") return;

  await cancelRepeatingJob(executionId);

  const actions = (execution.actionsTaken as unknown as ActionTaken | null) ?? null;
  if (actions) {
    for (const assignmentId of actions.assignmentIds) {
      try {
        await unassignCampaign(ctx, assignmentId);
      } catch {
        // já removida/inexistente — undo continua idempotente
      }
    }
    if (actions.ruleId) {
      try {
        await deleteRule(ctx.companyId, actions.ruleId);
      } catch {
        // regra já removida
      }
    }
    if (actions.previousPriority !== null) {
      await updateCampaign(ctx.companyId, actions.campaignId, { priority: actions.previousPriority } as Parameters<typeof updateCampaign>[2]);
    }
    if (actions.previousStatus) {
      await updateCampaign(ctx.companyId, actions.campaignId, { status: actions.previousStatus } as Parameters<typeof updateCampaign>[2]);
    }
    if (actions.campaignWasCreated) {
      const remainingAssignments = await prisma.campaignAssignment.count({ where: { campaignId: actions.campaignId } });
      if (remainingAssignments === 0) {
        await updateCampaign(ctx.companyId, actions.campaignId, { status: "ARCHIVED" } as Parameters<typeof updateCampaign>[2]);
      }
    }
  }

  await prisma.playbookExecution.update({ where: { id: executionId }, data: { status: "UNDONE", undoneAt: new Date() } });
  await publishEvent(
    "PlaybookDesfeito",
    { executionId, recommendationId: execution.recommendationId, playbookKey: execution.recommendation.playbook.key },
    { companyId: ctx.companyId }
  );
}
