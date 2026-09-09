import { z } from "zod";

// Scheduler Inteligente (Fase 11) — "executar agora/depois/repetir/pausar".
export const applyRecommendationSchema = z
  .object({
    mode: z.enum(["now", "later", "repeat"]).default("now"),
    runAt: z.coerce.date().optional(),
    recurrence: z.enum(["DAILY", "WEEKLY"]).optional(),
  })
  .refine((data) => data.mode !== "later" || data.runAt !== undefined, {
    message: "Informe a data/hora de execução",
    path: ["runAt"],
  })
  .refine((data) => data.mode !== "repeat" || data.recurrence !== undefined, {
    message: "Informe a recorrência",
    path: ["recurrence"],
  });

export type ApplyRecommendationInput = z.infer<typeof applyRecommendationSchema>;

export const setAutoPilotLevelSchema = z.object({
  level: z.enum(["MANUAL", "RECOMMENDED", "SEMI_AUTOMATIC", "AUTOMATIC"]),
});
