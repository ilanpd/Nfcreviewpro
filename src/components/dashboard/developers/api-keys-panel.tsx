"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Plus, ShieldOff } from "lucide-react";
import { AnalyticsCard, EmptyState, PremiumModal, SmartBadge } from "@nfc-os/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { API_SCOPES, API_SCOPE_LABELS, type ApiScope } from "@/domain/api-v1/scopes";

export interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | Date | null;
  expiresAt: string | Date | null;
  revokedAt: string | Date | null;
  createdAt: string | Date;
}

function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
}

export function ApiKeysPanel({ initialApiKeys }: { initialApiKeys: ApiKeyRow[] }) {
  const [apiKeys, setApiKeys] = useState(initialApiKeys);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Set<ApiScope>>(new Set());
  const [busy, setBusy] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  function toggleScope(scope: ApiScope, checked: boolean) {
    setScopes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(scope);
      else next.delete(scope);
      return next;
    });
  }

  async function createKey() {
    if (!name.trim()) return toast.error("Dê um nome para a chave (ex.: \"Integração Zapier\").");
    if (scopes.size === 0) return toast.error("Selecione ao menos um escopo.");

    setBusy(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), scopes: Array.from(scopes) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao criar chave de API");
      setApiKeys((prev) => [data.apiKey, ...prev]);
      setRevealedKey(data.fullKey);
      setName("");
      setScopes(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar chave de API");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao revogar chave");
      setApiKeys((prev) => prev.map((k) => (k.id === id ? data.apiKey : k)));
      toast.success("Chave de API revogada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao revogar chave");
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copiado");
  }

  return (
    <AnalyticsCard
      title="Chaves de API"
      description="Uma chave representa acesso de servidor-a-servidor a esta empresa inteira, dentro dos escopos escolhidos — nunca herda o papel de quem a criou."
      action={
        <>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" /> Nova chave de API
          </Button>
          <PremiumModal
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setRevealedKey(null);
            }}
            icon={KeyRound}
            size="md"
            title={revealedKey ? "Copie sua chave agora" : "Nova chave de API"}
            description={
              revealedKey
                ? "Por segurança, não é possível ver este valor de novo depois de fechar esta janela."
                : "Escolha exatamente o que esta chave pode fazer — nunca mais do que o necessário."
            }
            footer={
              revealedKey ? (
                <Button
                  onClick={() => {
                    setOpen(false);
                    setRevealedKey(null);
                  }}
                >
                  Já copiei, fechar
                </Button>
              ) : (
                <Button disabled={busy} onClick={createKey}>
                  Criar chave
                </Button>
              )
            }
          >
            {revealedKey ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
                <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs">{revealedKey}</code>
                <Button size="sm" variant="outline" onClick={() => copy(revealedKey)}>
                  <Copy className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Integração Zapier" />
                </div>
                <div className="space-y-1.5">
                  <Label>Escopos</Label>
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                    {API_SCOPES.map((scope) => (
                      <div key={scope} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{scope}</p>
                          <p className="text-xs text-muted-foreground">{API_SCOPE_LABELS[scope]}</p>
                        </div>
                        <Switch checked={scopes.has(scope)} onCheckedChange={(checked) => toggleScope(scope, checked)} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </PremiumModal>
        </>
      }
    >
      {apiKeys.length === 0 ? (
        <EmptyState icon={<KeyRound />} title="Nenhuma chave de API criada ainda" description="Crie uma para integrar sua empresa a outros sistemas." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Prefixo</TableHead>
              <TableHead>Escopos</TableHead>
              <TableHead>Último uso</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeys.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="font-medium">{key.name}</TableCell>
                <TableCell>
                  <code className="text-xs">{key.keyPrefix}…</code>
                </TableCell>
                <TableCell className="max-w-xs">
                  <div className="flex flex-wrap gap-1">
                    {key.scopes.map((s) => (
                      <SmartBadge key={s} label={s} tone="neutral" />
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(key.lastUsedAt)}</TableCell>
                <TableCell>
                  {key.revokedAt ? (
                    <SmartBadge label="Revogada" tone="danger" />
                  ) : key.expiresAt && new Date(key.expiresAt) < new Date() ? (
                    <SmartBadge label="Expirada" tone="warning" />
                  ) : (
                    <SmartBadge label="Ativa" tone="success" />
                  )}
                </TableCell>
                <TableCell>
                  {!key.revokedAt && (
                    <Button size="sm" variant="ghost" onClick={() => revoke(key.id)}>
                      <ShieldOff className="size-3.5" /> Revogar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AnalyticsCard>
  );
}
