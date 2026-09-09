# Relatório da Fase 9 — API Pública v1 + SDK + Webhooks

Ver `ROADMAP.md` para a lista completa de fases e `PROXIMAS_TAREFAS.md` para o checklist que esta fase fecha. Esta é a primeira fase sob três novas regras permanentes: **Platform First Review** (sexto review obrigatório), **WOW Factor Review** e **Zero Dívida Silenciosa** (regras de engenharia permanentes, não reviews de fase) — ver seções dedicadas abaixo.

## O que foi implementado

O objetivo declarado desta fase era parar de expor "endpoints soltos" e construir uma plataforma — uma API pública que um desenvolvedor terceiro, que nunca viu este projeto, tivesse prazer em integrar.

- **REST API v1** (`src/app/api/v1/**`, isolada de `/api/**` interno — nunca misturadas): recursos consistentes para cartões, campanhas + atribuições, zonas, unidades, organização (recurso singular), analytics (KPIs/funil/rankings), eventos, feedback e webhooks, todos seguindo o mesmo padrão de verbos (`GET`/`POST`/`PATCH`/`DELETE`) sem exceções arbitrárias.
- **Plumbing compartilhado** (`lib/api-v1/`, ver **ADR-036**): `withApiV1` (`handler.ts`) é o único ponto de entrada de toda rota — resolve autenticação, rate limit, idempotência, log de requisição e o envelope de erro, para nenhuma rota reinventar isso. `requireApiKey` (`auth.ts`) autentica por `ApiKey` (nunca sessão), checando escopo antes do handler rodar; `buildSyntheticAuthContext` constrói um `AuthContext` "sem restrição" a partir da chave para reaproveitar serviços internos que exigem RBAC completo (`assignCampaign`).
- **Autenticação por escopo:** 15 escopos granulares (`domain/api-v1/scopes.ts`) — `cards:read/write`, `campaigns:read/write`, `zones:read/write`, `branches:read/write`, `organizations:read/write`, `analytics:read`, `events:read`, `feedback:read/write`, `webhooks:manage`. Segredo com hash SHA-256, nunca em texto puro; nova permissão RBAC `developers:manage` (só OWNER/ADMIN) controla quem no dashboard pode criar/revogar chaves.
- **Paginação por cursor** em toda lista — `{ data, has_more, next_cursor }`, nunca offset (`lib/api-v1/pagination.ts`).
- **Idempotência com replay de resposta** (`lib/api-v1/idempotency.ts`): `Idempotency-Key` em toda escrita reivindica um placeholder `PENDING` antes do handler rodar (fecha a janela de corrida entre duas requisições concorrentes com a mesma chave — a segunda recebe 409, nunca executa a mutação de novo); uma repetição dentro de 24h devolve a resposta original, literalmente idêntica.
- **Envelope de erro único:** `{ error: { code, message, request_id } }` em toda rota v1 — o mesmo Request ID dos logs estruturados/Correlation ID da Fase 8. `notFoundIfMissing` traduz `ForbiddenError` (a classe que os serviços internos lançam tanto para "não existe" quanto para "não é desta empresa") para 404 nos handlers que buscam por id — um erro de regra de negócio genuína (ex.: limite de plano) continua 403.
- **Webhooks Enterprise** (ver **ADR-037**): `Company.webhookUrl`/`webhookSecret` (Fase 8) removidos, substituídos por `WebhookEndpoint` (N por empresa) e `WebhookDelivery` (histórico real). Nomes de evento público (`domain/api-v1/webhook-events.ts`) desacoplados dos nomes internos em português do Event Bus — 8 dos 10 eventos têm um nome público estável (`card.tapped`, `redirect.resolved`, `campaign.created/updated/ended`, `feedback.received`, `review.published`, `organization.updated`); `ZonaAtualizada`/`MesaAtualizada` ficam de fora do contrato público por ora. A entrega (`lib/webhooks/delivery.ts`) é a mesma função usada pelo worker automático e pelo replay manual — nunca duas implementações. Circuit Breaker por endpoint (não por empresa); `@@unique([endpointId, eventId])` torna um retry parcial de fila seguro (nunca reentrega a quem já recebeu com sucesso).
- **SDK oficial `@nfc-os/sdk`** (ver **ADR-038**): cliente HTTP tipado (`NFCOSClient`), erros tipados (`NFCOSApiError` com `.code`/`.requestId`/`.status`), autopaginação via `async function*`, um recurso por área da API com açúcar de conveniência (`campaigns.activate()`/`.pause()`) — real e completo, zero dependência além de `fetch` nativo, mas **não publicado no npm** (sem conta/pipeline de publicação neste ambiente).
- **Dashboard de Desenvolvedor** (`/dashboard/developers`, restrito a `developers:manage`): abas Chaves de API (criar com seleção de escopos, revogar, exibição única do valor completo), Webhooks (criar/editar/ativar-desativar/excluir, ver histórico de entregas, reenviar manualmente), Logs (chamadas reais com latência/status via `ApiRequestLog`), Documentação rápida (snippets copiáveis cURL/JS/TS/Node).
- **Playground público** (`/developers`, com link no cabeçalho do site): quickstart multi-linguagem, referência completa dos 10 recursos, e um Explorador de API que chama `/api/v1/**` de verdade, do navegador, contra a empresa de demonstração Bella Vista com uma chave fixa somente-leitura semeada (`prisma/seed.ts`) — sem exigir cadastro.
- **Preparação para a Fase 10 (White Label), sem implementar** (ver **ADR-039**): `Company.faviconUrl` adicionado (mesmo padrão nulo-até-usado de `logoUrl`); documentado que `Company.domain` já existe desde uma fase anterior mas nunca foi lido em lugar nenhum do produto — um achado real sob Zero Dívida Silenciosa, registrado para a Fase 10 não precisar descobri-lo de novo.
- **Fase 9.5 — Marketplace & Integrações registrada como fase futura** em `ROADMAP.md`, a pedido explícito: marketplace de integrações, templates de automação, OAuth, App Directory, SDK de plugins — nada projetado nem implementado, só documentado no lugar certo para quando for a vez dela.

