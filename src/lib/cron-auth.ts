import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Autoriza uma chamada de agendamento (Vercel Cron manda `Authorization: Bearer <CRON_SECRET>`).
 *
 * Compara em TEMPO CONSTANTE (pelos hashes SHA-256, que têm sempre o mesmo tamanho): um `!==` comum devolve mais
 * rápido quanto mais cedo o texto diverge, e essas rotas não passam pelo limite de taxa geral porque a Vercel as
 * chama de IPs variados.
 *
 * Sem `CRON_SECRET` configurado a rota fica desligada (`"disabled"`), nunca aberta.
 */
export type CronAuth = "ok" | "unauthorized" | "disabled";

export function checkCronAuth(authorizationHeader: string | null, secret: string | undefined = process.env.CRON_SECRET): CronAuth {
  if (!secret) return "disabled";
  if (!authorizationHeader) return "unauthorized";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(authorizationHeader), digest(`Bearer ${secret}`)) ? "ok" : "unauthorized";
}
