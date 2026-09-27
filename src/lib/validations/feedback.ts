import { z } from "zod";

/**
 * "Falar com a gente" (ADR-080). A mensagem se liga a UMA origem: a nota (links
 * antigos, por 90 dias), a visita (o caminho normal, sem pergunta de nota) ou só
 * o cartão (quando a visita não pôde ser registrada, por exemplo sem internet no
 * primeiro toque). Exatamente uma das três.
 */
export const createFeedbackSchema = z
  .object({
    ratingEventId: z.string().cuid().optional(),
    visitId: z.string().cuid().optional(),
    cardCode: z.string().trim().min(4).max(32).optional(),
    name: z.string().trim().max(80).optional().or(z.literal("")),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    message: z.string().trim().min(3, "Conte um pouco mais para nos ajudar a melhorar").max(1000),
  })
  .refine((v) => [v.ratingEventId, v.visitId, v.cardCode].filter(Boolean).length === 1, {
    message: "Informe a origem da mensagem (visita, cartão ou avaliação), uma só",
  });

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
