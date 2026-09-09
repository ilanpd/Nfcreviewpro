import "server-only";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { publishEvent } from "@/lib/event-bus";
import { setChaosFlag } from "@/lib/chaos/flags";
import { buildSyntheticAuthContext } from "@/lib/api-v1/auth";
import { evaluatePlaybooksForCompany } from "./playbook-engine.service";
import { setAutoPilotLevel } from "./automation-engine.service";
import type { ScenarioId, ScenarioRunResult, ScenarioStepResult } from "@/domain/demo/types";
import { SCENARIO_CATALOG } from "@/domain/demo/types";

/**
 * Scenario Engine (Fase 12) — cada cenário é uma sequência de AÇÕES REAIS
 * contra os mesmos motores do produto: cria `RedirectLog`/`Visit`/
 * `RatingEvent` de verdade (o que a Live Mode SSE, o Heatmap e o Analytics
 * já leem hoje), publica eventos reais no Event Bus, e chama o Playbook/
 * AutoPilot Engine de verdade — nunca escreve num estado de UI paralelo.
 * Zero Fake Demo: se um cenário "mostra" algo, é porque uma linha real foi
 * criada ou uma função de serviço real foi chamada, nunca o contrário. Ver
 * ADR-053.
 */

async function simulateTap(companyId: string, card: { id: string; uniqueCode: string; zoneId: string | null }, at: Date, opts: { conversionChance: number; highStarChance: number }) {
  await publishEvent("NFCTocado", { cardId: card.id, uniqueCode: card.uniqueCode }, { companyId });
  await prisma.redirectLog.create({
    data: { companyId, cardId: card.id, campaignId: null, outcome: "REVIEW_FLOW_FALLBACK", resolvedFromCache: Math.random() > 0.4, createdAt: at },
  });
  await publishEvent(
    "RedirecionamentoResolvido",
    { cardId: card.id, campaignId: null, variantId: null, outcome: "REVIEW_FLOW_FALLBACK", resolvedFromCache: false },
    { companyId }
  );

  if (Math.random() >= opts.conversionChance) return;

  const visit = await prisma.visit.create({
    data: { cardId: card.id, companyId, device: "mobile", ipHash: `scenario-${card.id}-${at.getTime()}`, createdAt: at },
  });
  const stars = Math.random() < opts.highStarChance ? 5 : 3;
  const ratingEvent = await prisma.ratingEvent.create({
    data: { visitId: visit.id, companyId, cardId: card.id, stars, redirectedGoogle: stars >= 4, createdAt: at },
  });
  if (stars >= 4) {
    await publishEvent("AvaliacaoPublicada", { ratingEventId: ratingEvent.id, cardId: card.id, stars }, { companyId });
  }
}

async function runHappyHour(companyId: string): Promise<ScenarioStepResult[]> {
  const steps: ScenarioStepResult[] = [];
  const varanda = await prisma.zone.findFirst({ where: { companyId, name: "Varanda" } });
  const cards = await prisma.nFCCard.findMany({ where: { companyId, zoneId: varanda?.id }, select: { id: true, uniqueCode: true, zoneId: true }, take: 16 });
  steps.push({ id: "start", narration: "A Varanda começa a receber toques reais.", detail: `${cards.length} mesas na zona` });

  const now = Date.now();
  await Promise.all(cards.map((card) => simulateTap(companyId, card, new Date(now), { conversionChance: 0.75, highStarChance: 0.85 })));
  steps.push({ id: "taps", narration: "Toques e avaliações reais chegaram na Varanda, agora.", detail: `${cards.length} toques publicados no Event Bus` });

  const created = await evaluatePlaybooksForCompany(companyId);
  steps.push({
    id: "playbook",
    narration: created > 0 ? "O Playbook Engine percebeu o padrão e gerou uma recomendação real." : "O Playbook Engine avaliou os dados — sem recomendação nova desta vez.",
    detail: `${created} recomendação(ões) criada(s)`,
  });

  return steps;
}

async function runRestauranteLotado(companyId: string): Promise<ScenarioStepResult[]> {
  const cards = await prisma.nFCCard.findMany({ where: { companyId }, select: { id: true, uniqueCode: true, zoneId: true }, take: 40 });
  const now = Date.now();
  await Promise.all(cards.map((card) => simulateTap(companyId, card, new Date(now), { conversionChance: 0.3, highStarChance: 0.6 })));
  return [
    { id: "burst", narration: "O salão inteiro ganhou vida ao mesmo tempo.", detail: `${cards.length} mesas tocadas agora` },
    { id: "kpis", narration: "KPIs, Heatmap e o Feed de Eventos reagem em tempo real.", detail: "Nenhum dado fabricado — tudo veio do RedirectLog/RatingEvent reais" },
  ];
}

