# Checklist E2E Final — Gate de Entrega

Roteiro reproduzível para validar o NFC OS de ponta a ponta, como um cliente real faria. Cada etapa tem **Ação → Resultado esperado → Resultado obtido → Status**.

**Estado atual deste documento: o ROTEIRO está pronto e é o mesmo que qualquer pessoa (você, ou eu depois que o Staging estiver no ar) pode seguir literalmente. A coluna "Resultado obtido" está marcada `⏳ Pendente` em toda linha porque nenhuma delas pôde ser executada de verdade ainda** — este sandbox nunca teve um Postgres real conectado (ver `RELATORIO_FASE_1.md` até `RELATORIO_FASE_12.md`, todos documentam isso), e o Gate Final pediu explicitamente para não fingir um resultado que não foi observado. Assim que o ambiente de Staging do `DEPLOY_SETUP.md` estiver no ar, este é o primeiro documento que executo, linha por linha, e preencho de verdade.

**URL a usar:** `<preencher com a URL de Staging depois do DEPLOY_SETUP.md>`

---

## Bloco 1 — Cadastro, Login e Primeira Empresa

| # | Ação | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|---|
| 1.1 | Acessar a URL de Staging na raiz (`/`) | Landing page carrega, sem erro de console, com CTA para começar | ⏳ Pendente | ⏳ |
| 1.2 | Clicar em "Começar"/"Criar conta" → preencher cadastro no Clerk | Redireciona para `/sign-up`, formulário do Clerk renderiza com a marca do produto | ⏳ Pendente | ⏳ |
| 1.3 | Confirmar o cadastro (e-mail/senha ou provedor social) | Usuário autenticado, redirecionado para `/onboarding` (sem empresa ainda) | ⏳ Pendente | ⏳ |
| 1.4 | Preencher o formulário de onboarding (nome da empresa, WhatsApp, link do Google Reviews) | `POST /api/onboarding` cria a `Company` + o `User` (role OWNER); redireciona para `/dashboard` | ⏳ Pendente | ⏳ |
| 1.5 | Conferir `/dashboard` logo após o onboarding | KPIs zerados/vazios (empty state), nunca um erro, nunca dado de outra empresa | ⏳ Pendente | ⏳ |
| 1.6 | Fazer logout (menu do usuário) | Sessão encerrada, redirecionado para a landing/sign-in | ⏳ Pendente | ⏳ |
| 1.7 | Tentar acessar `/dashboard` diretamente, deslogado | Redirecionado para `/sign-in` (middleware `auth.protect()`), nunca mostra dado | ⏳ Pendente | ⏳ |
| 1.8 | Fazer login novamente com a mesma conta | Volta para `/dashboard`, com a MESMA empresa e dados de antes (sessão realmente persistente) | ⏳ Pendente | ⏳ |

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
| 4.1 | `/dashboard/campaigns` → criar uma campanha tipo WHATSAPP (DRAFT) | Campanha criada, status DRAFT, preview de destino mostra o WhatsApp configurado | ⏳ Pendente | ⏳ |
| 4.2 | Ativar a campanha (DRAFT → ACTIVE) | Status muda, cache do Resolution Engine invalidado (`invalidateCompanyCampaigns`) | ⏳ Pendente | ⏳ |
| 4.3 | Adicionar uma `Rule` do tipo TIME_WINDOW (ex.: 18h-22h) | Regra salva, associada à campanha | ⏳ Pendente | ⏳ |
| 4.4 | Criar uma segunda campanha tipo GOOGLE_REVIEWS, ativa, SEM regra | Serve de "fallback" fora da janela de horário da primeira | ⏳ Pendente | ⏳ |
| 4.5 | Atribuir a campanha #1 a UM cartão específico (`scope=CARD`) | Atribuição criada; Mapa de Mesas mostra a cor/status da campanha na mesa certa | ⏳ Pendente | ⏳ |
| 4.6 | Atribuir a campanha #2 a toda a empresa (`scope=COMPANY`) | Atribuição criada; nunca duas linhas COMPANY para a mesma campanha (checar reenviar o mesmo request) | ⏳ Pendente | ⏳ |
| 4.7 | Criar uma variante A/B na campanha #2 | Variante salva com peso; nunca aplicada sem pelo menos 2 variantes | ⏳ Pendente | ⏳ |

## Bloco 5 — O Pipeline `/r/[code]` (Resolution Engine) — prioridade máxima

