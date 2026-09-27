import { z } from "zod";

export const createSupportRequestSchema = z.object({
  subject: z.string().trim().min(3, "Descreva o assunto em poucas palavras").max(120),
  message: z.string().trim().min(10, "Conte com mais detalhes o que está acontecendo").max(4000),
});

export type CreateSupportRequestInput = z.infer<typeof createSupportRequestSchema>;
