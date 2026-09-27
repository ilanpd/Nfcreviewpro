"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, MessageSquareWarning, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FeedbackWithContext } from "@/types";
import { EmptyState, SmartBadge } from "@nfc-os/ui";

export function FeedbackList({
  initialFeedback,
  canManage,
  apiBasePath = "/api/feedback",
  showExport = true,
}: {
  initialFeedback: FeedbackWithContext[];
  canManage: boolean;
  /** Central do Cliente (Fase 19.7) — o Admin reaproveita este mesmo
   * componente para o feedback de uma empresa arbitrária, apontando para
   * `/api/admin/feedback` (que resolve o `companyId` sozinho) em vez do
   * `/api/feedback` escopado por sessão. */
  apiBasePath?: string;
  showExport?: boolean;
}) {
  const [items, setItems] = useState(initialFeedback);

  async function toggleResolved(id: string, resolved: boolean) {
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, resolved } : f)));
    try {
      const res = await fetch(`${apiBasePath}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Não foi possível atualizar o status");
      setItems((prev) => prev.map((f) => (f.id === id ? { ...f, resolved: !resolved } : f)));
    }
  }

  return (
    <div className="space-y-4">
      {showExport ? (
        <div className="flex justify-end">
          <a href="/api/export/feedback">
            <Button variant="outline" size="sm">
              <Download className="size-4" /> Exportar CSV
            </Button>
          </a>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={<MessageSquareWarning />}
          title="Nenhum feedback privado por enquanto"
          description="As mensagens que seus clientes enviarem em “Falar com a gente” aparecem aqui."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="max-w-xs">Mensagem</TableHead>
                <TableHead>Resolvido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(f.createdAt)}
                  </TableCell>
                  <TableCell>
                    <SmartBadge
                      tone="neutral"
                      icon={<Star className="fill-amber-400 text-amber-400" />}
                      label={String(f.ratingEvent.stars)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{f.name || "Não informado"}</div>
                    {f.phone ? <div className="text-xs text-muted-foreground">{f.phone}</div> : null}
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-normal text-sm">{f.message}</TableCell>
                  <TableCell>
                    <Switch
                      checked={f.resolved}
                      disabled={!canManage}
                      onCheckedChange={(checked) => toggleResolved(f.id, checked)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
