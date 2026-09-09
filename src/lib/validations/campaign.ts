import { z } from "zod";
import type { CampaignType } from "@/generated/prisma/client";
import { DESTINATION_META } from "@/domain/campaign/destination";

// Campaign.config is stored as untyped Json in the database — these schemas
// are the runtime safety net between a hand-edited/seeded row (or the
// dashboard's own write path) and both renderers that read it back:
// lib/campaign-destination.ts (engine redirect + Builder preview).

export const urlRedirectConfigSchema = z.object({
  url: z.string().url(),
});

export const whatsappConfigSchema = z.object({
  phone: z.string().min(8),
  message: z.string().optional(),
});

// COUPON/AI_MENU have no defined shape yet (rendering is deferred — see
// domain/campaign/destination.ts) — accept any object so the Builder can at
// least save a placeholder without the schema fighting an undesigned feature.
const unimplementedConfigSchema = z.record(z.string(), z.unknown()).default({});

export type UrlRedirectConfig = z.infer<typeof urlRedirectConfigSchema>;
export type WhatsappCampaignConfig = z.infer<typeof whatsappConfigSchema>;

export function configSchemaForType(type: CampaignType) {
  const group = DESTINATION_META[type].renderGroup;
  if (group === "url") return urlRedirectConfigSchema;
  if (group === "whatsapp") return whatsappConfigSchema;
  return unimplementedConfigSchema;
}

const recurrenceConfigSchema = z
  .object({
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  })
  .optional()
  .nullable();

const campaignBaseSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  type: z.custom<CampaignType>((v) => typeof v === "string" && v in DESTINATION_META && v !== "REVIEW_FLOW", {
    message: "Tipo de campanha inválido",
  }),
  priority: z.number().int().min(0).max(100).default(0),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
  recurrenceType: z.enum(["NONE", "DAILY", "WEEKLY"]).default("NONE"),
  recurrenceConfig: recurrenceConfigSchema,
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  ownerId: z.string().cuid().optional().nullable(),
  config: z.record(z.string(), z.unknown()),
  // ROI Mode (Fase 7) — opcional, auto-declarado pelo empresário (não existe
  // integração de gasto de anúncio). Sem isso, "ROI da campanha" e "custo
  // por avaliação" ficam honestamente como "não configurado" em vez de um
  // número inventado — ver domain/analytics/roi.ts.
  estimatedCost: z.number().positive().max(1_000_000).optional().nullable(),
});

export const createCampaignSchema = campaignBaseSchema
  .refine((data) => !data.startsAt || !data.endsAt || data.startsAt < data.endsAt, {
    message: "A data de início deve ser anterior à data de término",
    path: ["endsAt"],
  })
  .refine((data) => configSchemaForType(data.type).safeParse(data.config).success, {
    message: "Configuração de destino inválida para o tipo escolhido",
    path: ["config"],
  });

export const updateCampaignSchema = campaignBaseSchema
  .partial()
  .extend({ status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).optional() })
  .refine((data) => !data.startsAt || !data.endsAt || data.startsAt < data.endsAt, {
    message: "A data de início deve ser anterior à data de término",
    path: ["endsAt"],
  })
  .refine((data) => data.type === undefined || data.config === undefined || configSchemaForType(data.type).safeParse(data.config).success, {
    message: "Configuração de destino inválida para o tipo escolhido",
    path: ["config"],
  });

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

export const assignCampaignSchema = z
  .object({
    scope: z.enum(["ORGANIZATION", "COMPANY", "BRANCH", "ZONE", "CARD"]),
    organizationId: z.string().cuid().optional().nullable(),
    branchId: z.string().cuid().optional().nullable(),
    zoneId: z.string().cuid().optional().nullable(),
    cardId: z.string().cuid().optional().nullable(),
  })
  .refine(
    (data) => {
      const setCount = [data.organizationId, data.branchId, data.zoneId, data.cardId].filter((v) => v != null).length;
      if (data.scope === "ORGANIZATION") return setCount === 1 && data.organizationId != null;
      if (data.scope === "COMPANY") return setCount === 0;
      if (data.scope === "BRANCH") return setCount === 1 && data.branchId != null;
      if (data.scope === "ZONE") return setCount === 1 && data.zoneId != null;
      return setCount === 1 && data.cardId != null;
    },
    { message: "O alvo informado não corresponde ao escopo escolhido" }
  );

export type AssignCampaignInput = z.infer<typeof assignCampaignSchema>;

export const bulkAssignCampaignSchema = z.object({
  cardIds: z.array(z.string().cuid()).min(1).max(500),
});

export type BulkAssignCampaignInput = z.infer<typeof bulkAssignCampaignSchema>;

// Ghost Mode Evolution (Fase 6) — desfaz exatamente o lote de atribuições que
// um bulkAssignCampaignToCards acabou de criar, pelos IDs devolvidos por ele.
export const undoBulkAssignmentSchema = z.object({
  assignmentIds: z.array(z.string().cuid()).min(1).max(500),
});

export type UndoBulkAssignmentInput = z.infer<typeof undoBulkAssignmentSchema>;
