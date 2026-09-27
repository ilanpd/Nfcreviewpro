import "server-only";
import { emailLayout, emailButton } from "@/lib/email-templates/layout";

/**
 * E-mail de "mensagem nova" (C9/F6, ADR-084, J7 do plano) — avisa o dono
 * quando um cliente manda uma mensagem privada (`services/feedback.service.ts`
 * → `createFeedback`), pra quem não vive de olho no painel não perder o
 * WhatsApp inicial do cliente. Preview truncado: o e-mail não é o canal de
 * resposta (isso continua sendo o WhatsApp já aberto pro dono), só o aviso.
 */
export function newFeedbackEmailHtml(params: { messagePreview: string; cardName: string; mensagensUrl: string }): string {
  const { messagePreview, cardName, mensagensUrl } = params;
  const truncated = messagePreview.length > 180 ? `${messagePreview.slice(0, 180)}…` : messagePreview;
  return emailLayout({
    eyebrow: "Mensagem nova",
    footerHtml: "Esta é só uma notificação — a conversa de verdade continua pelo WhatsApp aberto na hora.",
    bodyHtml: `
    <h1 style="margin:0 0 6px;font-size:20px;color:#16191C;">Um cliente deixou uma mensagem</h1>
    <p style="margin:0 0 4px;color:#8A9099;font-size:12px;text-transform:uppercase;letter-spacing:0.03em;">Via ${cardName}</p>
    <p style="margin:0 0 20px;color:#16191C;font-size:14px;line-height:1.6;background:#F3F4F5;border-radius:8px;padding:14px 16px;">
      "${truncated}"
    </p>
    ${emailButton("Ver em Mensagens", mensagensUrl)}`,
  });
}
