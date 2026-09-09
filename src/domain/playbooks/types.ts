import type { PlaybookActionType, PlaybookCategory, PlaybookTriggerType, TargetScope } from "@/generated/prisma/client";

/**
 * Smart Campaign Playbooks (Fase 11) — tipos puros compartilhados por
 * `confidence-engine.ts`, `impact.ts` e `triggers.ts`. Nenhum arquivo deste
 * diretório importa Prisma — a leitura de dados vive em
 * `services/playbook-engine.service.ts`, que monta estes objetos a partir de
 * consultas reais antes de chamar as funções puras daqui. Mesma separação já
 * estabelecida entre `domain/analytics/insights.ts` (puro) e
 * `services/insights-engine.service.ts` (Prisma).
 */

export interface ConfidenceFactor {
  label: string;
  /** 0..1, já normalizado — o que o Explainability Panel mostra como barra. */
  value: number;
  /** 0..1, soma de todos os fatores de um resultado = 1. */
  weight: number;
}

export interface ConfidenceResult {
  score: number; // 0..1
  level: "baixa" | "média" | "alta";
  factors: ConfidenceFactor[];
}

export interface EstimatedImpact {
  label: string;
  expectedTouchesDelta: number;
  expectedConversionsDelta: number;
  /** `null` quando a empresa não configurou ROI Mode (Fase 7) — nunca um
   * valor inventado, ver domain/analytics/roi.ts. */
  expectedRevenue: number | null;
  revenueConfigured: boolean;
}

export type TriggerEvidenceValue = number | string | boolean | null;

/** Dados brutos usados pelo gatilho — sempre números/rótulos reais, nunca uma
 * frase solta. É isto que o botão "Ver motivo" exibe como "dados usados". */
export type TriggerEvidence = Record<string, TriggerEvidenceValue>;

export interface TriggerFireResult {
  headline: string;
  scopeType: TargetScope;
  scopeId: string | null;
  scopeName: string;
  /** Preenchido só quando o gatilho encontrou uma campanha JÁ EXISTENTE para
   * agir sobre (ex.: Instagram Momentum, Weekend Accelerator) — nunca
   * inventado. O Execution Engine usa isto para BOOST_CAMPAIGN_PRIORITY/
   * PAUSE_CAMPAIGN em vez de precisar re-descobrir a campanha certa. */
  targetCampaignId?: string | null;
  evidence: TriggerEvidence;
  /** Tamanho da amostra observada — alimenta o Confidence Engine. */
  sampleSize: number;
  /** Magnitude do efeito em %, sempre >= 0 — alimenta o Confidence Engine. */
  deltaPercent: number;
  /** Há quantas horas o dado mais recente da evidência é. */
  recencyHours: number;
  /** Projeção honesta do próprio gatilho, baseada na taxa observada — nunca
   * um número fixo por playbook. Vira `EstimatedImpact` em `impact.ts`. */
  projectedTouchesDelta: number;
  projectedConversionsDelta: number;
}

export interface PlaybookDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  category: PlaybookCategory;
  triggerType: PlaybookTriggerType;
  triggerConfig: Record<string, unknown>;
  actionType: PlaybookActionType;
  actionConfig: Record<string, unknown>;
  estimatedDurationHours: number;
  reversalDescription: string;
  safeForAutomation: boolean;
}
