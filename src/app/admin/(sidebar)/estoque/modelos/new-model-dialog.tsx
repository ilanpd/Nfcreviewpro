"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Cria o modelo com um layout padrão (fundo branco de teste) e já abre o editor para a arte. */
export function NewModelDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [minStock, setMinStock] = useState("5");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/plates/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, minStock: Number(minStock) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível criar o modelo");
      toast.success("Modelo criado. Agora ajuste a arte e o lugar do QR.");
      setOpen(false);
      router.push(`/admin/estoque/modelos/${data.model.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Novo modelo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo modelo de placa</DialogTitle>
          <DialogDescription>Dê um nome que você reconheça na hora de gerar lotes, como &ldquo;Avaliação 10x10&rdquo; ou &ldquo;Universal balcão&rdquo;.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="model-name">Nome do modelo</Label>
            <Input id="model-name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="model-min">Estoque mínimo (alerta)</Label>
            <Input id="model-min" type="number" inputMode="numeric" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
            <p className="text-xs text-muted-foreground">Quando as placas conferidas ficarem abaixo disso, o painel avisa. Use 0 para desligar o alerta.</p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || name.trim().length < 2}>
              {loading ? "Criando…" : "Criar e abrir editor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
