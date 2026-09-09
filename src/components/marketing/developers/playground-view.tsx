"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiExplorer } from "./api-explorer";
import { PUBLIC_WEBHOOK_EVENT_TYPES } from "@/domain/api-v1/webhook-events";

const QUICKSTART: Record<string, string> = {
  curl: `curl https://sua-empresa.nfcos.app/api/v1/cards \\
  -H "Authorization: Bearer nfc_live_sua_chave"`,
  javascript: `import { NFCOS } from "@nfc-os/sdk";

const nfc = new NFCOS({ apiKey: process.env.NFC_API_KEY });
const { data: cards } = await nfc.cards.list();
await nfc.campaigns.activate("cmp_123");`,
  typescript: `import { NFCOS, type NFCCard } from "@nfc-os/sdk";

const nfc = new NFCOS({ apiKey: process.env.NFC_API_KEY! });
const { data: cards }: { data: NFCCard[] } = await nfc.cards.list();`,
  node: `const res = await fetch("https://sua-empresa.nfcos.app/api/v1/cards", {
  headers: { Authorization: \`Bearer \${process.env.NFC_API_KEY}\` },
});
const { data: cards } = await res.json();`,
};

const RESOURCES: { method: string; path: string; scope: string; description: string }[] = [
  { method: "GET/POST", path: "/cards", scope: "cards:read / cards:write", description: "Ativos NFC (mesas)." },
  { method: "GET/PATCH/DELETE", path: "/cards/:id", scope: "cards:read / cards:write", description: "Um cartão específico." },
  { method: "GET/POST", path: "/campaigns", scope: "campaigns:read / campaigns:write", description: "Campanhas." },
  { method: "GET/PATCH/DELETE", path: "/campaigns/:id", scope: "campaigns:read / campaigns:write", description: "Uma campanha — PATCH { status } ativa/pausa." },
  { method: "GET/POST", path: "/campaigns/:id/assignments", scope: "campaigns:read / campaigns:write", description: "Atribuições de uma campanha." },
  { method: "DELETE", path: "/campaigns/:id/assignments/:id", scope: "campaigns:write", description: "Remove uma atribuição." },
  { method: "GET/POST", path: "/zones", scope: "zones:read / zones:write", description: "Zonas (ex.: Varanda, VIP)." },
  { method: "GET/PATCH/DELETE", path: "/zones/:id", scope: "zones:read / zones:write", description: "Uma zona específica." },
  { method: "GET/POST", path: "/branches", scope: "branches:read / branches:write", description: "Unidades." },
  { method: "GET/PATCH/DELETE", path: "/branches/:id", scope: "branches:read / branches:write", description: "Uma unidade específica." },
  { method: "GET/POST/PATCH", path: "/organizations", scope: "organizations:read / organizations:write", description: "A organização desta empresa (recurso singular)." },
  { method: "GET", path: "/analytics/kpis", scope: "analytics:read", description: "KPIs executivos." },
  { method: "GET", path: "/analytics/funnel", scope: "analytics:read", description: "Funil de conversão." },
  { method: "GET", path: "/analytics/rankings", scope: "analytics:read", description: "Rankings por campanha/zona/mesa/funcionário/horário/dia." },
  { method: "GET", path: "/events", scope: "events:read", description: "Eventos de domínio (EventLog) desta empresa." },
  { method: "GET/PATCH", path: "/feedback", scope: "feedback:read / feedback:write", description: "Feedbacks privados." },
  { method: "GET/POST", path: "/webhooks", scope: "webhooks:manage", description: "Endpoints de webhook." },
  { method: "GET/PATCH/DELETE", path: "/webhooks/:id", scope: "webhooks:manage", description: "Um endpoint específico." },
  { method: "GET", path: "/webhooks/:id/deliveries", scope: "webhooks:manage", description: "Histórico de entregas." },
  { method: "POST", path: "/webhooks/:id/deliveries/:id/replay", scope: "webhooks:manage", description: "Reenvia uma entrega." },
];

