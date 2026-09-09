import "server-only";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth";
import { generateApiKey } from "@/lib/api-v1/auth";
import { isApiScope, type ApiScope } from "@/domain/api-v1/scopes";

/**
 * API Pública v1 (Fase 9) — CRUD de `ApiKey`, usado pelo Dashboard de
 * Desenvolvedor (`/dashboard/developers`). Nunca devolve `keyHash`; o valor
 * completo da chave (`fullKey`) só existe no retorno de `createApiKey` —
 * a partir daí é irrecuperável por design (nem este produto consegue
 * reconstruí-lo a partir do hash), então a UI precisa deixar isso claro.
 */
export function listApiKeys(companyId: string) {
  return prisma.apiKey.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
}

function assertValidScopes(scopes: string[]): asserts scopes is ApiScope[] {
  const invalid = scopes.filter((s) => !isApiScope(s));
  if (invalid.length > 0) throw new ForbiddenError(`Escopo(s) inválido(s): ${invalid.join(", ")}`);
}

export async function createApiKey(
  companyId: string,
  createdByUserId: string,
  input: { name: string; scopes: string[]; expiresAt?: Date | null }
) {
  assertValidScopes(input.scopes);
  if (input.scopes.length === 0) throw new ForbiddenError("Selecione ao menos um escopo para a chave");

  const { fullKey, keyPrefix, keyHash } = generateApiKey();
  const apiKey = await prisma.apiKey.create({
    data: {
      companyId,
      createdByUserId,
      name: input.name,
      keyPrefix,
      keyHash,
      scopes: input.scopes,
      expiresAt: input.expiresAt ?? null,
    },
  });

  // A única vez que o valor completo existe fora do processo de geração —
  // devolvido ao chamador (a rota), nunca persistido, nunca logado.
  return { apiKey, fullKey };
}

export async function revokeApiKey(companyId: string, apiKeyId: string) {
  const apiKey = await prisma.apiKey.findFirst({ where: { id: apiKeyId, companyId } });
  if (!apiKey) throw new ForbiddenError("Chave de API não encontrada nesta empresa");
  if (apiKey.revokedAt) return apiKey; // já revogada — idempotente, não é um erro
  return prisma.apiKey.update({ where: { id: apiKeyId }, data: { revokedAt: new Date() } });
}
