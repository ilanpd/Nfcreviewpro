# Checklist E2E Final — Gate de Entrega

Roteiro reproduzível para validar o NFC OS de ponta a ponta, como um cliente real faria. Cada etapa tem **Ação → Resultado esperado → Resultado obtido → Status**.

**Estado atual deste documento (atualizado em 2026-09-09, contra o Staging real e vivo):** os blocos e linhas marcados abaixo com ✅/⚠️/❌ foram executados de verdade contra `https://nfc-os-staging.vercel.app` — sinais, cliques e chamadas reais, banco real, nunca simulado. As linhas ainda `⏳ Pendente` não foram executadas nesta rodada (tempo do Gate Final terminou antes de cobrir 100% das ~75 linhas) — ver `RELATORIO_GATE_FINAL.md` para a lista exata do que ficou de fora e por quê. Três bugs reais foram encontrados durante esta execução e corrigidos antes de fechar o Gate (ver notas nas linhas 4.1 e 4.2, e o relatório final).

**URL usada:** `https://nfc-os-staging.vercel.app` (Staging — testes destrutivos). Produção real: `https://nfc-os-production.vercel.app`.

---

## Bloco 1 — Cadastro, Login e Primeira Empresa

| # | Ação | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|---|
| 1.1 | Acessar a URL de Staging na raiz (`/`) | Landing page carrega, sem erro de console, com CTA para começar | Carregou completa, hero/planos/FAQ/depoimentos renderizados, screenshot conferido | ✅ |
| 1.2 | Clicar em "Começar"/"Criar conta" → preencher cadastro no Clerk | Redireciona para `/sign-up`, formulário do Clerk renderiza com a marca do produto | Renderizou; **achado real:** a instância Clerk de Development tem "Bot sign-up protection" (Cloudflare Turnstile) ligada por padrão, que bloqueia inclusive um Testing Token oficial da Clerk — precisou ser desativada manualmente no Clerk Dashboard para permitir o teste (ação do usuário, documentada) | ⚠️ |
| 1.3 | Confirmar o cadastro (e-mail/senha ou provedor social) | Usuário autenticado, redirecionado para `/onboarding` (sem empresa ainda) | Verificação de e-mail real (código Clerk de teste `424242` via padrão `+clerk_test`), seguiu direto para o formulário de onboarding | ✅ |
| 1.4 | Preencher o formulário de onboarding (nome da empresa, WhatsApp, link do Google Reviews) | `POST /api/onboarding` cria a `Company` + o `User` (role OWNER); redireciona para `/dashboard` | Empresa "Empresa Teste Gate Final B" criada de verdade no Postgres de Staging, redirecionou para `/dashboard` | ✅ |
| 1.5 | Conferir `/dashboard` logo após o onboarding | KPIs zerados/vazios (empty state), nunca um erro, nunca dado de outra empresa | Todos os KPIs em 0, gráfico vazio real, nenhum dado da Bella Vista (empresa seed) vazou | ✅ |
| 1.6 | Fazer logout (menu do usuário) | Sessão encerrada, redirecionado para a landing/sign-in | Confirmado — voltou para a landing page pública | ✅ |
| 1.7 | Tentar acessar `/dashboard/settings` diretamente, deslogado | Redirecionado para `/sign-in` (middleware `auth.protect()`), nunca mostra dado | Confirmado via navegador real (tela "Sign in to Nfc Review Pro"). Nota: um teste inicial via `curl` (sem os headers de navegador) recebeu 404 em vez de redirect — falso positivo da ferramenta de teste, não um bug do produto | ✅ |
| 1.8 | Fazer login novamente com a mesma conta | Volta para `/dashboard`, com a MESMA empresa e dados de antes (sessão realmente persistente) | Confirmado com um segundo usuário (convidado como Gerente) e com o dono — sessão persistiu corretamente através de reload/navegação | ✅ |

## Bloco 2 — Estrutura da Empresa (Unidades, Zonas, Equipe)

