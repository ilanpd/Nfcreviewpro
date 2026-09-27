"use client";

import { useState } from "react";
import { BRAND } from "@/lib/brand";
import { toast } from "sonner";
import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AnalyticsCard, SmartBadge, EmptyState } from "@nfc-os/ui";
import type { SupportRequest, SupportRequestStatus, User } from "@/generated/prisma/client";

const STATUS_LABEL: Record<SupportRequestStatus, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
  RESOLVED: "Resolvido",
};

const STATUS_TONE: Record<SupportRequestStatus, "warning" | "info" | "success"> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  RESOLVED: "success",
};

type SupportRequestItem = SupportRequest & { user: Pick<User, "name" | "email"> | null };

/**
 * Central de Suporte (Fase 20) — o dono da empresa fala com a NFC OS a
 * partir daqui pela primeira vez; o chamado aparece na Central do Cliente
 * do Admin (`/admin/empresas/[id]`, Fase 19.7), nunca uma fila fantasma que
 * ninguém vê do outro lado.
 */
export function SupportView({ initialRequests }: { initialRequests: SupportRequestItem[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      if (!res.ok) throw new Error();
      const { request } = await res.json();
      setRequests((prev) => [{ ...request, user: null }, ...prev]);
      setSubject("");
      setMessage("");
      toast.success("Chamado enviado — nossa equipe vai te responder em breve.");
    } catch {
      toast.error("Não foi possível enviar o chamado. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Suporte</h1>
        <p className="text-sm text-muted-foreground">Precisa de ajuda com o {BRAND.name}? Conte o que está acontecendo — respondemos aqui mesmo.</p>
      </div>

      <AnalyticsCard title="Abrir um chamado">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="subject">Assunto</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex.: Cartão não está redirecionando"
              maxLength={120}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Descreva o que aconteceu, quando começou e o que você já tentou."
              rows={5}
              maxLength={4000}
              required
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar chamado"}
          </Button>
        </form>
      </AnalyticsCard>

      <AnalyticsCard title={`Seus chamados (${requests.length})`}>
        {requests.length === 0 ? (
          <EmptyState icon={<LifeBuoy />} title="Nenhum chamado ainda" description="Quando você abrir um chamado, ele aparece aqui com o status." />
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.subject}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{r.message}</p>
                  </div>
                  <SmartBadge label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(r.createdAt))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AnalyticsCard>
    </div>
  );
}