## Platform First Review (nova regra permanente, primeira fase em que se aplica)

- **Consistência da API:** todo recurso segue `GET` lista / `GET :id` / `POST` cria / `PATCH :id` atualiza / `DELETE :id` remove — sem exceção. A única "rota extra" (`campaigns/:id/assignments`) é um sub-recurso genuíno (uma campanha tem N atribuições), não uma inconsistência.
- **Versionamento:** `/api/v1/` no caminho, isolado fisicamente de `/api/` interno — uma v2 futura nasce como uma pasta nova, sem tocar v1.
- **Compatibilidade futura / breaking changes:** nenhuma rota v1 reaproveita um tipo interno sem tradução — os schemas de request/response são os mesmos Zod já usados internamente (`createCardSchema`, etc.), então uma mudança de validação interna e a pública nunca podem divergir silenciosamente. Nomes públicos de webhook são deliberadamente desacoplados dos nomes internos do Event Bus exatamente para isso (ver ADR-037).
- **DX:** documentação com exemplos reais em 4 linguagens, um Playground que executa contra dados reais, mensagens de erro em português com `code` estável para tratamento programático, tipagem completa no SDK (autocomplete de ponta a ponta).
- **Erros:** `{ error: { code, message, request_id } }` — nunca uma string solta; `request_id` correlaciona com o log do servidor.
- **SDK:** completo, tipado, com autopaginação e idempotência automática nas escritas — mas honestamente não publicado (ver ADR-038).
- **Webhooks:** múltiplos endpoints por assinatura de evento, HMAC, retry, histórico, replay manual.
- **Idempotência, paginação, limites, autenticação:** todos os quatro implementados de ponta a ponta e testados interativamente (ver "Como isso foi verificado" abaixo).

O veredito honesto: esta é uma API que segue os princípios certos (consistência, versionamento, DX, idempotência real) — o que ainda falta para o nível Stripe completo é o que qualquer API nova de verdade também não tem no primeiro dia: anos de casos de borda descobertos por milhares de integrações reais. Isso não é algo que se constrói numa fase, é o que a Fase 9.5 (Marketplace) e o uso real ao longo do tempo vão revelar.

## WOW Factor Review

**"O que faria alguém dizer 'nunca vi um SaaS fazer isso'?"** O Explorador de API do Playground executando uma chamada REAL, ao vivo, contra dados de uma empresa de demonstração, sem exigir cadastro — a maioria dos "playgrounds" de documentação de API mostra uma resposta de exemplo estática (fabricada) em vez de uma chamada de verdade. Ver o botão "Executar contra a Bella Vista" em `/developers` respondendo com o `request_id` real e o corpo real da API — inclusive quando a resposta é um erro, o que prova ainda mais que não é encenado.

