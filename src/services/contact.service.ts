import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth";
import { sendEmail, supportInboxEmail } from "@/lib/email";
import { contactNotificationEmailHtml } from "@/lib/email-templates/contact";
import { BRAND } from "@/lib/brand";
import type { CreateContactMessageInput } from "@/lib/validations/contact";

/**
 * /contato (C9/F6) — a linha em `ContactMessage` é o registro de verdade;
 * a notificação por e-mail é só um aviso best-effort (nunca bloqueia quem
 * está mandando a mensagem, nunca é a única cópia que existe).
 */
export async function createContactMessage(input: CreateContactMessageInput) {
  const contactMessage = await prisma.contactMessage.create({ data: input });

  after(() => {
    const inbox = supportInboxEmail();
    if (!inbox) return;
    sendEmail({
      to: inbox,
      subject: `Mensagem nova pelo site — ${BRAND.name}`,
      html: contactNotificationEmailHtml(input),
    }).catch((err) => console.error("[contact] notificação por e-mail falhou", err));
  });

  return contactMessage;
}

/** Listagem para `/admin/contato` — só o super-admin vê. */
export function listContactMessages(options: { onlyPending?: boolean } = {}) {
  return prisma.contactMessage.findMany({
    where: options.onlyPending ? { respondedAt: null } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function setContactMessageResponded(id: string, responded: boolean) {
  const message = await prisma.contactMessage.findUnique({ where: { id } });
  if (!message) throw new ForbiddenError("Mensagem não encontrada");
  return prisma.contactMessage.update({ where: { id }, data: { respondedAt: responded ? new Date() : null } });
}
