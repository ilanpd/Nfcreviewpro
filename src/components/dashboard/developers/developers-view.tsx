"use client";

import { useState } from "react";
import { KeyRound, Webhook, ScrollText, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiKeysPanel, type ApiKeyRow } from "./api-keys-panel";
import { WebhooksPanel, type WebhookEndpointRow } from "./webhooks-panel";
import { LogsPanel, type ApiRequestLogRow, type ApiUsageSummary } from "./logs-panel";
import { DocsPanel } from "./docs-panel";

interface DevelopersViewProps {
  initialApiKeys: ApiKeyRow[];
  initialWebhooks: WebhookEndpointRow[];
  initialLogs: ApiRequestLogRow[];
  initialSummary: ApiUsageSummary;
}

/**
 * Dashboard de Desenvolvedor (Fase 9) — estilo Stripe: chaves de API,
 * webhooks e logs reais da própria empresa, mais documentação rápida com
 * snippets copiáveis. Cada aba busca/atualiza contra as rotas internas
 * `/api/api-keys`, `/api/webhooks`, `/api/api-logs` — nunca `/api/v1/**`
 * (essa é a superfície PÚBLICA; o dashboard usa sessão Clerk, não uma
 * ApiKey de si mesma).
 */
export function DevelopersView({ initialApiKeys, initialWebhooks, initialLogs, initialSummary }: DevelopersViewProps) {
  const [tab, setTab] = useState("keys");

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 sm:p-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Desenvolvedores</h1>
        <p className="text-sm text-muted-foreground">
          Chaves de API, webhooks e logs reais da API pública v1 — a mesma que qualquer integração externa usa.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="keys">
            <KeyRound className="size-3.5" /> Chaves de API
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <Webhook className="size-3.5" /> Webhooks
          </TabsTrigger>
          <TabsTrigger value="logs">
            <ScrollText className="size-3.5" /> Logs
          </TabsTrigger>
          <TabsTrigger value="docs">
            <BookOpen className="size-3.5" /> Documentação rápida
          </TabsTrigger>
        </TabsList>

        <TabsContent value="keys">
          <ApiKeysPanel initialApiKeys={initialApiKeys} />
        </TabsContent>
        <TabsContent value="webhooks">
          <WebhooksPanel initialWebhooks={initialWebhooks} />
        </TabsContent>
        <TabsContent value="logs">
          <LogsPanel initialLogs={initialLogs} initialSummary={initialSummary} />
        </TabsContent>
        <TabsContent value="docs">
          <DocsPanel />
        </TabsContent>
      </Tabs>
    </main>
  );
}
