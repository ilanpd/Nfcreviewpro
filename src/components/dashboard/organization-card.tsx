"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnalyticsCard, OrganizationBrandCard } from "@nfc-os/ui";

interface OrganizationMember {
  id: string;
  name: string;
  slug: string;
}

interface OrganizationCardProps {
  organization: { id: string; name: string; companies: OrganizationMember[] } | null;
  currentCompanyId: string;
  canManage: boolean;
}

export function OrganizationCard({ organization, currentCompanyId, canManage }: OrganizationCardProps) {
  const [current, setCurrent] = useState(organization);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível criar a organização");
      }
      const { organization: created } = await res.json();
      setCurrent({ ...created, companies: [{ id: currentCompanyId, name, slug: created.slug }] });
      toast.success("Organização criada — agora você pode criar campanhas que valem para todas as unidades");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  if (!current) {
    if (!canManage) return null;
    return (
      <AnalyticsCard
        title="Organização"
        description="Transforme esta empresa em uma organização para gerenciar múltiplas unidades (franquia) com campanhas compartilhadas entre elas."
        className="max-w-2xl"
      >
        <form onSubmit={handleCreate} className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="org-name">Nome da organização</Label>
            <Input
              id="org-name"
              placeholder="Ex: Rede Bella Vista"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Criando…" : "Criar organização"}
          </Button>
        </form>
      </AnalyticsCard>
    );
  }

  const currentCompany = current.companies.find((c) => c.id === currentCompanyId);

  return (
    <div className="max-w-2xl space-y-3">
      <OrganizationBrandCard name={current.name} companyCount={current.companies.length} currentCompanyName={currentCompany?.name} />
      <AnalyticsCard title="Empresas da organização" description='Podem receber campanhas com escopo "toda a organização".'>
        <ul className="space-y-1.5 text-sm">
          {current.companies.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span className={c.id === currentCompanyId ? "font-medium" : "text-muted-foreground"}>{c.name}</span>
              {c.id === currentCompanyId ? <span className="text-xs text-muted-foreground">(esta empresa)</span> : null}
            </li>
          ))}
        </ul>
      </AnalyticsCard>
    </div>
  );
}
