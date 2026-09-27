"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Motor de Ativação (Fase 18) — sem e-mail de confirmação nenhum, esta
 * página É a única cópia do link pessoal do cliente GUEST. Um botão de
 * copiar reduz a chance de alguém (especialmente um usuário mais velho,
 * menos acostumado a selecionar/copiar texto manualmente) perder esse link
 * para sempre por não saber copiar o texto sozinho.
 */
export function EditLinkList({ links }: { links: string[] }) {
  function copy(url: string) {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  }

  return (
    <div className="mt-3 space-y-2">
      {links.map((url) => (
        <div key={url} className="flex items-center gap-2 rounded-lg border bg-background p-2">
          <a href={url} className="min-w-0 flex-1 truncate text-left font-medium text-brand-ink underline underline-offset-2">
            {url}
          </a>
          <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => copy(url)}>
            <Copy className="size-3.5" /> Copiar
          </Button>
        </div>
      ))}
    </div>
  );
}
