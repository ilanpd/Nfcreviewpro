"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** De onde vem a mensagem: exatamente uma das três (ver lib/validations/feedback.ts). */
export type FeedbackOrigin = { visitId: string } | { cardCode: string } | { ratingEventId: string };

interface FeedbackFormProps {
  origin: FeedbackOrigin;
  primaryColor: string;
}

export function FeedbackForm({ origin, primaryColor }: FeedbackFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", message: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.message.trim().length < 3) {
      toast.error("Escreva um pouco mais para podermos entender.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...origin, ...form }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível enviar sua mensagem");
      }
      const { whatsappUrl } = await res.json();
      router.push(`/thank-you?type=feedback&wa=${encodeURIComponent(whatsappUrl)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome (opcional)</Label>
        <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Telefone (opcional)</Label>
        <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Sua mensagem</Label>
        <Textarea
          id="message"
          required
          minLength={3}
          rows={4}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="Escreva aqui…"
        />
      </div>
      <Button type="submit" className="w-full" style={{ backgroundColor: primaryColor }} disabled={submitting}>
        {submitting ? "Enviando…" : "Enviar mensagem"}
      </Button>
    </form>
  );
}