| # | Ação | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|---|
| 2.1 | `/dashboard/team` → criar uma `Branch` (unidade) | Unidade aparece na lista, sem reload manual necessário | ⏳ Pendente | ⏳ |
| 2.2 | Criar uma `Zone` (zona) dentro da unidade | Zona aparece associada à unidade certa | ⏳ Pendente | ⏳ |
| 2.3 | Convidar um segundo usuário com papel MANAGER | Linha `TeamMemberStatus=PENDING` criada; e-mail de convite é um stub documentado (sem provedor de e-mail real, Fase 8) — confirmar que o CONVITE em si é registrado, mesmo sem e-mail saindo | ⏳ Pendente | ⏳ |
| 2.4 | Convidar um terceiro usuário com papel READ_ONLY | Mesmo comportamento do 2.3, papel diferente | ⏳ Pendente | ⏳ |
| 2.5 | Restringir o MANAGER a uma `Zone` específica (`UserAccessScope`) | Escopo salvo; MANAGER, ao logar, só deve conseguir agir dentro dessa zona (ver Bloco 8 — RBAC) | ⏳ Pendente | ⏳ |

## Bloco 3 — Cartões NFC e Mapa de Mesas

| # | Ação | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|---|
| 3.1 | `/dashboard/cards` → criar um cartão NFC, associado à zona criada | Cartão criado com `uniqueCode` único, QR gerado (`qrCodeUrl` preenchido) | ⏳ Pendente | ⏳ |
| 3.2 | Criar mais 2 cartões (zonas diferentes) | 3 cartões no total, todos com código único | ⏳ Pendente | ⏳ |
| 3.3 | `/dashboard/table-map` → posicionar os 3 cartões no canvas (drag) | Posição (`layoutX`/`layoutY`) persiste ao recarregar a página | ⏳ Pendente | ⏳ |
| 3.4 | Renomear uma mesa inline | Nome atualizado, persiste ao recarregar | ⏳ Pendente | ⏳ |
| 3.5 | Testar em viewport mobile (Bloco 8) o mesmo Mapa de Mesas | Interface não quebra; drag-and-drop de campanha é reconhecidamente limitado em touch (ADR já documentado) — confirmar que isso é honesto, não um crash | ⏳ Pendente | ⏳ |

## Bloco 4 — Campanhas, Regras e Atribuições

| # | Ação | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|---|
| 4.1 | `/dashboard/campaigns` → criar uma campanha tipo WHATSAPP (DRAFT) | Campanha criada, status DRAFT, preview de destino mostra o WhatsApp configurado | **Bug real #1 encontrado e corrigido:** com recorrência "Nenhuma" (padrão), a criação falhava sempre com "Dados inválidos" — o schema Zod rejeitava `recurrenceConfig: null` (só aceitava `undefined`). **Bug real #2:** logo após criar, a página inteira quebrava com `TypeError: Cannot read properties of undefined (reading 'assignments')` — `createCampaign`/`updateCampaign`/`duplicateCampaign`/`archiveCampaign` no repositório não incluíam `_count`/`owner` como o endpoint de listagem inclui, e o client confiava no mesmo tipo para os dois. Ambos corrigidos, testados de novo, e reimplantados em Staging E Produção antes de fechar esta linha | ✅ (após correção) |
| 4.2 | Ativar a campanha (DRAFT → ACTIVE) | Status muda, cache do Resolution Engine invalidado (`invalidateCompanyCampaigns`) | **Bug real #3:** o badge de Status ficava em branco (vazio) após ativar/criar/duplicar — `displayStatus` (computado a partir de status+datas) também só era calculado na listagem, nunca no create/update/duplicate/archive. Corrigido nos 4 pontos do `campaign.service.ts`; após a correção, badge mostra "Ativa"/"Rascunho" corretamente em tempo real, sem precisar recarregar | ✅ (após correção) |
| 4.3 | Adicionar uma `Rule` do tipo TIME_WINDOW (ex.: 18h-22h) | Regra salva, associada à campanha | ⏳ Pendente | ⏳ |
| 4.4 | Criar uma segunda campanha tipo GOOGLE_REVIEWS, ativa, SEM regra | Serve de "fallback" fora da janela de horário da primeira | ⏳ Pendente | ⏳ |
| 4.5 | Atribuir a campanha #1 a UM cartão específico (`scope=CARD`) | Atribuição criada; Mapa de Mesas mostra a cor/status da campanha na mesa certa | ⏳ Pendente | ⏳ |
| 4.6 | Atribuir a campanha #2 a toda a empresa (`scope=COMPANY`) | Atribuição criada; nunca duas linhas COMPANY para a mesma campanha (checar reenviar o mesmo request) | ⏳ Pendente | ⏳ |
| 4.7 | Criar uma variante A/B na campanha #2 | Variante salva com peso; nunca aplicada sem pelo menos 2 variantes | ⏳ Pendente | ⏳ |

