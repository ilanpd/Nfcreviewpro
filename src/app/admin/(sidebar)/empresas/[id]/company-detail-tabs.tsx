"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/**
 * Fase 19.7 — separa a ficha da empresa (CRM, Fase 19.4) da Central do
 * Cliente (pedidos/feedback/timeline agregados, Fase 19.7) em abas, em vez
 * de empilhar tudo na mesma rolagem — mesmo padrão de `PedidosTabs`
 * (`admin/pedidos`). `overview`/`central` chegam já renderizados pelo
 * Server Component pai (`page.tsx`) — este wrapper só troca qual metade
 * fica visível, nunca busca dado sozinho.
 */
export function CompanyDetailTabs({ overview, central }: { overview: React.ReactNode; central: React.ReactNode }) {
  return (
    <Tabs defaultValue="visao-geral">
      <TabsList>
        <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
        <TabsTrigger value="central">Central do cliente</TabsTrigger>
      </TabsList>
      <TabsContent value="visao-geral" className="space-y-6 pt-4">
        {overview}
      </TabsContent>
      <TabsContent value="central" className="space-y-6 pt-4">
        {central}
      </TabsContent>
    </Tabs>
  );
}
