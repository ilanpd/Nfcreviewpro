/**
 * Estoque de placas (ADR-092) — o que aparece quando alguém toca ou escaneia
 * uma placa que ainda não foi entregue a nenhum cliente. É também a prova da
 * conferência: a série mostrada aqui tem que ser a impressa na própria placa,
 * tanto pelo NFC quanto pelo QR. Só expõe a série (que já está impressa na
 * placa) — nada de lote, modelo ou datas.
 */
export function UnassignedPlateScreen({ serial, retired }: { serial: string; retired: boolean }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Pulse Smart Link</p>
      <p className="font-mono text-4xl font-semibold tracking-wider">{serial}</p>
      <p className="text-lg font-semibold">{retired ? "Placa fora de uso" : "Placa ainda não ativada"}</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        {retired
          ? "Esta placa foi retirada de circulação. Fale com quem a entregou para receber uma nova."
          : "Esta placa ainda não foi ligada a um negócio. Se ela foi entregue a você, fale com quem a vendeu para ativá-la."}
      </p>
    </main>
  );
}
