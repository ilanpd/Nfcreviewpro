/**
 * Base da aplicação para links dentro de e-mail (C9/F6) — mesmo fallback que
 * já existia hardcoded em `services/meu-cartao.service.ts`, agora num lugar
 * só para não divergir entre todo e-mail que linka de volta pro painel
 * (Retorno ativado, boas-vindas, mensagem nova, cobrança, reengajamento).
 * Nunca usado para o link público do cartão em si — isso é
 * `lib/card-url.ts` (pode apontar pra um domínio próprio da empresa,
 * diferente do domínio do app).
 */
export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
