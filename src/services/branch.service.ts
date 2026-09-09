import "server-only";
import * as branchRepo from "@/repositories/branch.repository";
import { ForbiddenError } from "@/lib/auth";
import { invalidateCompanyCampaigns } from "@/lib/resolution-engine/cache";

export function listBranches(companyId: string) {
  return branchRepo.findBranches(companyId);
}

export function createBranch(companyId: string, name: string) {
  return branchRepo.createBranch(companyId, name);
}

export async function getBranch(companyId: string, branchId: string) {
  const branch = await branchRepo.findBranchById(companyId, branchId);
  if (!branch) throw new ForbiddenError("Unidade não encontrada nesta empresa");
  return branch;
}

// Rename — mesma paridade de CRUD explicada em zone.service.ts's updateZone.
export async function updateBranch(companyId: string, branchId: string, name: string) {
  const branch = await branchRepo.findBranchById(companyId, branchId);
  if (!branch) throw new ForbiddenError("Unidade não encontrada nesta empresa");
  return branchRepo.updateBranch(branchId, { name });
}

// Deleting a Branch cascades onto any CampaignAssignment targeting it (see
// schema), which can change resolution behavior for every card in it — must
// invalidate the campaigns cache, not just the more obvious card/company one.
export async function deleteBranch(companyId: string, branchId: string) {
  const branch = await branchRepo.findBranchById(companyId, branchId);
  if (!branch) throw new ForbiddenError("Unidade não encontrada nesta empresa");
  await branchRepo.deleteBranch(companyId, branchId);
  await invalidateCompanyCampaigns(companyId);
}