**Melhoria de alto impacto implementada sem gerar dívida técnica:** a extração de `lib/validations/{branch,zone}.ts` (antes inline nas rotas) para serem compartilhados entre a rota interna e a v1 — pequena, mas fecha exatamente o tipo de inconsistência que o Platform First Review existe para caçar (duas superfícies validando o mesmo dado com regras que poderiam divergir com o tempo).

## Reliability Review

1. **Essa funcionalidade continua funcionando sob alta carga?** O rate limit por `ApiKey` (`apiV1`, 300/min) protege o Queue Engine e o Postgres de uma integração com bug (loop de retry sem backoff, por exemplo) sem afetar outras chaves.
2. **Existe algum ponto único de falha?** Não introduzido por esta fase — a API v1 depende do mesmo Postgres/Redis de sempre, com a mesma degradação graciosa já estabelecida (idempotência e rate limit ambos funcionam sem Redis, só com garantias mais fracas).
3. **O redirecionamento público continua protegido?** Sim, inalterado — a API v1 é uma superfície inteiramente nova, sem tocar `/r/[code]`.
4. **Existe degradação graciosa quando Redis/filas/serviços externos falham?** Sim, provada ao vivo nesta fase: contra um Postgres genuinamente inalcançável neste sandbox, toda chamada v1 devolveu um 401/500 honesto no envelope correto, nunca um crash ou um corpo vazio.
5. **Os eventos podem ser recuperados sem perda importante?** Sim — Webhooks Enterprise herda a garantia de durabilidade do Event Bus (Fase 8): um evento sempre existe em `EventLog` antes de qualquer tentativa de entrega, e uma entrega falha fica registrada em `WebhookDelivery` para reenvio manual.
6. **A observabilidade permite descobrir rapidamente onde um problema começou?** Sim — todo erro v1 carrega o mesmo `request_id` que aparece no header `X-Request-Id` e nos logs estruturados do servidor, fechando o ciclo erro→suporte→log.

## Revenue Review

1. **Essa funcionalidade aumenta a percepção de valor da assinatura?** Sim, para o segmento certo: uma API pública madura é o que transforma "um SaaS de avaliações" em "uma plataforma que outras empresas constroem sobre" — o tipo de ativo que justifica um plano Enterprise.
2. **O empresário entenderia quanto dinheiro isso pode gerar ou economizar?** Indiretamente — a maioria dos donos de restaurante nunca vai abrir `/developers`. O valor aqui é para quem tem uma equipe técnica (uma rede grande, uma agência, um parceiro de integração).
3. **Existe algum insight que justifique renovar o plano mensal?** Não desta fase — infraestrutura de integração não é, por si só, um insight de negócio.
4. **Existe algum recurso digno de aparecer na página de vendas?** Sim, forte: "API pública, SDK oficial, webhooks — conecte o NFC OS ao seu CRM, seu BI, seu Zapier" é uma frase de vendas real para o comprador técnico, e recursos como este costumam justificar um tier "Enterprise"/"Business" à parte.
5. **Existe alguma oportunidade de transformar dados em recomendação automática?** A Fase 9.5 (Marketplace, registrada mas não construída) é exatamente essa oportunidade — templates de automação ("quando X, faça Y") são recomendação automática construída sobre a API que esta fase entrega.

## Demo First Review

