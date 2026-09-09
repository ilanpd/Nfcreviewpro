import "server-only";
import { prisma } from "@/lib/prisma";
import { getReliabilitySnapshot, type ReliabilitySnapshot } from "./reliability.service";
import { getApiUsageSummary } from "./api-request-log.service";
import { getAutoPilotSetting } from "./automation-engine.service";
import { getLastScenario } from "./scenario-engine.service";
import type { AutoPilotLevel } from "@/generated/prisma/client";
import type { ScenarioId } from "@/domain/demo/types";

/**
 * Dev Command Center v2 (Fase 12) — nunca recalcula o que a Fase 8 (Reliability
 * Engine) já resolve; só COMPÕE `getReliabilitySnapshot()` com os três
 * painéis que ainda não tinham um lugar consolidado (webhooks, playbooks/
 * AutoPilot, cenário atual) numa única leitura para a nova tela. Cada
 * sub-leitura já degrada graciosamente sozinha (mesmo princípio do
 * Reliability Engine) — uma falha numa fonte nunca derruba as outras.
 */
export interface WebhookHealthSummary {
  totalEndpoints: number;
  activeEndpoints: number;
  deliveriesLast24h: number;
  successLast24h: number;
  failedLast24h: number;
}

export interface PlaybookAutomationSummary {
  autoPilotLevel: AutoPilotLevel;
  pendingRecommendations: number;
  appliedLast24h: number;
  autoExecutedLast24h: number;
}

export interface CommandCenterSnapshot {
  reliability: ReliabilitySnapshot;
  webhooks: WebhookHealthSummary;
  automation: PlaybookAutomationSummary;
  apiUsage: { requestsLast24h: number; avgLatencyMs: number | null };
  currentScenario: { scenarioId: ScenarioId; at: string } | null;
}

async function getWebhookHealth(companyId: string): Promise<WebhookHealthSummary> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totalEndpoints, activeEndpoints, deliveries] = await Promise.all([
      prisma.webhookEndpoint.count({ where: { companyId } }),
      prisma.webhookEndpoint.count({ where: { companyId, active: true } }),
      prisma.webhookDelivery.groupBy({
        by: ["status"],
        where: { endpoint: { companyId }, createdAt: { gte: since } },
        _count: { status: true },
      }),
    ]);
    const byStatus = Object.fromEntries(deliveries.map((d) => [d.status, d._count.status]));
    return {
      totalEndpoints,
      activeEndpoints,
      deliveriesLast24h: deliveries.reduce((sum, d) => sum + d._count.status, 0),
      successLast24h: byStatus.SUCCESS ?? 0,
      failedLast24h: byStatus.FAILED ?? 0,
    };
  } catch {
    return { totalEndpoints: 0, activeEndpoints: 0, deliveriesLast24h: 0, successLast24h: 0, failedLast24h: 0 };
  }
}

async function getPlaybookAutomationSummary(companyId: string): Promise<PlaybookAutomationSummary> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [level, pending, applied, autoExecuted] = await Promise.all([
      getAutoPilotSetting(companyId),
      prisma.playbookRecommendation.count({ where: { companyId, status: "PENDING" } }),
      prisma.playbookRecommendation.count({ where: { companyId, status: "APPLIED", respondedAt: { gte: since } } }),
      prisma.playbookExecution.count({ where: { companyId, triggeredBy: "AUTOPILOT", createdAt: { gte: since } } }),
    ]);
    return { autoPilotLevel: level, pendingRecommendations: pending, appliedLast24h: applied, autoExecutedLast24h: autoExecuted };
  } catch {
    return { autoPilotLevel: "MANUAL", pendingRecommendations: 0, appliedLast24h: 0, autoExecutedLast24h: 0 };
  }
}

export async function getCommandCenterSnapshot(companyId: string): Promise<CommandCenterSnapshot> {
  const [reliability, webhooks, automation, apiUsage, currentScenario] = await Promise.all([
    getReliabilitySnapshot(),
    getWebhookHealth(companyId),
    getPlaybookAutomationSummary(companyId),
    getApiUsageSummary(companyId).catch(() => ({ requestsLast24h: 0, avgLatencyMs: null })),
    getLastScenario(),
  ]);

  return { reliability, webhooks, automation, apiUsage, currentScenario };
}
