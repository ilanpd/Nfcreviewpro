"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PremiumCardShell } from "@nfc-os/ui";

/**
 * "Perdi o link pessoal" (ADR-080). A resposta é sempre a mesma, com ou sem
 * cartão para o e-mail — a UI nunca pode diferenciar os dois casos.
 */
export function RecoveryForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch("/api/meu-cartao/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok && res.status !== 429) throw new Error();
      if (res.status === 429) {
        toast.error("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
        return;
      }
      setSent(true);
    } catch {
      toast.error("Não foi possível enviar agora. Tente de novo em instantes.");
    } finally {
      setSending(false);
    }
  }

  return (
    <PremiumCardShell className="w-full max-w-sm shadow-premium">
      <div className="space-y-4 p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Mail className="size-6 text-brand-ink" />
          <h1 className="text-xl font-semibold tracking-tight">Recuperar o link do cartão</h1>
          <p className="text-sm text-muted-foreground">
            Informe o e-mail usado na compra. Se houver cartões associados a ele, enviamos os links de gerenciamento.
          </p>
        </div>

        {sent ? (
          <p role="status" className="rounded-lg bg-muted p-3 text-center text-sm">
            Se houver cartões associados a esse e-mail, você vai receber uma mensagem em instantes.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail da compra</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
            </div>
            <Button type="submit" className="w-full" disabled={sending}>
              {sending ? "Enviando…" : "Enviar meus links"}
            </Button>
          </form>
        )}
      </div>
    </PremiumCardShell>
  );
}
