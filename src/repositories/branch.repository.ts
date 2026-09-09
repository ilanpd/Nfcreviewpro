import "server-only";
import { prisma } from "@/lib/prisma";

export function findBranches(companyId: string) {
  return prisma.branch.findMany({ where: { companyId }, orderBy: { name: "asc" } });
}

export function createBranch(companyId: string, name: string) {
  return prisma.branch.create({ data: { companyId, name } });
}

export function findBranchById(companyId: string, branchId: string) {
  return prisma.branch.findFirst({ where: { id: branchId, companyId } });
}

export function updateBranch(branchId: string, data: { name: string }) {
  return prisma.branch.update({ where: { id: branchId }, data });
}

export function deleteBranch(companyId: string, branchId: string) {
  return prisma.branch.deleteMany({ where: { id: branchId, companyId } });
}