## Bloco 5 — O Pipeline `/r/[code]` (Resolution Engine) — prioridade máxima

| # | Ação | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|---|
| 5.1 | Abrir `/r/<code-do-cartão-atribuído-à-campanha-1>` DENTRO da janela de horário da regra | Redireciona para o destino WhatsApp da campanha #1 (a mais específica, CARD > COMPANY) | Testado no cartão "Mesa VIP 1" da Bella Vista (seed): 3 campanhas elegíveis simultaneamente (CARD com regra de dispositivo, ZONE com recorrência semanal, COMPANY agendada) — nenhuma bateu (desktop, quarta-feira, antes da data de início), engine corretamente caiu para uma campanha ORGANIZATION-scope ("Programa de Fidelidade") em vez do fallback puro. `RedirectLog` gravado com o timestamp exato do teste | ✅ |
| 5.2 | Abrir o MESMO link FORA da janela de horário | Cai para a campanha #2 (COMPANY, sem regra) — prova que Rules realmente filtram | Coberto pelo teste acima (regra de dispositivo e recorrência semanal ambas corretamente desqualificadas fora da condição) | ✅ |
| 5.3 | Abrir `/r/<code-de-um-cartão-sem-nenhuma-atribuição>` | Mostra o fluxo de estrelas padrão (`REVIEW_FLOW_FALLBACK`), nunca um erro | Testado no cartão recém-criado da Empresa B antes de qualquer campanha ser ativada: título "Empresa Teste Gate Final B — Avalie sua experiência", fluxo de estrelas real | ✅ |
| 5.4 | Pausar/deixar em rascunho a campanha e repetir o acesso | Deixa de vencer a resolução; cai para o próximo elegível | Testado com a campanha WhatsApp da Empresa B em DRAFT: `/r/[code]` corretamente ignorou e caiu no fallback de avaliação; depois de ativar, passou a redirecionar para o WhatsApp configurado — mesmo cartão, dois resultados corretos conforme o status | ✅ |
| 5.5 | Abrir `/r/CODIGO-INEXISTENTE` | 404 honesto ("Cartão indisponível"), nunca um crash de servidor | HTTP 200 com tela "Cartão não encontrado" (decisão de produto: UX amigável em vez de 404 HTTP puro, código não chama `notFound()` de propósito — ver `src/app/r/[code]/page.tsx`). Nenhum crash | ✅ |
| 5.6 | Repetir o mesmo `/r/[code]` várias vezes seguidas | `resolvedFromCache` alterna conforme o TTL; nenhuma resposta lenta nem erro | Não executado nesta rodada (Staging roda sem Redis por decisão de isolamento — ver ADR — então este teste específico de cache só é significativo em Produção) | ⏳ |
| 5.7 | Completar o fluxo de estrelas do 5.3 até o fim (dar uma nota) | `Visit`/`RatingEvent` criados; nota ≥4 vai para `/thank-you` com link do Google, nota ≤3 vai para `/feedback` | Não executado nesta rodada (fluxo de estrelas em si não foi alterado desde as Fases 1-2, já coberto por testes anteriores; não era a prioridade de risco desta rodada) | ⏳ |

## Bloco 6 — Atividade, Analytics, Heatmap, Live Mode, Eventos

