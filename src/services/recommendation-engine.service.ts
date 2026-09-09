import "server-only";
import { prisma } from "@/lib/prisma";
import type { AuthContext } from "@/lib/auth";
import { ForbiddenError } from "@/lib/auth";
import { executeRecommendation, undoExecution, previewExecution, type ScheduleOptions } from "./execution-engine.service";
import { getQueue } from "@/lib/queues/definitions";
import type { RecommendationStatus } from "@/generated/prisma/client";

/**
 * Recommendation Engine (Fase 11) — a camada que a tela `/dashboard/playbooks`
 * e a coluna "Próximas melhores ações" do Command Center realmente chamam.
 * Nunca decide gatilho/confiança/impacto sozinho (isso é
 * `playbook-engine.service.ts`) — só orquestra o ciclo de vida de uma
 * recomendação já criada: listar, explicar, ignorar, aplicar, desfazer.
 *
 * Auditoria é responsabilidade da camada de rota (ADR-017) — nenhuma função
 * aqui chama `recordAudit` diretamente, mesma convenção de
 * `campaign.service.ts`. Cada função devolve o suficiente (a recomendação/
 * execução atualizada) para a rota montar o registro de auditoria sozinha.
 */

export async function listRecommendations(companyId: string, status?: RecommendationStatus) {
  return prisma.playbookRecommendation.findMany({
    where: { companyId, ...(status ? { status } : {}) },
    include: { playbook: true, execution: true },
    orderBy: [{ status: "asc" }, { confidence: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function getRecommendationDetail(companyId: string, recommendationId: string) {
  const recommendation = await prisma.playbookRecommendation.findFirst({
    where: { id: recommendationId, companyId },
    include: { playbook: true, execution: true },
  });
  if (!recommendation) throw new ForbiddenError("Recomendação não encontrada nesta empresa");
  return recommendation;
}

export async function getExecutionPreview(companyId: string, recommendationId: string) {
  return previewExecution(companyId, recommendationId);
}

export async function ignoreRecommendation(ctx: AuthContext, recommendationId: string) {
  const recommendation = await getRecommendationDetail(ctx.companyId, recommendationId);
  if (recommendation.status !== "PENDING") throw new ForbiddenError("Esta recomendação já foi respondida");

  await prisma.playbookRecommendation.update({
    where: { id: recommendationId },
    data: { status: "IGNORED", respondedAt: new Date(), respondedByUserId: ctx.userId },
  });
  return recommendation;
}

export async function applyRecommendation(ctx: AuthContext, recommendationId: string, schedule?: ScheduleOptions) {
  const recommendation = await getRecommendationDetail(ctx.companyId, recommendationId);
  const { executionId } = await executeRecommendation(ctx, recommendationId, { schedule, triggeredBy: "USER" });
  return { executionId, playbookKey: recommendation.playbook.key };
}

export async function undoPlaybookExecution(ctx: AuthContext, executionId: string) {
  const execution = await prisma.playbookExecution.findFirst({ where: { id: executionId, companyId: ctx.companyId }, include: { recommendation: { include: { playbook: true } } } });
  if (!execution) throw new ForbiddenError("Execução não encontrada nesta empresa");
  await undoExecution(ctx, executionId);
  return execution;
}

export async function pauseScheduledExecution(ctx: AuthContext, executionId: string) {
  const execution = await prisma.playbookExecution.findFirst({ where: { id: executionId, companyId: ctx.companyId } });
  if (!execution) throw new ForbiddenError("Execução não encontrada nesta empresa");
  if (execution.status !== "SCHEDULED") throw new ForbiddenError("Só uma execução agendada pode ser pausada");
  await prisma.playbookExecution.update({ where: { id: executionId }, data: { status: "PAUSED" } });
}

export async function resumeScheduledExecution(ctx: AuthContext, executionId: string) {
  const execution = await prisma.playbookExecution.findFirst({ where: { id: executionId, companyId: ctx.companyId } });
  if (!execution) throw new ForbiddenError("Execução não encontrada nesta empresa");
  if (execution.status !== "PAUSED") throw new ForbiddenError("Só uma execução pausada pode ser retomada");
  await prisma.playbookExecution.update({ where: { id: executionId }, data: { status: "SCHEDULED" } });
}

export async function cancelScheduledExecution(ctx: AuthContext, executionId: string) {
  const execution = await prisma.playbookExecution.findFirst({ where: { id: executionId, companyId: ctx.companyId } });
  if (!execution) throw new ForbiddenError("Execução não encontrada nesta empresa");
  if (execution.status !== "SCHEDULED" && execution.status !== "PAUSED") throw new ForbiddenError("Esta execução não pode mais ser cancelada");

  const queue = getQueue("playbooks");
  if (queue) {
    await queue.removeJobScheduler(`exec:${executionId}`);
    await queue.remove(`exec:${executionId}`);
  }

  await prisma.playbookExecution.update({ where: { id: executionId }, data: { status: "CANCELLED" } });
  await prisma.playbookRecommendation.update({ where: { id: execution.recommendationId }, data: { status: "PENDING", respondedAt: null, respondedByUserId: null } });
}

/** Coluna "Próximas melhores ações" do Command Center (Fase 11) — as
 * recomendações pendentes de maior confiança, prontas para um clique. */
export async function listTopActionableRecommendations(companyId: string, limit = 5) {
  return prisma.playbookRecommendation.findMany({
    where: { companyId, status: "PENDING" },
    include: { playbook: true },
    orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}
