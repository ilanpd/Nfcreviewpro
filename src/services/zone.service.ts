import "server-only";
import { prisma } from "@/lib/prisma";
import * as zoneRepo from "@/repositories/zone.repository";
import { ForbiddenError } from "@/lib/auth";
import { invalidateCompanyCampaigns } from "@/lib/resolution-engine/cache";
// updateZone abaixo NÃO invalida cache: nome/branchId de Zone são metadados
// de exibição/agrupamento — a engine de resolução casa CampaignAssignment
// de escopo ZONE/BRANCH diretamente contra NFCCard.zoneId/branchId, nunca
// através de Zone.branchId (ver o comentário do schema em NFCCard). Só
// deleteZone precisa invalidar, porque remover a zona pode invalidar
// atribuições que a referenciavam (cascade no schema).

export function listZones(companyId: string) {
  return zoneRepo.findZones(companyId);
}

export function createZone(companyId: string, name: string, branchId?: string | null) {
  return zoneRepo.createZone(companyId, name, branchId);
}

export async function getZone(companyId: string, zoneId: string) {
  const zone = await zoneRepo.findZoneById(companyId, zoneId);
  if (!zone) throw new ForbiddenError("Zona não encontrada nesta empresa");
  return zone;
}

// Rename (e opcionalmente trocar de unidade) — a mesma capacidade que
// Branch/Zone sempre deveriam ter tido para paridade de CRUD com Card/
// Campaign; nunca exposta no dashboard interno até a API pública v1 (Fase
// 9) tornar essa lacuna óbvia (nenhum verbo deveria ter uma exceção
// arbitrária — ver Platform First Review em RELATORIO_FASE_9.md).
export async function updateZone(companyId: string, zoneId: string, input: { name?: string; branchId?: string | null }) {
  const zone = await zoneRepo.findZoneById(companyId, zoneId);
  if (!zone) throw new ForbiddenError("Zona não encontrada nesta empresa");

  if (input.branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: input.branchId, companyId } });
    if (!branch) throw new ForbiddenError("Unidade não encontrada nesta empresa");
  }

  return zoneRepo.updateZone(zoneId, input);
}

// Same reasoning as branch.service.ts's deleteBranch — deleting a Zone
// cascades onto any CampaignAssignment targeting it.
export async function deleteZone(companyId: string, zoneId: string) {
  const zone = await zoneRepo.findZoneById(companyId, zoneId);
  if (!zone) throw new ForbiddenError("Zona não encontrada nesta empresa");
  await zoneRepo.deleteZone(companyId, zoneId);
  await invalidateCompanyCampaigns(companyId);
}
