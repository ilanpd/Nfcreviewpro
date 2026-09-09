import "server-only";
import { prisma } from "@/lib/prisma";
import { hashIp, getRequestIp } from "@/lib/ip";
import { Prisma } from "@/generated/prisma/client";
import type { AuditAction } from "@/generated/prisma/client";
import type { AuthContext } from "@/lib/auth";

/**
 * Called from API route handlers, after a mutation already succeeded — not
 * threaded through every service function. Audit logging is a boundary
 * concern (who/when/from where an HTTP request did something), while the
 * service layer stays focused on business rules. See ADR-017.
 *
 * Best-effort: a logging failure must never surface as a failed request for
 * a mutation that already committed — same reasoning as the resolution
 * engine's RedirectLog writes, just on the authenticated side of the app.
 */
export async function recordAudit(
  ctx: AuthContext,
  action: AuditAction,
  options?: { targetId?: string; metadata?: Record<string, unknown> }
) {
  try {
    const ip = await getRequestIp();
    await prisma.auditLog.create({
      data: {
        companyId: ctx.companyId,
        userId: ctx.userId,
        action,
        targetId: options?.targetId ?? null,
        metadata: (options?.metadata as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        ipHash: hashIp(ip),
      },
    });
  } catch (err) {
    console.error("[audit] failed to record", action, err);
  }
}

export function listAuditLogs(companyId: string, limit = 100) {
  return prisma.auditLog.findMany({
    where: { companyId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
