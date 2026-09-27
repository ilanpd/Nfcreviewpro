import "server-only";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth";
import type { CreateSupportRequestInput } from "@/lib/validations/support";
import type { SupportRequestStatus } from "@/generated/prisma/client";

/**
 * Central de Suporte (Fase 20) — até aqui não existia nenhum jeito do dono
 * de uma empresa cliente falar com a NFC OS a partir do próprio Dashboard;
 * só o caminho contrário existia (Central do Cliente do Admin, Fase 19.7,
 * olhando PARA a empresa). Model deliberadamente simples (sem thread, sem
 * SLA, sem prioridade) — a mesma decisão já tomada para `PrivateFeedback`
 * na Fase 19.7: uma fila de tickets completa é um projeto à parte.
 */
export function createSupportRequest(companyId: string, userId: string, input: CreateSupportRequestInput) {
  return prisma.supportRequest.create({
    data: { companyId, userId, subject: input.subject, message: input.message },
  });
}

export function listSupportRequestsForCompany(companyId: string) {
  return prisma.supportRequest.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });
}

export async function setSupportRequestStatus(id: string, status: SupportRequestStatus) {
  const request = await prisma.supportRequest.findUnique({ where: { id } });
  if (!request) throw new ForbiddenError("Chamado não encontrado");
  return prisma.supportRequest.update({
    where: { id },
    data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null },
  });
}

/** Usado pelo Radar de Atenção do Admin (`domain/admin/attention-radar.ts`)
 * — chamados abertos há muito tempo sem resposta viram um alerta, não ficam
 * só sentados numa tabela que ninguém olha. */
export function listStuckSupportRequests(olderThan: Date) {
  return prisma.supportRequest.findMany({
    where: { status: { not: "RESOLVED" }, createdAt: { lte: olderThan } },
    orderBy: { createdAt: "asc" },
    include: { company: { select: { name: true } } },
  });
}
