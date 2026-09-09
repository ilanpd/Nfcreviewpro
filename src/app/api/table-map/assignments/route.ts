import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { listAssignmentsForStatus } from "@/services/table-map.service";
import { handleApiError } from "@/lib/api-error";

/**
 * Refresh leve para sincronização entre abas: quando o Live Mode recebe um
 * evento `ASSIGNMENT_CHANGED` (de outra aba, outro gerente, ou outro
 * dispositivo), o cliente chama esta rota para atualizar seu estado local em
 * vez de recarregar a página inteira. Reaproveita a mesma consulta que a
 * carga inicial do Mapa de Mesas já usa — nenhuma lógica nova.
 */
export async function GET() {
  try {
    const ctx = await requireAuthContext();
    const assignments = await listAssignmentsForStatus(ctx.companyId, ctx.organizationId);
    return NextResponse.json({ assignments });
  } catch (error) {
    return handleApiError(error);
  }
}
