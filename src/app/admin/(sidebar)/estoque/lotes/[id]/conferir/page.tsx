import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getBatchDetail } from "@/services/plates.service";
import { PlateChecklist } from "./plate-checklist";

export const dynamic = "force-dynamic";

export default async function ConferirLotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getBatchDetail(id);
  if (!detail) notFound();

  return (
    <div className="space-y-4">
      <Link href={`/admin/estoque/lotes/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar ao lote {detail.batch.code}
      </Link>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Conferir lote {detail.batch.code}</h2>
        <p className="text-sm text-muted-foreground">Use o celular com as placas na mão. Para cada placa, faça os três testes e toque no que deu certo.</p>
      </div>
      <ol className="list-decimal space-y-1 rounded-xl border bg-muted/30 p-4 pl-8 text-sm">
        <li>
          <strong>NFC:</strong> encoste o celular na placa. Tem que abrir uma página com a série dela. Marque <em>NFC</em>.
        </li>
        <li>
          <strong>QR:</strong> escaneie o QR com a câmera. Tem que abrir a página com a <strong>mesma</strong> série. Marque <em>QR</em>.
        </li>
        <li>
          <strong>Série:</strong> compare a série da tela com o número impresso na placa. Se bater, marque <em>Série</em>.
        </li>
      </ol>
      <p className="text-xs text-muted-foreground">
        Com as três marcas, a placa vira <em>conferida</em> e entra no estoque. Se o NFC ou o QR abrir a série de OUTRA placa, é o erro mais caro: marque como defeituosa e avise a gráfica.
      </p>
      <PlateChecklist plates={detail.plates} />
    </div>
  );
}
