import "server-only";

/**
 * White Label (Fase 10) — verificação real de posse de domínio via
 * DNS-over-HTTPS (Cloudflare `1.1.1.1`), sem nenhuma dependência nova: uma
 * chamada `fetch` comum, o mesmo runtime que todo o resto do produto já
 * usa (ex.: o worker de webhooks da Fase 8). Nenhuma biblioteca de DNS
 * nativo (`node:dns`) é usada de propósito — DNS-over-HTTPS funciona em
 * qualquer ambiente serverless sem exigir sockets UDP, que nem todo
 * provedor libera. Ver ADR-042.
 */
export async function lookupTxtRecord(name: string): Promise<string[]> {
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { Answer?: { data: string }[] };
    return (data.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, ""));
  } catch (err) {
    console.error("[white-label] falha ao consultar DNS-over-HTTPS", err);
    return [];
  }
}
