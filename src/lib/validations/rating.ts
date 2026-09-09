import { z } from "zod";

export const createVisitSchema = z.object({
  code: z.string().trim().min(1).max(32),
});

export const createRatingSchema = z.object({
  visitId: z.string().cuid(),
  stars: z.number().int().min(1).max(5),
});

export type CreateVisitInput = z.infer<typeof createVisitSchema>;
export type CreateRatingInput = z.infer<typeof createRatingSchema>;