async function runAvaliacoesDisparando(companyId: string): Promise<ScenarioStepResult[]> {
  const cards = await prisma.nFCCard.findMany({ where: { companyId }, select: { id: true, uniqueCode: true, zoneId: true }, take: 20 });
  const now = Date.now();
  let count = 0;
  for (const card of cards) {
    const visit = await prisma.visit.create({ data: { cardId: card.id, companyId, device: "mobile", ipHash: `scenario-review-${card.id}-${now}`, createdAt: new Date() } });
    const ratingEvent = await prisma.ratingEvent.create({ data: { visitId: visit.id, companyId, cardId: card.id, stars: 5, redirectedGoogle: true, createdAt: new Date() } });
    await publishEvent("AvaliacaoPublicada", { ratingEventId: ratingEvent.id, cardId: card.id, stars: 5 }, { companyId });
    count += 1;
  }
  return [{ id: "reviews", narration: "Uma onda real de avaliações 5 estrelas chegou.", detail: `${count} avaliações publicadas` }];
}

async function runZonaSilenciosa(companyId: string): Promise<ScenarioStepResult[]> {
  const created = await evaluatePlaybooksForCompany(companyId);
  return [
    {
      id: "evaluate",
      narration: created > 0 ? "Uma zona/mesa real silenciosa foi encontrada e recomendada." : "Nenhuma zona/mesa está silenciosa além do padrão agora.",
      detail: `${created} recomendação(ões) criada(s) pela varredura`,
    },
  ];
}

async function runFalhaRedis(): Promise<ScenarioStepResult[]> {
  await setChaosFlag("redisDown", true);
  return [{ id: "chaos-on", narration: "O Chaos Mode desligou o Redis de verdade — o cache cai, o Postgres assume.", detail: "Flag redisDown ativa por até 30 minutos (ou até ser desligada)" }];
}

async function runAutopilotTrabalhando(companyId: string): Promise<ScenarioStepResult[]> {
  const ctx = await buildSyntheticAuthContext(companyId);
  await setAutoPilotLevel(ctx, "AUTOMATIC");

  const steps = await runHappyHour(companyId);
  const autoExecutions = await prisma.playbookExecution.count({ where: { companyId, triggeredBy: "AUTOPILOT" } });

  steps.push({
    id: "autopilot",
    narration: autoExecutions > 0 ? "O AutoPilot aplicou uma recomendação sozinho — com log completo e Desfazer disponível." : "O AutoPilot está ligado, mas nenhuma recomendação passou da confiança mínima ainda.",
    detail: `${autoExecutions} execução(ões) automática(s) registrada(s) no total`,
  });
  return steps;
}

const LAST_SCENARIO_KEY = "demo:last-scenario:v1";

/** Dev Command Center v2 (Fase 12) — "cenário atual" lê isto. Best-effort:
 * sem Redis configurado, o widget simplesmente mostra "nenhum" — nunca
 * bloqueia um cenário de rodar por causa de um registro que falhou. */
export async function getLastScenario(): Promise<{ scenarioId: ScenarioId; at: string } | null> {
  if (!redis) return null;
  try {
    return await redis.get<{ scenarioId: ScenarioId; at: string }>(LAST_SCENARIO_KEY);
  } catch {
    return null;
  }
}

async function recordLastScenario(scenarioId: ScenarioId): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(LAST_SCENARIO_KEY, { scenarioId, at: new Date().toISOString() }, { ex: 60 * 60 });
  } catch {
    // observabilidade best-effort — nunca impede o cenário de rodar
  }
}

export async function runScenario(companyId: string, scenarioId: ScenarioId): Promise<ScenarioRunResult> {
  const startedAt = new Date().toISOString();
  await recordLastScenario(scenarioId);
  let steps: ScenarioStepResult[];

  switch (scenarioId) {
    case "happy-hour":
      steps = await runHappyHour(companyId);
      break;
    case "restaurante-lotado":
      steps = await runRestauranteLotado(companyId);
      break;
    case "avaliacoes-disparando":
      steps = await runAvaliacoesDisparando(companyId);
      break;
    case "zona-silenciosa":
      steps = await runZonaSilenciosa(companyId);
      break;
    case "falha-redis":
      steps = await runFalhaRedis();
      break;
    case "autopilot-trabalhando":
      steps = await runAutopilotTrabalhando(companyId);
      break;
    case "franquia":
      steps = [{ id: "info", narration: "Use o seletor de marca no topo do Demo OS para trocar entre empresas ao vivo.", detail: "Nenhuma ação de servidor necessária — troca client-side via BrandProvider" }];
      break;
  }

  return { scenarioId, steps, startedAt, finishedAt: new Date().toISOString() };
}

export function listScenarios() {
  return SCENARIO_CATALOG;
}
