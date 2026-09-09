import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * API Pública v1 (Fase 9) — alimenta o painel "Logs" do Dashboard de
 * Desenvolvedor com chamadas reais (latência, status, endpoint). Chamado só
 * de dentro de `after()` pelo wrapper `withApiV1` — nunca no caminho crítico
 * da resposta ao cliente da API. Best-effort: uma falha aqui nunca deveria
 * derrubar nem atrasar uma chamada de API real.
 */
export async function recordApiRequest(entry: {
  companyId: string;
  apiKeyId: string | null;
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
}): Promise<void> {
  try {
    await prisma.apiRequestLog.create({ data: entry });
  } catch (err) {
    console.error("[api-v1] falha ao registrar log de requisição", err);
  }
}
