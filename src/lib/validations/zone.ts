import { z } from "zod";

export const createZoneSchema = z.object({
  name: z.string().trim().min(2).max(60),
  branchId: z.string().cuid().nullable().optional(),
});

export const updateZoneSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  branchId: z.string().cuid().nullable().optional(),
});

export type CreateZoneInput = z.infer<typeof createZoneSchema>;
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>;
