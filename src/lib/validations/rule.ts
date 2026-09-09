import { z } from "zod";
import type { RuleType } from "@/generated/prisma/client";

const timeString = z.string().regex(/^\d{1,2}:\d{2}$/, "Use o formato HH:mm");
const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD");

export const dayOfWeekRuleConfigSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1, "Selecione ao menos um dia"),
});

export const timeWindowRuleConfigSchema = z.object({
  startTime: timeString,
  endTime: timeString,
});

export const dateRangeRuleConfigSchema = z
  .object({
    startDate: isoDateString,
    endDate: isoDateString,
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "A data de início deve ser anterior ou igual à data de término",
    path: ["endDate"],
  });

export const deviceTypeRuleConfigSchema = z.object({
  devices: z.array(z.enum(["mobile", "tablet", "desktop"])).min(1, "Selecione ao menos um dispositivo"),
});

export function ruleConfigSchemaFor(type: RuleType) {
  switch (type) {
    case "DAY_OF_WEEK":
      return dayOfWeekRuleConfigSchema;
    case "TIME_WINDOW":
      return timeWindowRuleConfigSchema;
    case "DATE_RANGE":
      return dateRangeRuleConfigSchema;
    case "DEVICE_TYPE":
      return deviceTypeRuleConfigSchema;
  }
}

export const createRuleSchema = z
  .object({
    type: z.enum(["DAY_OF_WEEK", "TIME_WINDOW", "DATE_RANGE", "DEVICE_TYPE"]),
    config: z.record(z.string(), z.unknown()),
  })
  .refine((data) => ruleConfigSchemaFor(data.type).safeParse(data.config).success, {
    message: "Configuração inválida para o tipo de regra escolhido",
    path: ["config"],
  });

export type CreateRuleInput = z.infer<typeof createRuleSchema>;

export const createVariantSchema = z.object({
  name: z.string().trim().min(1, "Nome muito curto").max(40),
  weight: z.number().int().min(1).max(1000),
  config: z.record(z.string(), z.unknown()),
});

export type CreateVariantInput = z.infer<typeof createVariantSchema>;
