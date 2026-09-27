import "server-only";
import { emailLayout } from "@/lib/email-templates/layout";

/** Notificação interna de uma mensagem nova em /contato (C9/F6) — vai para `supportInboxEmail()`, nunca para o remetente. */
export function contactNotificationEmailHtml(params: { name: string; email: string; message: string }): string {
  const { name, email, message } = params;
  return emailLayout({
    eyebrow: "Mensagem do site (/contato)",
    bodyHtml: `
    <h1 style="margin:0 0 14px;font-size:20px;color:#16191C;">${name} escreveu pelo site</h1>
    <p style="margin:0 0 4px;color:#5C5D66;font-size:13px;">Responder para: <a href="mailto:${email}" style="color:#5A47D6;">${email}</a></p>
    <p style="margin:16px 0 0;color:#16191C;font-size:14px;line-height:1.6;background:#F3F4F5;border-radius:8px;padding:14px 16px;white-space:pre-wrap;">${message}</p>`,
  });
}
