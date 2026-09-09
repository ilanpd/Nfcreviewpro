import { z } from "zod";

// OWNER is deliberately excluded — the only path to it is creating the
// company (see company.service.ts's createCompanyForNewUser). Must match
// domain/rbac/roles.ts's ASSIGNABLE_ROLES.
const assignableRole = z.enum(["ADMIN", "MARKETING", "MANAGER", "OPERATOR", "READ_ONLY"]);

export const inviteMemberSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  name: z.string().trim().max(80).optional(),
  role: assignableRole,
});

export const updateMemberSchema = z.object({
  role: assignableRole,
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

// Exactly one of {branchId, zoneId} — matches UserAccessScope's own
// application-layer invariant (domain/rbac/scope.ts).
export const createAccessScopeSchema = z
  .object({
    branchId: z.string().cuid().optional(),
    zoneId: z.string().cuid().optional(),
  })
  .refine((data) => (data.branchId != null ? 1 : 0) + (data.zoneId != null ? 1 : 0) === 1, {
    message: "Informe exatamente uma unidade ou zona",
  });

export type CreateAccessScopeInput = z.infer<typeof createAccessScopeSchema>;
