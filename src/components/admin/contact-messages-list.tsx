"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@nfc-os/ui";
import { MailOpen } from "lucide-react";

interface ContactMessageRow {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
  respondedAt: string | null;
}

/** Mesmo padrão de toggle otimista de `components/dashboard/feedback-list.tsx`, aplicado a `ContactMessage` (C9/F6). */
export function ContactMessagesList({ initialMessages }: { initialMessages: ContactMessageRow[] }) {
  const [items, setItems] = useState(initialMessages);

  async function toggleResponded(id: string, responded: boolean) {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, respondedAt: responded ? new Date().toISOString() : null } : m)));
    try {
      const res = await fetch(`/api/admin/contato/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responded }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Não foi possível atualizar o status");
      setItems((prev) => prev.map((m) => (m.id === id ? { ...m, respondedAt: responded ? null : new Date().toISOString() } : m)));
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<MailOpen />}
        title="Nenhuma mensagem por enquanto"
        description="O que chegar pelo formulário público de /contato aparece aqui."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead className="max-w-sm">Mensagem</TableHead>
            <TableHead>Respondida</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {new Date(m.createdAt).toLocaleDateString("pt-BR")}
              </TableCell>
              <TableCell className="font-medium">{m.name}</TableCell>
              <TableCell>
                <a href={`mailto:${m.email}`} className="text-brand-ink underline underline-offset-2">
                  {m.email}
                </a>
              </TableCell>
              <TableCell className="max-w-sm whitespace-pre-wrap text-sm">{m.message}</TableCell>
              <TableCell>
                <Switch checked={!!m.respondedAt} onCheckedChange={(checked) => toggleResponded(m.id, checked)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
