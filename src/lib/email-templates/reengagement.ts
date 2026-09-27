import "server-only";
import { emailLayout, emailButton } from "@/lib/email-templates/layout";
import type { ReengagementMilestone } from "@/domain/return-offer/reengagement";

/**
 * E-mails de reengajamento D+7/D+30 (C9/F6, ADR-084, J7 do plano) — só
 * chegam pra quem assina o produto e ainda não ativou o Retorno
 * (`domain/return-offer/reengagement.ts` decide quando). Tom cresce um
 * pouco de urgência do D7 pro D30, sem virar cobrança.
 */
export function returnReengagementEmailHtml(params: { companyName: string; milestone: ReengagementMilestone; retornoUrl: string }): string {
  const { companyName, milestone, retornoUrl } = params;
  const isFirst = milestone === "D7";
  return emailLayout({
    eyebrow: isFirst ? "Ainda dá tempo de ativar o Retorno" : "O Retorno da sua conta ainda está desligado",
    footerHtml: "Precisa de ajuda pra configurar? Responda este e-mail.",
    bodyHtml: isFirst
      ? `
    <h1 style="margin:0 0 6px;font-size:20px;color:#16191C;">${companyName}, seu cartão ainda não dá brinde nenhum</h1>
    <p style="margin:0 0 20px;color:#4A4F55;font-size:14px;line-height:1.6;">
      Faz uma semana que sua assinatura está ativa, mas o Retorno — o brinde que faz o cliente voltar —
      continua desligado. Leva menos de 5 minutos pra configurar: escreva o brinde, defina um PIN e ative.
    </p>
    ${emailButton("Ativar o Retorno agora", retornoUrl)}`
      : `
    <h1 style="margin:0 0 6px;font-size:20px;color:#16191C;">${companyName}, um mês de assinatura sem usar o Retorno</h1>
    <p style="margin:0 0 20px;color:#4A4F55;font-size:14px;line-height:1.6;">
      O Retorno é o motivo do produto se chamar "faça cada cliente voltar" — sem ele ativo, seus cartões só
      levam ao Google ou ao WhatsApp, sem nenhum brinde pra trazer o cliente de volta. Este é o último lembrete
      automático que você recebe sobre isso.
    </p>
    ${emailButton("Ativar o Retorno agora", retornoUrl)}`,
  });
}
