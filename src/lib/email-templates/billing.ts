import "server-only";
import { emailLayout, emailButton } from "@/lib/email-templates/layout";
import { GRACE_DAYS, READ_ONLY_DAYS } from "@/domain/billing/effective-tier";

/**
 * E-mails de assinatura (C9/F6, ADR-084, J7 do plano) — boas-vindas ao
 * primeiro checkout, cobrança atrasada e cancelamento. Os prazos citados
 * (`GRACE_DAYS`, `READ_ONLY_DAYS`) vêm de `domain/billing/effective-tier.ts`,
 * nunca reescritos à mão aqui — o texto do e-mail nunca pode prometer um
 * prazo diferente do que o sistema de acesso realmente aplica.
 */

export function subscriptionWelcomeEmailHtml(params: { companyName: string; planLabel: string; dashboardUrl: string }): string {
  const { companyName, planLabel, dashboardUrl } = params;
  return emailLayout({
    eyebrow: "Assinatura confirmada",
    footerHtml: "Alguma dúvida sobre o plano? Responda este e-mail.",
    bodyHtml: `
    <h1 style="margin:0 0 6px;font-size:20px;color:#16191C;">Bem-vindo(a), ${companyName}! 🎉</h1>
    <p style="margin:0 0 20px;color:#4A4F55;font-size:14px;line-height:1.6;">
      Sua assinatura do plano <strong>${planLabel}</strong> está ativa. O painel já libera tudo que o plano inclui —
      é só entrar e configurar o brinde de Retorno, se ainda não tiver feito isso.
    </p>
    ${emailButton("Abrir o painel", dashboardUrl)}`,
  });
}

export function billingPastDueEmailHtml(params: { companyName: string; settingsUrl: string }): string {
  const { companyName, settingsUrl } = params;
  return emailLayout({
    eyebrow: "Cobrança atrasada",
    footerHtml: "Já atualizou o pagamento e ainda vê este aviso? Responda este e-mail que resolvemos manualmente.",
    bodyHtml: `
    <h1 style="margin:0 0 6px;font-size:20px;color:#16191C;">Não conseguimos confirmar sua última cobrança</h1>
    <p style="margin:0 0 16px;color:#4A4F55;font-size:14px;line-height:1.6;">
      A assinatura da <strong>${companyName}</strong> continua funcionando normalmente por mais
      <strong>${GRACE_DAYS} dias</strong> — dá tempo de atualizar o cartão sem que ninguém perceba nada no painel.
      Depois disso, o acesso passa a ser só de leitura por até ${READ_ONLY_DAYS} dias, sem poder emitir brinde novo.
    </p>
    ${emailButton("Atualizar forma de pagamento", settingsUrl)}
    <p style="margin:16px 0 0;color:#8A9099;font-size:12px;">O botão abre "Gerenciar assinatura" em Configurações — o link direto do Portal de Cobrança expira sozinho, então nunca vai por e-mail.</p>`,
  });
}

export function subscriptionCanceledEmailHtml(params: { companyName: string; dashboardUrl: string }): string {
  const { companyName, dashboardUrl } = params;
  return emailLayout({
    eyebrow: "Assinatura cancelada",
    footerHtml: "Mudou de ideia? Responda este e-mail ou reative direto pelo painel, a qualquer momento.",
    bodyHtml: `
    <h1 style="margin:0 0 6px;font-size:20px;color:#16191C;">A assinatura da ${companyName} foi cancelada</h1>
    <p style="margin:0 0 16px;color:#4A4F55;font-size:14px;line-height:1.6;">
      O painel continua acessível só para consulta (sem editar nada nem emitir brinde novo) por até
      <strong>${READ_ONLY_DAYS} dias</strong>. Depois desse prazo, reative a assinatura para voltar a usar o produto.
    </p>
    ${emailButton("Reativar assinatura", dashboardUrl)}`,
  });
}
