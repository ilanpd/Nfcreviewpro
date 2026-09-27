import Link from "next/link";
import { Download, ExternalLink, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnalyticsCard, EmptyState } from "@nfc-os/ui";
import { cardTestPath } from "@/lib/card-url";

/**
 * "Prévia ao vivo" e "Placa para imprimir" (F5 do plano). A prévia é a
 * própria \`/r/[code]/teste\` (C6) — nenhuma segunda implementação da tela do
 * cliente para manter sincronizada. A placa reaproveita a Impressão
 * Profissional da Fase 10 (\`/api/cards/[id]/print\`), cujo texto agora
 * reflete o que o cartão realmente faz (ADR-082), não mais um "avalie sua
 * experiência" fixo.
 */
export function PreviewCard({ card }: { card: { id: string; uniqueCode: string } | null }) {
  return (
    <AnalyticsCard title="Ver e testar" description="A mesma tela que o cliente vê, e a placa para colocar ao lado do cartão.">
      {!card ? (
        <EmptyState icon={<QrCode />} title="Adicione um cartão primeiro" description="A prévia e a placa usam o QR de um cartão real da sua empresa." />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={cardTestPath(card.uniqueCode)} target="_blank" rel="noopener">
              <ExternalLink className="size-4" /> Testar no celular
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/cards/${card.id}/print?template=table-tent`} target="_blank" rel="noopener">
              <Download className="size-4" /> Baixar placa (tenda de mesa)
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/cards/${card.id}/print?template=sticker`} target="_blank" rel="noopener">
              <Download className="size-4" /> Baixar adesivo
            </a>
          </Button>
        </div>
      )}
    </AnalyticsCard>
  );
}
