import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * O sinal de "conversão" (o cliente seguiu para o destino do dono) em
 * qualquer um dos 3 modos de experiência do cartão — Retorno, campanha do
 * dono, ou só os dois botões (ADR-080): `Visit.primaryClickedAt` preenchido.
 * Compatível com o histórico anterior à ADR-080 (antes de existir essa
 * coluna, a única confirmação de conversão era o redirecionamento a partir
 * da tela de estrelas) por `RatingEvent.redirectedGoogle = true` — nunca as
 * duas contadas em dobro, porque `RatingEvent.visitId` é único por Visit e
 * uma Visit da era anterior nunca ganha `primaryClickedAt` retroativamente.
 *
 * Achado de auditoria (28/09/2026): a ADR-080 (C6) introduziu
 * `primaryClickedAt` como o novo sinal e disse explicitamente que ele
 * "substitui, para a tela sem estrelas, o que RatingEvent.redirectedGoogle
 * contava" — mas nenhum dos motores que já liam `RatingEvent.redirectedGoogle`
 * (Analytics/Ranking/Insights/Forecast Engine) foi migrado (a própria ADR-075
 * e a ADR-080 registraram essa migração como pendente para o ciclo "C9", que
 * acabou sendo sobre e-mails/reengajamento, não sobre isto). Resultado: desde
 * a ADR-080, TODA empresa usando o fluxo real (sem tela de estrelas) mostra
 * conversão zero para sempre em KPIs, funil, rankings e insights — o próprio
 * evento nunca é gravado, então nenhuma consulta a `RatingEvent` encontra
 * nada. Esta é agora a ÚNICA fonte da verdade sobre "o que conta como
 * conversão" — nenhum motor deve montar essa consulta sozinho de novo.
 */
/** Exportado (não só usado internamente) para quem precisa de um `select`
 * diferente dos dois abaixo (ex.: Time Machine, que também quer o nome do
 * cartão) — sempre este mesmo filtro, nunca uma cópia reescrita à mão.
 * (Sem `as const`: o Prisma espera um array comum em `OR`, não uma tupla
 * somente-leitura.) */
export const CONVERTED_VISIT_WHERE = {
  OR: [{ primaryClickedAt: { not: null } }, { ratingEvent: { redirectedGoogle: true } }],
};

export function countConvertedVisits(companyId: string, since: Date, until?: Date) {
  return prisma.visit.count({
    where: { companyId, createdAt: until ? { gte: since, lt: until } : { gte: since }, ...CONVERTED_VISIT_WHERE },
  });
}

/** Total histórico (sem recorte de data) — para metas cumulativas (Forecast Engine). */
export function countConvertedVisitsTotal(companyId: string) {
  return prisma.visit.count({ where: { companyId, ...CONVERTED_VISIT_WHERE } });
}

/** Linhas cruas (cartão + instante) para quem precisa agrupar por cartão, zona,
 * hora local ou dia da semana (Ranking/Insights Engine) — uma consulta, cada
 * motor reduz do seu jeito, em vez de cada um remontar o mesmo `where`. */
export function findConvertedVisits(companyId: string, since: Date, cardId?: string, until?: Date) {
  return prisma.visit.findMany({
    where: {
      companyId,
      createdAt: until ? { gte: since, lte: until } : { gte: since },
      ...(cardId ? { cardId } : {}),
      ...CONVERTED_VISIT_WHERE,
    },
    select: { cardId: true, createdAt: true },
  });
}
