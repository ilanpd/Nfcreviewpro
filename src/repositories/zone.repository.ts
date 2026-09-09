import "server-only";
import { prisma } from "@/lib/prisma";

export function findZones(companyId: string) {
  return prisma.zone.findMany({
    where: { companyId },
    include: { branch: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
}

export function createZone(companyId: string, name: string, branchId?: string | null) {
  return prisma.zone.create({ data: { companyId, name, branchId: branchId ?? null } });
}

export function findZoneById(companyId: string, zoneId: string) {
  return prisma.zone.findFirst({ where: { id: zoneId, companyId } });
}

export function updateZone(zoneId: string, data: { name?: string; branchId?: string | null }) {
  return prisma.zone.update({ where: { id: zoneId }, data });
}

export function deleteZone(companyId: string, zoneId: string) {
  return prisma.zone.deleteMany({ where: { id: zoneId, companyId } });
}
