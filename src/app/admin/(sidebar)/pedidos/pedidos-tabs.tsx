"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OrdersBoard } from "./orders-board";
import { OrdersDataTable } from "./orders-data-table";
import type { StoreOrder } from "@/generated/prisma/client";

/**
 * Transformação do Painel Admin (13/09/2026) — duas formas de olhar para
 * o MESMO array de pedidos, nunca duas fontes de dado: "Quadro" é o fluxo
 * visual de produção (arrastar entre etapas); "Tabela" é o controle denso
 * e pesquisável — ordenar, filtrar, esconder coluna, selecionar em massa,
 * exportar — o pedido explícito de "melhor que Excel para controle".
 */
export function PedidosTabs({ allOrders }: { allOrders: StoreOrder[] }) {
  return (
    <Tabs defaultValue="tabela">
      <TabsList>
        <TabsTrigger value="tabela">Tabela</TabsTrigger>
        <TabsTrigger value="quadro">Quadro</TabsTrigger>
      </TabsList>
      <TabsContent value="tabela" className="pt-4">
        <OrdersDataTable initialOrders={allOrders} />
      </TabsContent>
      <TabsContent value="quadro" className="pt-4">
        <OrdersBoard initialOrders={allOrders} />
      </TabsContent>
    </Tabs>
  );
}