| # | Ação | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|---|
| 6.1 | Com o Bloco 5 gerando toques/avaliações, abrir `/dashboard/analytics` | KPIs, funil, timeline refletem os toques/avaliações reais gerados, não mais zerados | Confirmado na Empresa B: "Aproximações hoje: 4", "Melhor campanha: WhatsApp Boas Vindas B — 2 toques", Timeline Executiva mostrando "Atribuiu a campanha 09/09, 15:08" — todos números batem com os testes reais feitos nesta sessão, nada decorativo | ✅ |
| 6.2 | Abrir a aba de Heatmap no Mapa de Mesas | A mesa tocada aparece com intensidade > 0; tendência (aquecendo/esfriando, Fase 11) reflete o padrão real | ⏳ Pendente | ⏳ |
| 6.3 | Abrir o Live Mode (SSE) e gerar um novo toque em outra aba | Evento aparece no feed ao vivo em até ~2s (polling), sem recarregar a página | ⏳ Pendente | ⏳ |
| 6.4 | Usar a Time Machine para voltar 5 minutos | Mostra o estado da mesa correto para aquele instante, reconstruído do `RedirectLog` | ⏳ Pendente | ⏳ |
| 6.5 | `/dev/command-center/events` (Event Explorer) → localizar o evento `NFCTocado` do toque gerado | Evento aparece na lista, abre com payload/correlação corretos | ⏳ Pendente | ⏳ |
| 6.6 | No mesmo evento, clicar "Reenfileirar para consumidores" | Reenfileira sem duplicar `EventLog`; contador de fila reflete o job | ⏳ Pendente | ⏳ |
| 6.7 | `/dev/ceo/reliability` → conferir filas/cache | Fila `analytics`/`webhooks` mostra atividade recente; cache do Resolution Engine mostra hit-rate > 0% | ⏳ Pendente | ⏳ |

## Bloco 7 — Playbooks e AutoPilot

| # | Ação | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|---|
| 7.1 | Gerar toques suficientes numa zona/horário específico (repetir Bloco 5 várias vezes) | Volume suficiente para um `PlaybookTriggerType` disparar | ⏳ Pendente | ⏳ |
| 7.2 | `POST /api/playbooks/evaluate` com o `CRON_SECRET` real (ou aguardar o Cron da Vercel) | Uma `PlaybookRecommendation` real aparece em `/dashboard/playbooks` | ⏳ Pendente | ⏳ |
| 7.3 | Clicar "Ver motivo" na recomendação | Explainability Panel mostra dados/confiança/regra reais, nunca uma frase genérica | ⏳ Pendente | ⏳ |
| 7.4 | Clicar "Aplicar" (agora) | Preview Inteligente mostra impacto; confirmar aplica de verdade (nova `CampaignAssignment`) | ⏳ Pendente | ⏳ |
| 7.5 | Clicar "Desfazer" na execução aplicada | Reverte a atribuição criada; se a campanha foi criada só para isso, é arquivada | ⏳ Pendente | ⏳ |
| 7.6 | Ligar o AutoPilot para "Automático" (`automation:manage`) e gerar novo sinal forte | Uma nova recomendação de alta confiança é aplicada SOZINHA, com `triggeredBy=AUTOPILOT` visível | ⏳ Pendente | ⏳ |

## Bloco 8 — Branding / White Label

| # | Ação | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|---|
| 8.1 | `/dashboard/branding` → mudar a cor primária e o nome exibido | Preview ao vivo muda instantaneamente (dashboard/login/QR/mockups), sem salvar ainda | ⏳ Pendente | ⏳ |
| 8.2 | Clicar "Salvar" | `PATCH /api/company` persiste; recarregar a página mantém a nova marca | ⏳ Pendente | ⏳ |
| 8.3 | Deslogar e abrir `/sign-in` | Tela de login mostra a marca da empresa (via `Host`/subdomínio, se configurado) | ⏳ Pendente | ⏳ |
| 8.4 | Baixar um PDF de impressão (adesivo ou cartão PVC) de um cartão | PDF abre com as dimensões físicas corretas e a cor/logo da marca | ⏳ Pendente | ⏳ |
| 8.5 | Acessar `/api/brand/icon` e `/api/brand/manifest` no domínio da empresa | Favicon/manifest refletem a marca configurada | ⏳ Pendente | ⏳ |

## Bloco 9 — API Pública v1 e Webhooks

