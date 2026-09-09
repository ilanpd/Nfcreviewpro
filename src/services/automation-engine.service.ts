import "server-only";
import { prisma } from "@/lib/prisma";
import type { AutoPilotLevel } from "@/generated/prisma/client";
import { buildSyntheticAuthContext } from "@/lib/api-v1/auth";
import { executeRecommendation } from "./execution-engine.service";
import { recordAudit } from "./audit.service";
import type { AuthContext } from "@/lib/auth";

/**
 * AutoPilot Engine (Fase 11) — a ÚNICA porta de entrada para uma
 * recomendação virar execução SEM um clique humano. Implementa a Autonomy
 * Review ponto a ponto:
 *   - "O sistema age sozinho?" — só nos níveis Semi-automático/Automático,
 *     e só para `Playbook.safeForAutomation=true`.
 *   - "O usuário entende por que agiu?" — toda auto-execução carrega
 *     `triggeredBy="AUTOPILOT"`, visível no cartão da recomendação e no
 *     Explainability Panel exatamente como uma execução manual.
 *   - "Existe Undo?" — sim, a MESMA `undoExecution` de uma execução manual.
 *   - "Existe limite de segurança?" — confiança mínima alta (>=0.75) E um
 *     teto diário de auto-execuções por empresa (`MAX_AUTO_PER_DAY`) —
 *     nunca ilimitado.
 *   - "Existe log completo?" — todo evento publicado no Event Bus
 *     (`PlaybookExecutado`) e toda execução em `PlaybookExecution`, com
 *     `triggeredBy` nunca ambíguo.
 *
 * Ver ADR-049.
 */
const MIN_CONFIDENCE_FOR_AUTOMATION = 0.75;
const MAX_AUTO_EXECUTIONS_PER_DAY = 5;
const SEMI_AUTOMATIC_DELAY_MS = 15 * 60_000; // janela de cancelamento — "nunca executar silenciosamente"

export async function getAutoPilotSetting(companyId: string): Promise<AutoPilotLevel> {
  const setting = await prisma.autoPilotSetting.findUnique({ where: { companyId } });
  return setting?.level ?? "MANUAL";
}

export async function setAutoPilotLevel(ctx: AuthContext, level: AutoPilotLevel): Promise<void> {
  await prisma.autoPilotSetting.upsert({
    where: { companyId: ctx.companyId },
    create: { companyId: ctx.companyId, level, updatedByUserId: ctx.userId },
    update: { level, updatedByUserId: ctx.userId },
  });
  await recordAudit(ctx, "AUTOPILOT_LEVEL_CHANGED", { metadata: { level } });
}

async function countAutoExecutionsToday(companyId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return prisma.playbookExecution.count({
    where: { companyId, triggeredBy: "AUTOPILOT", createdAt: { gte: startOfDay } },
  });
}

/** Chamado pelo Playbook Engine logo após criar uma recomendação. Nunca
 * chamado de nenhum outro lugar — a decisão de autonomia nasce sempre no
 * mesmo ponto do fluxo, nunca espalhada. */
export async function maybeAutoExecute(recommendationId: string): Promise<void> {
  const recommendation = await prisma.playbookRecommendation.findUnique({
    where: { id: recommendationId },
    include: { playbook: true },
  });
  if (!recommendation || recommendation.status !== "PENDING") return;
  if (!recommendation.playbook.safeForAutomation) return;
  if (recommendation.confidence < MIN_CONFIDENCE_FOR_AUTOMATION) return;

  const level = await getAutoPilotSetting(recommendation.companyId);
  if (level === "MANUAL" || level === "RECOMMENDED") return;

  const autoCount = await countAutoExecutionsToday(recommendation.companyId);
  if (autoCount >= MAX_AUTO_EXECUTIONS_PER_DAY) return; // limite de segurança diário — fica pendente para aprovação manual

  const ctx = await buildSyntheticAuthContext(recommendation.companyId);

  if (level === "AUTOMATIC") {
    await executeRecommendation(ctx, recommendationId, { triggeredBy: "AUTOPILOT" });
    return;
  }

  // SEMI_AUTOMATIC — nunca silencioso: agenda com uma janela de
  // cancelamento em vez de executar na hora, para o usuário sempre poder
  // ver e cancelar antes de qualquer efeito colateral acontecer.
  await executeRecommendation(ctx, recommendationId, {
    triggeredBy: "AUTOPILOT",
    schedule: { mode: "later", runAt: new Date(Date.now() + SEMI_AUTOMATIC_DELAY_MS) },
  });
}
