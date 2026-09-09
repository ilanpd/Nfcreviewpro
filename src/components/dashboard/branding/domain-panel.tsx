"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Globe, ShieldCheck, ShieldAlert, Trash2 } from "lucide-react";
import { AnalyticsCard, SmartBadge } from "@nfc-os/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Company } from "@/generated/prisma/client";

/**
 * Domínio Personalizado (Fase 10) — verificação real via DNS TXT (ver
 * `lib/white-label/dns.ts`/ADR-042), nunca fingida. O passo de SSL/DNS de
 * host (apontar o CNAME, emitir o certificado) continua sendo manual, do
 * lado do provedor de hospedagem (Vercel Domains ou equivalente) — este
 * painel cobre exatamente a parte que o produto controla: reivindicar,
 * mostrar o desafio, e confirmar posse.
 */
export function DomainPanel({ company, rootDomain }: { company: Company; rootDomain: string }) {
  const [domainInput, setDomainInput] = useState(company.domain ?? "");
  const [current, setCurrent] = useState({
    domain: company.domain,
    domainVerificationToken: company.domainVerificationToken,
    domainVerifiedAt: company.domainVerifiedAt,
  });
  const [busy, setBusy] = useState(false);

  const subdomain = `${company.slug}.${rootDomain}`;

  async function claim() {
    if (!domainInput.trim()) return toast.error("Informe um domínio.");
    setBusy(true);
    try {
      const res = await fetch("/api/company/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainInput.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao registrar domínio");
      setCurrent({
        domain: data.company.domain,
        domainVerificationToken: data.company.domainVerificationToken,
        domainVerifiedAt: data.company.domainVerifiedAt,
      });
      toast.success("Domínio registrado — adicione o registro TXT abaixo para verificar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao registrar domínio");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    try {
      const res = await fetch("/api/company/domain/verify", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao verificar domínio");
      if (data.verified) {
        setCurrent((prev) => ({ ...prev, domainVerifiedAt: new Date().toISOString() as unknown as Date }));
        toast.success("Domínio verificado! Configure o CNAME no seu provedor de hospedagem para finalizar.");
      } else {
        toast.error(data.reason ?? "Ainda não encontramos o registro TXT.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao verificar domínio");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch("/api/company/domain", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Falha ao remover domínio");
      }
      setCurrent({ domain: null, domainVerificationToken: null, domainVerifiedAt: null });
      setDomainInput("");
      toast.success("Domínio removido");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover domínio");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <AnalyticsCard title="Subdomínio" description="Já disponível, sem nenhuma configuração — funciona hoje mesmo.">
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-muted-foreground" />
          <code className="text-sm">{subdomain}</code>
          <SmartBadge label="Ativo" tone="success" />
        </div>
      </AnalyticsCard>

      <AnalyticsCard
        title="Domínio próprio"
        description="Ex.: app.suaempresa.com — sua equipe entra por ele, com sua marca, do início ao fim."
        action={
          current.domain ? (
            <SmartBadge
              label={current.domainVerifiedAt ? "Verificado" : "Aguardando verificação"}
              tone={current.domainVerifiedAt ? "success" : "warning"}
              icon={current.domainVerifiedAt ? <ShieldCheck className="size-3" /> : <ShieldAlert className="size-3" />}
            />
          ) : undefined
        }
      >
        {!current.domain ? (
          <div className="flex gap-2">
            <Input placeholder="app.suaempresa.com" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} />
            <Button onClick={claim} disabled={busy}>
              Registrar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
              <code className="text-sm">{current.domain}</code>
              <Button size="sm" variant="ghost" onClick={remove} disabled={busy}>
                <Trash2 className="size-3.5" /> Remover
              </Button>
            </div>

            {!current.domainVerifiedAt && (
              <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
                <div>
                  <Label className="text-xs">1. Adicione este registro TXT no DNS do seu domínio</Label>
                  <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-muted p-2 font-mono text-xs">
                    <span className="text-muted-foreground">Nome</span>
                    <span>_nfcos-challenge.{current.domain}</span>
                    <span className="text-muted-foreground">Tipo</span>
                    <span>TXT</span>
                    <span className="text-muted-foreground">Valor</span>
                    <span className="break-all">{current.domainVerificationToken}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">2. Depois de propagar (alguns minutos), confirme aqui</Label>
                  <Button size="sm" className="mt-1" onClick={verify} disabled={busy}>
                    Verificar agora
                  </Button>
                </div>
              </div>
            )}

            {current.domainVerifiedAt && (
              <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">3. Aponte o domínio para nossa hospedagem</p>
                <p className="mt-1">
                  Posse confirmada — falta só apontar o CNAME de <code className="rounded bg-muted px-1 py-0.5">{current.domain}</code> para{" "}
                  <code className="rounded bg-muted px-1 py-0.5">{rootDomain}</code> (ou o alvo indicado pelo seu provedor de hospedagem) e emitir o
                  certificado SSL — esse passo acontece no painel de domínios da hospedagem, não aqui.
                </p>
              </div>
            )}
          </div>
        )}
      </AnalyticsCard>
    </div>
  );
}
