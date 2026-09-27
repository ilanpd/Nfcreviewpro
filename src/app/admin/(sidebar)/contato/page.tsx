import { listContactMessages } from "@/services/contact.service";
import { ContactMessagesList } from "@/components/admin/contact-messages-list";

/** Central de /contato (C9/F6) — quem escreve pelo site sem ter conta ainda. Ver services/contact.service.ts. */
export default async function AdminContatoPage() {
  const messages = await listContactMessages();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mensagens do site</h1>
        <p className="text-sm text-muted-foreground">
          O que chega pelo formulário público de /contato — antes de qualquer conta existir.
        </p>
      </div>
      <ContactMessagesList
        initialMessages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString(), respondedAt: m.respondedAt?.toISOString() ?? null }))}
      />
    </div>
  );
}
