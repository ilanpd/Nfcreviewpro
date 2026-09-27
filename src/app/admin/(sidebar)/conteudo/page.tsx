import { Boxes } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { STORE_PRODUCTS } from "@/lib/store-products";
import { computeStockForecast } from "@/domain/inventory/stock";
import { KpiCard } from "@nfc-os/ui";
import { ContentSettingsForm } from "./content-settings-form";
import { ReturnSwitch } from "@/components/admin/return-switch";

const STOCK_CONSUMPTION_WINDOW_DAYS = 14;

export default async function AdminContentPage() {
  const [settings, cardsCreatedRecently] = await Promise.all([
    getSiteSettings(),
    prisma.nFCCard.count({ where: { createdAt: { gte: new Date(Date.now() - STOCK_CONSUMPTION_WINDOW_DAYS * 24 * 60 * 60 * 1000) } } }),
  ]);

  const stock = settings?.blankChipStock ?? 0;
  const lowStockThreshold = settings?.lowStockThreshold ?? 20;
  const forecast = computeStockForecast(stock, cardsCreatedRecently);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conteúdo do site</h1>
        <p className="text-sm text-muted-foreground">
          Vídeo da home e fotos/preços da loja — o que muda aqui aparece direto no site público, sem deploy.
        </p>
      </div>

      <KpiCard
        label="Chips NFC em branco"
        value={forecast.daysRemaining !== null ? `${forecast.daysRemaining} dias` : `${stock} unidades`}
        icon={<Boxes />}
        valueClassName={stock < lowStockThreshold ? "text-amber-600 dark:text-amber-400" : undefined}
        hint={
          forecast.daysRemaining !== null
            ? `${stock} unidades em estoque · consumo de ${forecast.dailyConsumption.toFixed(1)}/dia (últimos ${STOCK_CONSUMPTION_WINDOW_DAYS} dias)`
            : `${stock} unidades em estoque · sem consumo recente para estimar duração`
        }
        className="max-w-sm"
      />

      <ReturnSwitch
        endpoint="/api/admin/return/kill-switch"
        initialEnabled={settings?.returnOfferEnabled ?? true}
        label="Retorno ligado para todas as empresas"
        description="Interruptor geral de emergência. Desligado, nenhum brinde novo é emitido e nenhum resgate passa, em todas as empresas, na hora. Os cartões voltam ao comportamento de antes."
        confirmOff="Desligar o Retorno para TODAS as empresas agora? Nenhum brinde será emitido nem resgatado até você ligar de novo."
      />

      <ContentSettingsForm
        initialHeroVideoUrl={settings?.heroVideoUrl ?? ""}
        initialOverrides={(settings?.storeProductOverrides as Record<string, { imageUrl?: string; unitPriceCents?: number }>) ?? {}}
        products={STORE_PRODUCTS}
        initialBlankChipStock={settings?.blankChipStock ?? 0}
        initialLowStockThreshold={settings?.lowStockThreshold ?? 20}
      />
    </div>
  );
}
