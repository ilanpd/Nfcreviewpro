import { z } from "zod";

const hexColorSchema = z.string().trim().regex(/^#([0-9a-fA-F]{6})$/, "Cor inválida");

export const updateCompanySchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  whatsapp: z
    .string()
    .trim()
    .min(10, "Informe o WhatsApp com DDD")
    .max(20)
    .optional(),
  googleReviewUrl: z.string().trim().url("Informe um link válido do Google").optional(),
  primaryColor: hexColorSchema.optional(),
  // ROI Mode (Fase 7) — os três só fazem sentido juntos, mas são validados
  // e salvos individualmente (o formulário de Configurações permite editar
  // um de cada vez); o Analytics Engine (domain/analytics/roi.ts) é quem
  // decide se "configurado" significa os três presentes.
  roiAvgTicket: z.number().positive().max(1_000_000).nullable().optional(),
  roiReturnRate: z.number().min(0).max(1).nullable().optional(),
  roiNewCustomerValue: z.number().positive().max(1_000_000).nullable().optional(),
  // White Label (Fase 10) — faviconUrl existe na coluna desde a Fase 9
  // (ver ADR-039), mas nunca tinha chegado a um schema de validação nem a
  // um formulário; corrigido aqui junto com os campos novos desta fase.
  faviconUrl: z.string().trim().url().optional().or(z.literal("")),
  secondaryColor: hexColorSchema.nullable().optional(),
  loginHeadline: z.string().trim().max(120).optional().or(z.literal("")),
  loginBackgroundUrl: z.string().trim().url().optional().or(z.literal("")),
});

const HOSTNAME_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

export const claimDomainSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(HOSTNAME_REGEX, "Informe um domínio válido, ex.: app.suaempresa.com"),
});

export type ClaimDomainInput = z.infer<typeof claimDomainSchema>;

export const onboardingSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa").max(80),
  whatsapp: z.string().trim().min(10, "Informe o WhatsApp com DDD").max(20),
  googleReviewUrl: z.string().trim().url("Informe um link válido do Google"),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{6})$/, "Cor inválida")
    .default("#0F172A"),
});

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
