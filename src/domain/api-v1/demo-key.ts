/**
 * Playground público (`/developers`, Fase 9) — o valor fixo (não gerado
 * aleatoriamente) da chave de demonstração somente leitura, semeada contra
 * a empresa Bella Vista por `prisma/seed.ts`. Fica num arquivo sem
 * `"server-only"` de propósito: tanto o seed (um script standalone fora do
 * grafo de build do Next) quanto a própria página do Playground (dentro
 * dele) precisam do mesmo valor, e nenhum dos dois pode depender do outro.
 * Nunca o padrão real de geração de chave — só esta, pública e somente
 * leitura, para deixar o Playground testável sem exigir login.
 */
export const DEMO_API_KEY = "nfc_live_demo_bellavista_readonly_playground";
