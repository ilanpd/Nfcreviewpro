"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AnalyticsCard } from "@nfc-os/ui";

/**
 * LGPD (Auditoria Nível Bilionário, 11/09/2026) — só visível para quem tem
 * `settings:write` (exportar) — a exclusão em si é restrita a OWNER dentro
 * da própria rota, então um ADMIN vê o botão mas recebe um erro claro se
 * tentar, em vez de o botão simplesmente não existir sem explicação.
 */
export function DataPrivacyCard({ companyName, isOwner }: { companyName: string; isOwner: boolean }) {
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/company/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível excluir a empresa");
      }
      toast.success("Empresa excluída. Redirecionando…");
      window.location.href = "/";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
      setDeleting(false);
    }
  }

  return (
    <AnalyticsCard title="Seus dados" description="Exporte tudo que temos sobre sua empresa, ou exclua permanentemente.">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline">
          <a href="/api/company/export">
            <Download className="size-4" /> Exportar meus dados
          </a>
        </Button>

        {isOwner ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="text-destructive hover:text-destructive">
                <Trash2 className="size-4" /> Excluir empresa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Excluir {companyName} permanentemente?</DialogTitle>
                <DialogDescription>
                  Isto apaga a empresa, todos os cartões, campanhas, usuários e histórico. Não pode ser desfeito.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="confirm-name">Digite &quot;{companyName}&quot; para confirmar</Label>
                <Input id="confirm-name" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button
                  variant="destructive"
                  disabled={confirmName !== companyName || deleting}
                  onClick={handleDelete}
                >
                  {deleting ? "Excluindo…" : "Excluir permanentemente"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </AnalyticsCard>
  );
}
