import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da organização").max(80),
});

export const renameOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da organização").max(80),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type RenameOrganizationInput = z.infer<typeof renameOrganizationSchema>;