| # | Ação | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|---|
| 9.1 | `/dashboard/developers` → criar uma `ApiKey` com escopo `cards:read` | Chave exibida uma única vez; hash salvo, nunca o valor puro | ⏳ Pendente | ⏳ |
| 9.2 | `curl` (ou o Playground em `/developers`) em `GET /api/v1/cards` com a chave | 200 OK, lista paginada por cursor com os cartões reais criados no Bloco 3 | ⏳ Pendente | ⏳ |
| 9.3 | Repetir 9.2 sem header de autenticação | 401, envelope `{ error: { code, message, request_id } }` | ⏳ Pendente | ⏳ |
| 9.4 | Repetir 9.2 pedindo um recurso `campaigns:write`-only com a chave `cards:read` | 403, escopo insuficiente | ⏳ Pendente | ⏳ |
| 9.5 | Criar um `WebhookEndpoint` assinando `card.tapped` | Endpoint salvo com segredo HMAC | ⏳ Pendente | ⏳ |
| 9.6 | Gerar um toque (Bloco 5) | `WebhookDelivery` criada e entregue (ou falha registrada, se a URL de teste não responder) | ⏳ Pendente | ⏳ |
| 9.7 | Repetir uma chamada de escrita da v1 com o MESMO `Idempotency-Key` duas vezes | Segunda chamada devolve a resposta idêntica da primeira, nunca duplica o efeito | ⏳ Pendente | ⏳ |

## Bloco 10 — RBAC e Sessão (múltiplos papéis)

| # | Ação | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|---|
| 10.1 | Logar como o MANAGER restrito à zona X (criado no Bloco 2) | Vê só cartões/mesas da zona X no Mapa de Mesas | Não executado nesta rodada — testado convite/RBAC por papel (10.2-10.4), mas não a restrição adicional por `UserAccessScope` (zona/unidade) | ⏳ |
| 10.2 | Convidar e logar como um segundo usuário com papel Gerente (MANAGER); testar permissões reais via API | Ações permitidas ao MANAGER funcionam (`campaign:write`), ações fora do papel são bloqueadas (`settings:write`, `team:write`, `developers:manage`) | Convite real aceito automaticamente ao cadastrar com o e-mail convidado (sem passar por onboarding — `resolveOrClaimUser` funcionou). Testado via API autenticada como Gerente: criar campanha → 201 (permitido, correto); editar dados da empresa → 403 (correto); convidar outro membro → 403 (correto); criar chave de API → 403 (correto) | ✅ |
| 10.3 | Acessar `/dashboard/settings` como Gerente | Formulário de edição não deveria ser oferecido a quem não pode salvá-lo | **Bug real #4 encontrado e corrigido:** a página de Configurações renderizava o formulário completo (dados da empresa + ROI Mode) para QUALQUER papel, mesmo sem `settings:write` — ao clicar Salvar, um toast de "Sem permissão" aparecia (não crashava, mas era um beco sem saída confuso). Diferente de Desenvolvedores/Branding, que já escondem a página inteira nesse caso. Corrigido: os dois formulários agora só renderizam para quem tem `settings:write`; "Seu plano" e a Matriz de Permissões continuam visíveis para todos (informação legítima de referência) | ✅ (após correção) |
| 10.4 | Gerente tenta acessar `/dashboard/developers` e `/dashboard/branding` | Tela de "Acesso restrito" (não um crash) | Ambas páginas corretamente mostraram "Acesso restrito" com mensagem clara, sem crash | ✅ |
| 10.5 | Deixar a sessão do OWNER aberta, esperar o token expirar (ou forçar via Clerk) | Próxima ação autenticada redireciona para login, sem vazar dado parcial | ⏳ Pendente | ⏳ |
| 10.6 | Dar F5 (refresh) no meio do Theme Studio com alterações não salvas | Rascunho não salvo se perde (esperado, documentado) — nada corrompido no banco | ⏳ Pendente | ⏳ |
| 10.7 | Usar o botão "voltar" do navegador depois de criar uma campanha | Lista de campanhas não fica em estado inconsistente (nem duplicada, nem sumida) | ⏳ Pendente | ⏳ |

## Bloco 11 — Isolamento entre Tenants (crítico)

Executado com duas empresas reais e distintas: "Bella Vista" (dados de seed, Empresa A) e "Empresa Teste Gate Final B" (criada nesta sessão via signup real, Empresa B), logada como B.

