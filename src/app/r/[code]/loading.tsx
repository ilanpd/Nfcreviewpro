/**
 * Estado de carregamento do cartão público (Auditoria de Performance,
 * 28/09/2026) — a página mais tocada do produto (todo toque físico de NFC/QR
 * cai aqui primeiro) é `force-dynamic` e faz pelo menos duas consultas
 * (resolver a campanha, carregar o Retorno) antes de decidir o que mostrar —
 * e era a ÚNICA rota pública sem nenhum `loading.tsx`: numa rede de loja
 * lenta, o cliente encostava o celular e via uma tela em branco, sem
 * nenhuma confirmação de que algo estava acontecendo. Neutro de propósito
 * (nunca a cor da marca do dono — ainda não foi resolvida neste ponto).
 */
export default function CardLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="skeleton-shimmer size-14 rounded-full bg-muted" />
        <div className="flex w-full flex-col items-center gap-2">
          <div className="skeleton-shimmer h-4 w-40 rounded bg-muted" />
          <div className="skeleton-shimmer h-3 w-56 rounded bg-muted" />
        </div>
        <div className="skeleton-shimmer h-12 w-full rounded-xl bg-muted" />
      </div>
    </main>
  );
}
