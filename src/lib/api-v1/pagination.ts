import "server-only";
import { ApiV1Error } from "./errors";

/**
 * API Pública v1 (Fase 9) — paginação por cursor, nunca por offset (uma
 * página por `?page=2` degrada com o tamanho da tabela e pode pular/repetir
 * linhas sob escrita concorrente; cursor não tem nenhum dos dois problemas).
 * Formato de resposta inspirado na Stripe: `{ data, has_more, next_cursor }`.
 */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface PageParams {
  cursor?: string;
  limit: number;
}

export function parsePageParams(searchParams: URLSearchParams): PageParams {
  const limitParam = searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (limitParam !== null) {
    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      throw new ApiV1Error("validation_error", `"limit" deve ser um número inteiro entre 1 e ${MAX_LIMIT}.`);
    }
    limit = parsed;
  }
  const cursor = searchParams.get("cursor") ?? undefined;
  return { cursor, limit };
}

/** Argumentos prontos para passar a um `findMany` do Prisma — pede um item a
 * mais do que o limite (`take: limit + 1`) só para saber se `has_more` é
 * verdadeiro, sem uma segunda consulta de `count`. */
export function cursorQueryArgs(params: PageParams) {
  return {
    take: params.limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  };
}

export interface Page<T> {
  data: T[];
  has_more: boolean;
  next_cursor: string | null;
}

export function buildPage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  const has_more = rows.length > limit;
  const data = has_more ? rows.slice(0, limit) : rows;
  const next_cursor = has_more ? data[data.length - 1]!.id : null;
  return { data, has_more, next_cursor };
}
