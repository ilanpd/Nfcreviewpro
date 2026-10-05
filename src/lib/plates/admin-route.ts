import { NextResponse } from "next/server";
import { ForbiddenError } from "@/lib/auth";
import { getSuperAdminEmail, isSuperAdmin } from "@/lib/super-admin";

/**
 * Estoque de placas (ADR-092) — portão de todas as rotas `/api/admin/plates/*`.
 * Só o super-admin (a allowlist `SUPER_ADMIN_EMAILS`) mexe em estoque; devolve o
 * e-mail de quem está agindo para a trilha de auditoria de cada placa.
 */
export async function requirePlateAdmin(): Promise<string> {
  if (!(await isSuperAdmin())) throw new ForbiddenError("Não autorizado");
  return getSuperAdminEmail();
}

/** Resposta de arquivo para download, sem cache (estoque muda toda hora). */
export function fileResponse(bytes: Uint8Array | Buffer | string, filename: string, contentType: string): NextResponse {
  const body = typeof bytes === "string" ? bytes : new Uint8Array(bytes);
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