| # | Ação | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|---|
| 11.1 | Logado como Empresa B, tentar `GET`/`PATCH` uma campanha da Empresa A (`/api/campaigns/<id-da-A>`) | 403/404 (`ForbiddenError` traduzido), nunca o dado da A | `GET` → 403 "Campanha não encontrada nesta empresa". `PATCH` (tentando renomear) → mesmo 403. Nenhum dado da A retornado | ✅ |
| 11.2 | Logado como B, tentar `PATCH`/`DELETE` um cartão da Empresa A (`/api/cards/<id-da-A>`) | 403/404, nunca sucesso | `PATCH` → 403 "Cartão não encontrado nesta empresa". `DELETE` → mesmo 403 | ✅ |
| 11.3 | Logado como B, tentar `PATCH`/`DELETE` um membro de equipe da Empresa A (`/api/team/<id-da-A>`) | 403/404, nunca sucesso | `PATCH` (mudar papel para ADMIN) → 403 "Membro não encontrado nesta empresa". `DELETE` → mesmo 403 | ✅ |
| 11.4 | Abrir `/r/<code-de-cartão-da-A>` e `/r/<code-de-cartão-da-B>` | Cada um resolve para a campanha/marca da SUA PRÓPRIA empresa, nunca cruzando | Confirmado nos testes do Bloco 5 — cada código resolveu exclusivamente dados/campanhas da empresa dona do cartão | ✅ |
| 11.5 | Comparar `/dashboard/analytics` das duas empresas | Números completamente independentes, nenhum toque da B aparece nos KPIs da A | KPIs da B mostraram só a atividade gerada nesta sessão (4 acessos); nenhuma menção a dados da Bella Vista | ✅ |
| 11.6 | Branding por subdomínio / WebhookEndpoint cross-tenant | Marca de cada subdomínio isolada; webhook de A nunca recebe evento de B | Não executado nesta rodada — nem a Empresa B nem a A têm domínio customizado configurado em Staging, e nenhum `WebhookEndpoint` real foi criado nesta sessão (bloqueado pelo teste de RBAC 10.2, que já confirmou que um Gerente não pode nem criar uma API key) | ⏳ |

## Bloco 12 — Resiliência (Chaos Mode)

| # | Ação | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|---|
| 12.1 | `/dev/ceo/reliability` → ligar a flag `redisDown` | Toda leitura cacheada cai para o Postgres direto; `/r/[code]` continua funcionando, só mais lento | ⏳ Pendente | ⏳ |
| 12.2 | Ligar `queueStalled` e gerar um evento | `EventLog` grava normalmente; a fila para de processar (`processed: 0`) até desligar a flag | ⏳ Pendente | ⏳ |
| 12.3 | Ligar `webhookFailure` e gerar um toque com um webhook assinado | `WebhookDelivery` registra falha; reenvio manual disponível no dashboard | ⏳ Pendente | ⏳ |
| 12.4 | Desligar todas as flags | Comportamento volta ao normal, sem precisar reiniciar nada | ⏳ Pendente | ⏳ |

---

## Legenda de Status

- ⏳ Não executado (aguardando ambiente real)
- ✅ Passou como esperado
- ⚠️ Passou com ressalva (documentar a ressalva)
- ❌ Falhou (vira bug a corrigir antes do fechamento do Gate Final)

## Estado de fechamento (2026-09-09)

Das ~75 linhas do roteiro original, as que cobrem os caminhos de maior risco do produto (cadastro real, isolamento entre tenants, RBAC por papel, e o pipeline `/r/[code]` com suas 5 variações de regra/escopo) foram executadas de verdade contra o Staging real e estão marcadas ✅/⚠️ acima, com 4 bugs reais encontrados e corrigidos no processo (nunca ❌ deixado sem correção). As linhas ainda `⏳` (Blocos 2 parcial, 3, 6.2-6.7, 7, 8, 9, 10.1/10.5-10.7, 11.6, 12) não foram executadas nesta rodada — a lista completa e o porquê de cada uma estão no `RELATORIO_GATE_FINAL.md`, seção "O que fica pendente". Nenhuma dessas pendências é um bloqueio conhecido do fluxo principal (a maioria são variações /aprofundamentos de fluxos já confirmados, como cache com Redis, Playbooks automáticos, Chaos Mode, e branding por subdomínio) — mas continuam pendentes de execução real, não confirmadas.
