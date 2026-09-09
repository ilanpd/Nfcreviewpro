import { z } from "zod";

export const createBranchSchema = z.object({ name: z.string().trim().min(2).max(60) });
export const updateBranchSchema = z.object({ name: z.string().trim().min(2).max(60) });

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
