"use client";

import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/hooks/use-copy";

/**
 * Motor de Ativação (Fase 18) — sem e-mail de confirmação nenhum, esta
 * página É a única cópia do link pessoal do cliente GUEST. Um botão de
 * copiar reduz a chance de alguém (especialmente um usuário mais velho,
 * menos acostumado a selecionar/copiar texto manualmente) perder esse link
 * para sempre por não saber copiar o texto sozinho.
 *
 * Achado de auditoria (28/09/2026): usava `navigator.clipboard.writeText`
 * direto, sem tratar falha — num clipboard bloqueado (contexto inseguro,
 * permissão negada), o botão dizia "Link copiado" mesmo sem copiar nada.
 * Agora reaproveita `useCopy` (mesmo hook do cartão público em `/r/[code]`),
 * com uma segunda via e um aviso sincero quando nenhuma funciona.
 */
export function EditLinkList({ links }: { links: string[] }) {
  return (
    <div className="mt-3 space-y-2">
      {links.map((url) => (
        <EditLinkRow key={url} url={url} />
      ))}
    </div>
  );
}

function EditLinkRow({ url }: { url: string }) {
  const { state, copy } = useCopy(url);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 rounded-lg border bg-background p-2">
        <a href={url} title={url} className="min-w-0 flex-1 truncate text-left font-medium text-brand-ink underline underline-offset-2">
          {url}
        </a>
        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={copy}>
          {state === "copied" ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {state === "copied" ? "Copiado" : "Copiar"}
        </Button>
      </div>
      {state === "manual" ? (
        <p role="status" className="text-xs text-muted-foreground">
          Não deu para copiar sozinho. Toque e segure o link para copiar.
        </p>
      ) : null}
    </div>
  );
}
