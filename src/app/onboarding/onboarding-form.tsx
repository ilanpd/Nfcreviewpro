"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PremiumCardShell } from "@nfc-os/ui";

const PRESET_COLORS = ["#0F172A", "#1D4ED8", "#059669", "#B91C1C", "#7C3AED", "#EA580C"];

export function OnboardingForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    whatsapp: "",
    googleReviewUrl: "",
    primaryColor: PRESET_COLORS[0],
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível concluir o cadastro");
      }
      toast.success("Empresa criada com sucesso!");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PremiumCardShell className="shadow-premium">
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da empresa</Label>
            <Input
              id="name"
              placeholder="Ex: Restaurante Sabor & Arte"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              minLength={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp do gerente</Label>
            <Input
              id="whatsapp"
              placeholder="Ex: 5511999999999"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              required
              minLength={10}
            />
            <p className="text-xs text-muted-foreground">
              Feedbacks de 1 a 3 estrelas chegam por aqui, com DDI e DDD, apenas números.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="googleReviewUrl">Link de avaliação do Google</Label>
            <Input
              id="googleReviewUrl"
              type="url"
              placeholder="https://g.page/r/xxxxx/review"
              value={form.googleReviewUrl}
              onChange={(e) => setForm({ ...form, googleReviewUrl: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Cor principal da marca</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Selecionar cor ${color}`}
                  onClick={() => setForm({ ...form, primaryColor: color })}
                  className="size-8 rounded-full ring-offset-2 transition-shadow"
                  style={{
                    backgroundColor: color,
                    boxShadow: form.primaryColor === color ? `0 0 0 2px ${color}` : "none",
                  }}
                />
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando…" : "Concluir cadastro"}
          </Button>
        </form>
      </div>
    </PremiumCardShell>
  );
}
