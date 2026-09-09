import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { after } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AuthContext } from "@/lib/auth";
import { ApiV1Error } from "./errors";
import { API_SCOPES, type ApiScope } from "@/domain/api-v1/scopes";

/**
 * API Pública v1 (Fase 9) — autenticação por chave de API, nunca por sessão
 * Clerk. Uma `ApiKey` representa a empresa inteira (servidor-a-servidor),
 * não um usuário — por isso o contexto que ela produz é deliberadamente
 * mais estreito que `AuthContext` (`lib/auth.ts`): sem `role`, sem
 * `accessScopes` de restrição por unidade/zona, só `scopes` de capacidade.
 * Ver ADR-036.
 */
const KEY_PREFIX = "nfc_live_";
const PREFIX_VISIBLE_CHARS = 12;

export function hashApiKey(fullKey: string): string {
  return createHash("sha256").update(fullKey).digest("hex");
}

/** Gera uma chave nova — o valor completo (`fullKey`) só existe aqui e na
 * resposta HTTP da criação; nunca é persistido nem logado. */
export function generateApiKey(): { fullKey: string; keyPrefix: string; keyHash: string } {
  const secret = randomBytes(24).toString("base64url");
  const fullKey = `${KEY_PREFIX}${secret}`;
  return {
    fullKey,
    keyPrefix: fullKey.slice(0, KEY_PREFIX.length + PREFIX_VISIBLE_CHARS),
    keyHash: hashApiKey(fullKey),
  };
}

export interface ApiKeyContext {
  apiKeyId: string;
  companyId: string;
  scopes: ApiScope[];
}

function parseBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Resolve e valida a chave de API do header `Authorization`, checando
 * revogação/expiração/escopo. Nunca lança um erro genérico — sempre um
 * `ApiV1Error` com o `code` certo, para o cliente poder tratar
 * programaticamente (401 sem chave/chave inválida/revogada/expirada, 403
 * sem o escopo exigido).
 */
export async function requireApiKey(req: NextRequest, requiredScopes: ApiScope[] = []): Promise<ApiKeyContext> {
  const token = parseBearerToken(req);
  if (!token) {
    throw new ApiV1Error("unauthorized", "Envie sua chave de API no header Authorization: Bearer <chave>.");
  }
  if (!token.startsWith(KEY_PREFIX)) {
    throw new ApiV1Error("unauthorized", "Formato de chave de API inválido.");
  }

  const keyHash = hashApiKey(token);
  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!apiKey) throw new ApiV1Error("unauthorized", "Chave de API inválida.");
  if (apiKey.revokedAt) throw new ApiV1Error("unauthorized", "Esta chave de API foi revogada.");
  if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) {
    throw new ApiV1Error("unauthorized", "Esta chave de API expirou.");
  }

  const scopes = apiKey.scopes.filter((s): s is ApiScope => (API_SCOPES as readonly string[]).includes(s));
  const missing = requiredScopes.filter((s) => !scopes.includes(s));
  if (missing.length > 0) {
    throw new ApiV1Error("forbidden", `Esta chave de API não tem o escopo necessário: ${missing.join(", ")}.`);
  }

  // Best-effort, fora do caminho crítico da resposta — o mesmo padrão de
  // after() já usado pelo Resolution Engine (Fase 1) e pelo Event Bus
  // (Fase 8): "último uso" é uma informação de conveniência para o
  // Dashboard de Desenvolvedor, nunca algo que deveria atrasar uma chamada
  // de API real.
  after(() => {
    prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  });

  return { apiKeyId: apiKey.id, companyId: apiKey.companyId, scopes };
}

/**
 * Ponte para reaproveitar serviços internos que exigem um `AuthContext`
 * completo (ex.: `assignCampaign`, com suas checagens de RBAC/restrição de
 * acesso) a partir de uma chamada autenticada por API key. Uma `ApiKey`
 * representa a empresa inteira, nunca um usuário restrito por unidade/zona
 * — por isso este contexto é sempre "sem restrição" (`accessScopes: []`,
 * `role: "OWNER"`), o equivalente de um usuário dono sem nenhuma
 * `UserAccessScope`. `organizationId` vem de uma consulta real (nunca
 * fabricado), já que `assignCampaign` valida um alvo de escopo ORGANIZATION
 * contra ele.
 */
export async function buildSyntheticAuthContext(companyId: string): Promise<AuthContext> {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { organizationId: true } });
  return {
    userId: "api-key",
    companyId,
    organizationId: company.organizationId,
    role: "OWNER",
    email: "api@nfcos.internal",
    accessScopes: [],
  };
}