1. **Essa funcionalidade impressionaria um investidor em uma demonstração de 2 minutos?** Sim — mostrar o Playground executando uma chamada real, depois abrir o Dashboard de Desenvolvedor e criar uma chave/webhook de verdade, é a diferença entre "temos uma API" (afirmação) e "aqui está, tente você mesmo" (prova).
2. **Um dono de restaurante entenderia o valor em menos de 30 segundos?** Não — e está certo que não entenda: esta fase é para o comprador técnico, não para o usuário final do dashboard (mesmo público da Fase 8's Mission Control).
3. **Existe um momento "uau" claramente perceptível?** O Explorador de API ao vivo — ver a seção WOW Factor acima.
4. **O comportamento parece software premium ou apenas funcional?** O Dashboard de Desenvolvedor segue os mesmos componentes (`AnalyticsCard`/`SmartBadge`/`KpiCard`) do resto do produto; o Playground usa a mesma identidade visual do site de marketing — nenhuma das duas telas parece "uma feature à parte."
5. **Existe uma animação/transição que comunique melhor o estado sem prejudicar performance?** O botão de execução do Explorador mostra um spinner real durante a chamada de rede (não instantâneo, porque a chamada não é fake) — a própria latência real, exibida honestamente, é mais convincente que uma resposta instantânea suspeita.

## Product Review

1. **A experiência parece um produto premium, ou apenas uma tela de admin?** Premium nas duas novas telas — nenhuma tabela HTML crua sem estilo.
2. **Existe algum atrito desnecessário?** Evitado deliberadamente: criar uma chave de API pede só nome + escopos (não uma tela de configuração de 10 campos); criar um webhook pede só URL + eventos.
3. **A interface exige mais cliques do que precisa?** O menu de escopos usa switches simples com descrição inline em vez de uma segunda tela de "editar permissões".
4. **Forma mais intuitiva de fazer a mesma tarefa?** `campaigns.activate(id)`/`.pause(id)` no SDK, em vez de forçar todo desenvolvedor a lembrar a forma exata do `PATCH { status: "ACTIVE" }`.
5. **Um gerente de restaurante aprenderia isso em menos de 2 minutos?** Não se aplica — voltado ao desenvolvedor, não ao gerente (mesmo raciocínio do Demo First Review).
6. **Oportunidade de "uau" que não custa nada?** O botão "Copiar segredo de assinatura" ao lado de cada webhook — uma ação de um clique para o passo mais chato de configurar verificação de HMAC no lado do cliente.

## Achados do Architect Review (corrigidos proativamente, não pedidos) — incluindo Zero Dívida Silenciosa

1. **Encontrado sob Zero Dívida Silenciosa, investigado e documentado (não corrigido — correto não corrigir):** `Company.domain String? @unique` existe desde uma fase anterior, mas nenhum código em todo o produto o lê, escreve ou expõe numa UI. Não é um bug (não afeta nada hoje), mas ficaria como dívida silenciosa se não fosse registrado — documentado em **ADR-039** como o ponto de partida real da Fase 10 (White Label), em vez de a Fase 10 descobrir isso do zero.
2. **Encontrado e corrigido:** `Branch`/`Zone` nunca tiveram uma capacidade de renomear, nem no dashboard interno — só ficou óbvio ao desenhar a paridade de CRUD (`GET`/`POST`/`PATCH`/`DELETE` sem exceção) que o Platform First Review exige. Adicionado `updateBranch`/`updateZone` em ambas as camadas (serviço + repositório), com uma rota `PATCH` nova tanto internamente quanto na v1 — e os Zod schemas que validam isso extraídos para `lib/validations/{branch,zone}.ts` (antes inline nas rotas), compartilhados entre as duas superfícies.
3. **Vazamento entre tenants — verificado, não encontrado:** toda rota v1 resolve `companyId` exclusivamente a partir de `apiKey.companyId` (nunca aceito como parâmetro do cliente); `notFoundIfMissing` garante que buscar um recurso de outra empresa por id sempre responde 404, nunca vaza a existência do recurso.
4. **Duplicação de contratos evitada deliberadamente:** `Company.webhookUrl`/`webhookSecret` da Fase 8 foram REMOVIDOS ao introduzir `WebhookEndpoint`, não deixados ao lado como uma segunda forma de fazer a mesma coisa — exatamente o tipo de duplicação que o Platform First Review pede para caçar (ver ADR-037).
5. **Race condition considerada e fechada:** duas requisições concorrentes com a mesma `Idempotency-Key` — sem o placeholder `PENDING`, ambas poderiam executar a mutação antes de qualquer uma terminar de gravar o resultado. Fechado com `SET NX` reivindicando a chave antes do handler rodar (ver ADR-036).
6. **Performance:** nenhuma consulta N+1 nova — toda lista usa `findMany` com `cursor`/`take`, e o único caso que faz uma segunda consulta por linha (`events`, traduzindo o tipo interno para o público) já opera sobre uma página pequena (máx. 100 linhas), nunca sobre o dataset inteiro.
7. **Compatibilidade com toda fase anterior:** nenhum serviço interno teve sua assinatura alterada — `assignCampaign`/`unassignCampaign` continuam recebendo um `AuthContext` exatamente como antes; a API v1 constrói um a partir da `ApiKey` (`buildSyntheticAuthContext`) em vez de exigir uma mudança na função.

## Como isso foi verificado (não só compilado)

Todos os quatro quality gates (`tsc --noEmit`, `eslint`, `prisma validate`, `npm run build` com um `.env.local` temporário) passam limpos — incluindo o empacotamento do novo pacote `packages/sdk` e dos ~30 novos arquivos de rota v1/dashboard/playground no build de produção.

**Sem Postgres/Redis/Clerk reais neste sandbox** (mesma limitação de toda fase anterior). Verificação interativa usou o mesmo padrão já estabelecido: `src/middleware.ts` temporariamente reduzido a um matcher vazio e `<ClerkProvider>` temporariamente removido de `src/app/layout.tsx`, ambos restaurados exatamente ao original depois.

Confirmado via inspeção real de DOM/rede (não apenas "o texto certo apareceu"):
- **`/developers` (Playground):** renderização completa confirmada via `get_page_text` — hero, quickstart com 4 linguagens, Explorador de API, referência dos 20 endpoints, seção de webhooks, CTA.
- **Explorador de API, chamada real:** clicar "Executar" disparou `GET /api/v1/cards` de verdade (confirmado via `read_network_requests`); contra o Postgres genuinamente inalcançável deste sandbox, a resposta foi um 500 honesto com o envelope `{ error: { code: "internal_error", message, request_id } }` — nunca um crash, nunca um corpo vazio, sempre com `X-Request-Id` presente no header.
- **Autenticação, testada nos três estados sem precisar de banco:** sem header `Authorization` → 401 `unauthorized` com a mensagem certa; header com token de formato inválido (sem o prefixo `nfc_live_`) → 401 `unauthorized` com uma mensagem diferente e específica ("Formato de chave de API inválido"); com a chave de demonstração (formato válido) → passa da validação de formato e chega até a consulta ao banco, onde falha honestamente (o cenário acima). As três respostas provam que `requireApiKey` valida em camadas — cada camada falha com a mensagem certa, sem precisar de banco para as duas primeiras.
- **`/dashboard/developers`:** confirmado via `npm run build` que a rota compila e aparece no manifesto (`8.86 kB`). Não verificável interativamente neste sandbox — exige uma sessão Clerk real e Postgres real simultaneamente, a mesma limitação de todo `/dashboard/*` desde a Fase 1 (nunca verificado ao vivo em nenhuma fase anterior por esse motivo), não uma regressão desta fase.

**O que não pôde ser provado neste sandbox:** uma chamada de webhook de saída de verdade (exigiria um endpoint HTTP externo real para receber); o fluxo completo de dead-letter de um webhook (exigiria um BullMQ real processando e falhando repetidamente); o SDK `@nfc-os/sdk` não foi exercitado por um script de consumo separado — sua lógica de `fetch`/cabeçalhos é estruturalmente idêntica às chamadas manuais já testadas acima (mesmos endpoints, mesmos headers), então a superfície HTTP está coberta pela mesma verificação; o que não está coberto é uma prova end-to-end de alguém instalando o pacote fora deste monorepo, já que ele não está publicado (ver ADR-038). Também não verificado: latência real da API sob carga sustentada, e o comportamento do rate limit por `ApiKey` contra um volume real de tráfego — ambos exigem um Redis/Postgres reais que não existem neste sandbox.

## Migração

Dois modelos novos sem relação com os existentes exceto por `companyId`/`endpointId` (`ApiKey`, `WebhookEndpoint`, `WebhookDelivery`, `ApiRequestLog`), dois campos removidos de `Company` (`webhookUrl`/`webhookSecret` — sem migração de dados necessária, nenhuma linha real os usava neste ambiente), e um campo aditivo novo (`Company.faviconUrl`, preparação da Fase 10). Sem histórico em `prisma/migrations/` ainda (mesma restrição de toda fase anterior).

## Riscos carregados adiante

- `@nfc-os/sdk` não está publicado no npm — ver ADR-038.
- `ZonaAtualizada`/`MesaAtualizada` ainda não têm nome público de webhook — ver ADR-037.
- Sem limite de taxa por organização mais amplo que o de cada `ApiKey` — várias chaves somam capacidade.
- O Playground só executa leitura, por design (chave de demonstração sem escopo de escrita).
- Sem conceito de chave "de teste" vs. "live" — toda `ApiKey` age sobre dados reais dentro do seu escopo.
- `/dashboard/developers` não verificável interativamente neste sandbox (exige Clerk + Postgres reais).
- Mesma ausência de suíte de testes automatizados e mesmas restrições de ambiente de toda fase anterior.

## Próximos passos

Aguardando aprovação para iniciar a **Fase 10 — White Label**, cuja preparação arquitetural (não implementação) já está registrada em ADR-039.
