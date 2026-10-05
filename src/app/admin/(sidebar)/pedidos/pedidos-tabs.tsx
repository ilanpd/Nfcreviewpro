"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OrdersBoard } from "./orders-board";
import { OrdersList, type StageFilter } from "./orders-list";
import type { PlateCoverage } from "./order-stage-control";
import type { StoreOrder } from "@/generated/prisma/client";

export type OrdersView = "lista" | "quadro";

/**
 * Duas formas de olhar para o MESMO array de pedidos, nunca duas fontes de dado:
 * "Lista" é o dia a dia (filtrar por etapa, avançar, atribuir placa na própria
 * linha); "Quadro" é a produção em colunas (arrastar entre etapas). A aba inicial
 * vem da URL (`?visao=`), então um link do Centro de Operações cai na tela certa.
 */
export function PedidosTabs({ allOrders, plateCoverage, initialStage, initialView }: { allOrders: StoreOrder[]; plateCoverage: Record<string, PlateCoverage>; initialStage: StageFilter; initialView: OrdersView }) {
  const [view, setView] = useState<OrdersView>(initialView);
  useEffect(() => setView(initialView), [initialView]);

  return (
    <Tabs value={view} onValueChange={(v) => setView(v as OrdersView)}>
      <TabsList>
        <TabsTrigger value="lista">Lista</TabsTrigger>
        <TabsTrigger value="quadro">Quadro</TabsTrigger>
      </TabsList>
      <TabsContent value="lista" className="pt-4">
        <OrdersList initialOrders={allOrders} plateCoverage={plateCoverage} initialStage={initialStage} />
      </TabsContent>
      <TabsContent value="quadro" className="pt-4">
        <OrdersBoard initialOrders={allOrders} />
      </TabsContent>
    </Tabs>
  );
}