function copy(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copiado");
}

export function PlaygroundView({ demoApiKey }: { demoApiKey: string }) {
  const [lang, setLang] = useState("curl");

  return (
    <div className="mx-auto max-w-5xl space-y-16 px-6 py-16">
      <section className="space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">API pública v1</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Construa sobre o NFC OS</h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          REST API versionada, SDK oficial em TypeScript, webhooks assinados e um explorador ao vivo — a mesma API que move o
          próprio produto.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Comece em 1 minuto</h2>
        <Tabs value={lang} onValueChange={setLang}>
          <TabsList>
            <TabsTrigger value="curl">cURL</TabsTrigger>
            <TabsTrigger value="javascript">JavaScript</TabsTrigger>
            <TabsTrigger value="typescript">TypeScript</TabsTrigger>
            <TabsTrigger value="node">Node (fetch)</TabsTrigger>
          </TabsList>
          {Object.entries(QUICKSTART).map(([key, code]) => (
            <TabsContent key={key} value={key}>
              <div className="relative rounded-lg bg-neutral-950 p-4">
                <Button size="sm" variant="ghost" className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-100" onClick={() => copy(code)}>
                  <Copy className="size-3.5" />
                </Button>
                <pre className="overflow-x-auto text-xs text-neutral-100">
                  <code>{code}</code>
                </pre>
              </div>
            </TabsContent>
          ))}
        </Tabs>
        <p className="text-sm text-muted-foreground">
          Crie sua chave em <span className="font-medium text-foreground">Dashboard → Desenvolvedores</span> depois de entrar
          na sua conta.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Terminal className="size-5 text-brand" />
          <h2 className="text-xl font-semibold">Explorador de API — teste ao vivo</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Sem cadastro: as chamadas abaixo usam uma chave de demonstração somente-leitura contra a empresa fictícia
          &ldquo;Bella Vista&rdquo; — a mesma API pública, com dados reais de exemplo.
        </p>
        <ApiExplorer demoApiKey={demoApiKey} />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Referência de recursos</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Método</th>
                <th className="px-4 py-2">Caminho</th>
                <th className="px-4 py-2">Escopo</th>
                <th className="px-4 py-2">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {RESOURCES.map((r) => (
                <tr key={r.path + r.method} className="border-t border-border">
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{r.method}</td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">/api/v1{r.path}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{r.scope}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Toda lista é paginada por cursor: <code className="rounded bg-muted px-1 py-0.5">{"{ data, has_more, next_cursor }"}</code>.
          Toda escrita aceita um header <code className="rounded bg-muted px-1 py-0.5">Idempotency-Key</code>. Todo erro segue{" "}
          <code className="rounded bg-muted px-1 py-0.5">{"{ error: { code, message, request_id } }"}</code>.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Webhooks</h2>
        <p className="text-sm text-muted-foreground">
          Assine os eventos que quiser em <span className="font-medium text-foreground">Dashboard → Desenvolvedores → Webhooks</span>. Toda
          entrega é assinada com HMAC-SHA256 no header <code className="rounded bg-muted px-1 py-0.5">X-NFC-OS-Signature</code>, com
          retry exponencial e histórico completo (com reenvio manual).
        </p>
        <div className="flex flex-wrap gap-2">
          {PUBLIC_WEBHOOK_EVENT_TYPES.map((event) => (
            <code key={event} className="rounded-full border border-border px-3 py-1 text-xs">
              {event}
            </code>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-8 text-center">
        <h2 className="text-xl font-semibold">Pronto para integrar de verdade?</h2>
        <p className="mt-2 text-sm text-muted-foreground">Crie sua conta e gere sua primeira chave de API em minutos.</p>
        <Button asChild className="mt-4">
          <Link href="/sign-up">Começar grátis</Link>
        </Button>
      </section>
    </div>
  );
}