| # | Ação | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|---|
| 5.1 | Abrir `/r/<code-do-cartão-atribuído-à-campanha-1>` DENTRO da janela de horário da regra | Redireciona para o destino WhatsApp da campanha #1 (a mais específica, CARD > COMPANY) | ⏳ Pendente | ⏳ |
| 5.2 | Abrir o MESMO link FORA da janela de horário | Cai para a campanha #2 (COMPANY, sem regra) — prova que Rules realmente filtram | ⏳ Pendente | ⏳ |
| 5.3 | Abrir `/r/<code-de-um-cartão-sem-nenhuma-atribuição>` | Mostra o fluxo de estrelas padrão (`REVIEW_FLOW_FALLBACK`), nunca um erro | ⏳ Pendente | ⏳ |
| 5.4 | Pausar a campanha #1 e repetir 5.1 | Deixa de vencer a resolução; cai para o próximo elegível | ⏳ Pendente | ⏳ |
| 5.5 | Abrir `/r/CODIGO-INEXISTENTE` | 404 honesto ("Cartão indisponível"), nunca um crash de servidor | ⏳ Pendente | ⏳ |
| 5.6 | Repetir 5.1 dez vezes seguidas rapidamente | `resolvedFromCache` alterna conforme o TTL; nenhuma resposta lenta nem erro | ⏳ Pendente | ⏳ |
| 5.7 | Completar o fluxo de estrelas do 5.3 até o fim (dar uma nota) | `Visit`/`RatingEvent` criados; nota ≥4 vai para `/thank-you` com link do Google, nota ≤3 vai para `/feedback` | ⏳ Pendente | ⏳ |

## Bloco 6 — Atividade, Analytics, Heatmap, Live Mode, Eventos

| # | Ação | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|---|
| 6.1 | Com o Bloco 5 gerando toques/avaliações, abrir `/dashboard/analytics` | KPIs, funil, timeline refletem os toques/avaliações reais gerados, não mais zerados | ⏳ Pendente | ⏳ |
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
| 10.1 | Logar como o MANAGER restrito à zona X (criado no Bloco 2) | Vê só cartões/mesas da zona X no Mapa de Mesas | ⏳ Pendente | ⏳ |
| 10.2 | MANAGER tenta atribuir uma campanha à empresa inteira (`scope=COMPANY`) | Bloqueado (`ForbiddenError`) — só usuários sem `accessScopes` podem | ⏳ Pendente | ⏳ |
| 10.3 | Logar como READ_ONLY | Nenhum botão de escrita habilitado; tentativa direta via API devolve 403 | ⏳ Pendente | ⏳ |
| 10.4 | READ_ONLY tenta acessar `/dashboard/developers` | Tela de "Acesso restrito" (não um crash) | ⏳ Pendente | ⏳ |
| 10.5 | Deixar a sessão do OWNER aberta, esperar o token expirar (ou forçar via Clerk) | Próxima ação autenticada redireciona para login, sem vazar dado parcial | ⏳ Pendente | ⏳ |
| 10.6 | Dar F5 (refresh) no meio do Theme Studio com alterações não salvas | Rascunho não salvo se perde (esperado, documentado) — nada corrompido no banco | ⏳ Pendente | ⏳ |
| 10.7 | Usar o botão "voltar" do navegador depois de criar uma campanha | Lista de campanhas não fica em estado inconsistente (nem duplicada, nem sumida) | ⏳ Pendente | ⏳ |

## Bloco 11 — Isolamento entre Tenants (crítico)

Pré-requisito: repetir os Blocos 1-4 uma SEGUNDA vez, criando a "Empresa B" com uma conta diferente.

| # | Ação | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|---|
| 11.1 | Logado como Empresa A, tentar abrir uma URL de cartão (`cardId`) da Empresa B via API interna (`GET /api/cards/<id-da-B>`) | 404 (`ForbiddenError` traduzido), nunca o dado da B | ⏳ Pendente | ⏳ |
| 11.2 | Logado como A, chamar `/api/v1/campaigns/<id-da-B>` com a `ApiKey` de A | 404 — `ApiKey` só resolve `companyId` da própria chave, nunca aceito por parâmetro | ⏳ Pendente | ⏳ |
| 11.3 | Abrir `/r/<code-de-cartão-da-B>` | Resolve para a campanha/marca da EMPRESA B, nunca da A, mesmo se acessado a partir de uma sessão logada como A | ⏳ Pendente | ⏳ |
| 11.4 | Comparar `/dashboard/analytics` das duas empresas lado a lado | Números completamente independentes, nenhum toque da B aparece nos KPIs da A | ⏳ Pendente | ⏳ |
| 11.5 | Configurar branding diferente nas duas empresas, acessar via subdomínio de cada uma | Cada subdomínio resolve a marca certa — nunca a marca de uma vazando para o Host da outra | ⏳ Pendente | ⏳ |
| 11.6 | Criar um `WebhookEndpoint` em A assinando `card.tapped`; gerar um toque na B | O endpoint de A NUNCA recebe o evento da B | ⏳ Pendente | ⏳ |

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

## Como este documento será fechado

Assim que o Staging (`DEPLOY_SETUP.md`) estiver no ar com um banco real, cada uma das ~75 linhas acima será executada de verdade, o "Resultado obtido" preenchido com o que de fato aconteceu (nunca copiado do "Resultado esperado"), e o Status marcado honestamente — incluindo ❌ quando algo falhar, seguido da correção antes de declarar o Gate Final concluído, exatamente como pedido.
