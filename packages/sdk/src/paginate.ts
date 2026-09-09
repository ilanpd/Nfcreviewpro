import type { Page } from "./types";

/**
 * Percorre todas as páginas de um recurso automaticamente — o padrão que
 * todo SDK decente (Stripe incluído) oferece para não forçar o
 * desenvolvedor a escrever o loop de `cursor`/`has_more` manualmente. Uso:
 *
 * ```ts
 * for await (const card of nfc.cards.autoPaginate()) { ... }
 * ```
 */
export async function* autoPaginate<T>(fetchPage: (cursor?: string) => Promise<Page<T>>): AsyncGenerator<T, void, unknown> {
  let cursor: string | undefined;
  while (true) {
    const page = await fetchPage(cursor);
    for (const item of page.data) yield item;
    if (!page.has_more || !page.next_cursor) return;
    cursor = page.next_cursor;
  }
}
