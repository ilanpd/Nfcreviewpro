# @nfc-os/sdk

SDK oficial (JavaScript/TypeScript) para a [API pública do NFC OS](../../../docs/api-v1.md).

## Status honesto desta Fase 9

Este pacote é um SDK real e completo — tipagem de ponta a ponta, autopaginação,
tratamento de erro tipado (`NFCOSApiError`), idempotência — mas **não está
publicado no npm**. Não existe uma conta/organização npm nem um pipeline de CI
de publicação configurado para este produto neste momento; publicar aqui seria
fingir uma distribuição que não existe. Ver ADR-036.

Duas formas reais de usar isto hoje:

1. **De dentro deste monorepo** (ex.: o Playground em `/developers`): importe
   diretamente via o alias `@nfc-os/sdk`, exatamente como `packages/ui`.
2. **Fora deste monorepo**: copie a pasta `packages/sdk/src` para o seu
   projeto — o pacote não tem nenhuma dependência de runtime (só `fetch`
   nativo), então funciona em Node 18+ e no navegador sem alteração.

Quando este produto tiver uma conta npm real, publicar este pacote existente é
uma mudança de configuração (`npm publish` + remover `"private": true`), não
uma reescrita.

## Uso

```ts
import { NFCOS } from "@nfc-os/sdk";

const nfc = new NFCOS({
  apiKey: process.env.NFC_API_KEY!,
  baseUrl: "https://sua-empresa.nfcos.app/api/v1", // obrigatório fora do mesmo domínio
});

const { data: cards } = await nfc.cards.list();
await nfc.campaigns.activate("cmp_123");

// Idempotência em criações:
await nfc.cards.create({ name: "Mesa 12" }, { idempotencyKey: crypto.randomUUID() });

// Autopaginação:
for await (const card of nfc.cards.autoPaginate()) {
  console.log(card.name);
}

// Erros tipados:
try {
  await nfc.cards.get("id-que-nao-existe");
} catch (err) {
  if (err instanceof NFCOSApiError) {
    console.error(err.code, err.message, err.requestId);
  }
}
```
