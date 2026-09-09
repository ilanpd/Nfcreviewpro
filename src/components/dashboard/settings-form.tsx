"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Company } from "@/generated/prisma/client";

export function SettingsForm({ company }: { company: Company }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: company.name,
    whatsapp: company.whatsapp,
    googleReviewUrl: company.googleReviewUrl,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível salvar as configurações");
      }
      toast.success("Configurações salvas");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Card className="border-none shadow-sm shadow-black/5">
        <CardHeader>
          <CardTitle>Dados da empresa</CardTitle>
          <CardDescription>Essas informações aparecem na página pública que seus clientes acessam.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp do gerente</Label>
              <Input
                id="whatsapp"
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="googleReviewUrl">Link de avaliação do Google</Label>
              <Input
                id="googleReviewUrl"
                type="url"
                value={form.googleReviewUrl}
                onChange={(e) => setForm({ ...form, googleReviewUrl: e.target.value })}
                required
              />
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* White Label (Fase 10) — logo, cores, favicon e domínio personalizado
          se mudaram de lugar: viviam aqui (um campo de cor solto e um campo
          de domínio permanentemente desabilitado, "em breve"), agora têm uma
          tela própria e completa, com preview ao vivo. Nunca duas telas
          editando o mesmo campo — ver ADR-040. */}
      <Card className="border-dashed shadow-none">
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <Palette className="size-5 text-brand" />
            <div>
              <p className="text-sm font-medium text-foreground">Marca, cores e domínio personalizado</p>
              <p className="text-xs text-muted-foreground">Logo, favicon, cores, tela de login e domínio próprio agora vivem no Theme Studio.</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/branding">Abrir Branding</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
