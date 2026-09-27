import "server-only";
import { emailLayout, emailButton } from "@/lib/email-templates/layout";

/**
 * E-mail de "brinde ativado pela primeira vez" (C9/F6, ADR-084, J7 do plano).
 * Disparado uma única vez por empresa, na transição false→true de
 * `RewardOffer.active` em `saveOffer` (services/return-offer.service.ts) —
 * nunca a cada edição do brinde depois disso.
 */
export function returnActivatedEmailHtml(params: { companyName: string; offerTitle: string; dashboardUrl: string }): string {
  const { companyName, offerTitle, dashboardUrl } = params;
  return emailLayout({
    eyebrow: "Retorno ativado",
    footerHtml: "Dúvidas sobre como usar o Retorno no dia a dia? Responda este e-mail.",
    bodyHtml: `
    <h1 style="margin:0 0 6px;font-size:20px;color:#16191C;">Seu brinde de Retorno está no ar! 🎁</h1>
    <p style="margin:0 0 16px;color:#4A4F55;font-size:14px;line-height:1.6;">
      A partir de agora, todo cliente que tocar num cartão da <strong>${companyName}</strong> vê
      "Toque e ganhe: ${offerTitle}" e sai com um brinde reservado pra próxima visita.
    </p>
    <p style="margin:0 0 4px;color:#4A4F55;font-size:14px;line-height:1.6;">
      Duas coisas pra deixar prontas na loja:
    </p>
    <ul style="margin:0 0 20px;padding-left:20px;color:#4A4F55;font-size:14px;line-height:1.7;">
      <li>O PIN de resgate — quem atende usa ele pra confirmar o brinde na hora.</li>
      <li>A placa/adesivo do cartão — imprima de novo se ainda tiver a versão antiga, o texto mudou pra falar do brinde.</li>
    </ul>
    ${emailButton("Abrir o Painel do Retorno", dashboardUrl)}`,
  });
}
