import { z } from "zod";

export const createFeedbackSchema = z.object({
  ratingEventId: z.string().cuid(),
  name: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  message: z.string().trim().min(3, "Conte um pouco mais para nos ajudar a melhorar").max(1000),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
