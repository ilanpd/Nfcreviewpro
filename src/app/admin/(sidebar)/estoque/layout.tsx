import { EstoqueNav } from "./estoque-nav";

/**
 * Estoque de placas (ADR-092) — cabeçalho e abas comuns a todas as páginas do
 * módulo. Fica no `layout` (e não repetido em cada página) para a navegação
 * entre as abas não piscar o cabeçalho.
 */
export default function EstoqueLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Estoque de placas</h1>
        <p className="text-sm text-muted-foreground">
          Cada placa física (acrílico, chip NFC e QR) tem série, código e histórico. Do lote na gráfica até o cliente, nada fica sem registro.
        </p>
      </div>
      <EstoqueNav />
      {children}
    </div>
  );
}
