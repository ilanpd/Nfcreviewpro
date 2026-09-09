# Relatório Final — Gate de Entrega e Aperfeiçoamento Contínuo

**Última atualização:** 2026-09-09 (três rodadas de teste ao vivo nesta data — ver Ciclo 3 no topo)
**Ambientes testados:** Staging real e vivo (destrutivo), Production real e vivo (verificação segura, não-destrutiva)

---

## CICLO 3 (mais recente) — Fase de Fechamento e Preparação para Produção

### 1. O que foi auditado
- A inconsistência de plano/limite da Bella Vista (item explicitamente pedido).
- RBAC com o papel mais restritivo (Somente Leitura) contra Cartões e Feedback.
- Todas as rotas de escrita da API (`POST`/`PATCH`/`DELETE`) fora de `/v1`, `/dev`, `/demo` — checagem sistemática de quais chamam `requirePermission`.
- Todos os componentes do dashboard com ações destrutivas (`Trash2`/`handleDelete`/`onDelete`) — checagem de quais têm gating de permissão na UI.
- Isolamento de Webhooks entre tenants (Staging).
- Idempotency-Key, resolução NFC, e isolamento entre tenants — na Produção real, de forma não-destrutiva.

### 2. O que foi encontrado
- 🔴 **Bella Vista com plano PRO (limite 10) mas 51 cartões reais** — inconsistência do seed, não da regra de negócio.
- 🔴 **RBAC crítico**: um usuário Somente Leitura conseguia `POST /api/cards` (criar cartão, 201) e `PATCH /api/feedback/[id]` (resolver feedback) — nenhuma das duas rotas checava permissão, só autenticação. Único achado desse tipo em toda a API (as demais rotas sem `requirePermission` são legitimamente públicas: `/api/visits`, `/api/ratings`, `/api/onboarding`).
- 🔴 **Mesmo gap na UI**: o botão "Novo cartão", o menu Editar/Pausar/Excluir de cada cartão, e o switch "Resolvido" de feedback ficavam sempre visíveis/habilitados, independente do papel.
- 🟢 Isolamento de Webhooks entre tenants: correto.
- 🟢 Idempotency-Key: confirmado funcionando perfeitamente em Produção (Redis real) — duas chamadas com a mesma chave retornaram o EXATO mesmo recurso, sem duplicar.
- 🟢 Resolução NFC em Produção: testada com um cartão real da Bella Vista, redirecionou corretamente.
- 🟢 Isolamento entre tenants em Produção: tentativa de editar um cartão de outra empresa bloqueada com 403.

### 3. O que foi corrigido
- Plano da Bella Vista alterado para BUSINESS na fonte do seed e nos dois bancos já semeados (Staging e Produção).
- `requirePermission(ctx, "card:write")` adicionado em `POST/PATCH/DELETE /api/cards`.
- `requirePermission(ctx, "feedback:resolve")` adicionado em `PATCH /api/feedback/[id]`.
- `canManage` passado de ponta a ponta (página → view → item) para esconder/desabilitar os controles correspondentes na UI de Cartões e Feedback.
- Todas as correções testadas de novo e reimplantadas em Staging **e** Produção.

### 4. O que foi validado (teste real, não leitura de código)
- Somente Leitura bloqueado tanto na API quanto na UI, confirmado após o fix.
- Bella Vista sem mais o aviso de limite, com "Novo cartão" habilitado.
- Idempotency-Key, resolução NFC e isolamento de tenant confirmados ao vivo em Produção, sem nenhuma ação destrutiva.

### 5. O que ainda falta
- White Label por domínio/subdomínio real (não configurado ainda).
- Event Explorer, Reliability, Chaos Mode — inacessíveis em qualquer ambiente implantado (achado já registrado; só testável localmente).
- Sessão/expiração real, RBAC completo para os papéis Marketing e Operador (só Gerente e Somente Leitura foram testados com conta real até agora).
- Auditoria página-a-página sistemática das 26 páginas com a matriz completa de estados.
- Rodada de UX/UI dedicada (item 4 do pedido).
- `DEFINITION_OF_DONE.md` (ainda não criado).
- Regressão integrada final (Cadastro→Logout com múltiplos papéis/tenants/dispositivos).

### 6. Recomendação para o próximo passo
Continuar o ciclo: (a) criar o `DEFINITION_OF_DONE.md` agora que há critérios claros o suficiente para defini-los, (b) testar Marketing/Operador do mesmo jeito que Somente Leitura foi testado agora (mesma técnica, alto valor, baixo custo), (c) começar a auditoria página-a-página sistemática.

### 7. Status geral do produto
🟡 **Significativamente mais sólido que no Ciclo 2, mas ainda não fechado.** O achado mais importante desta rodada (RBAC de Cartões/Feedback) era uma falha de segurança real, não cosmética — do tipo que só uma pessoa realmente testando com um usuário restrito encontraria. Já corrigido e verificado. Nenhum bloqueio conhecido do fluxo principal permanece em aberto.

---

---

## 1. Critério final do Gate

> "Se eu receber esse projeto hoje, consigo entrar pela URL, criar minha conta, configurar uma empresa, navegar por absolutamente todas as áreas, executar o fluxo principal completo, gerar dados, visualizar os resultados e testar o produto como um cliente real sem precisar que você fique corrigindo coisas durante o meu teste?"

**Resposta honesta nesta atualização: sim para um conjunto bem mais amplo do que na primeira rodada** — cadastro, empresa, Branches/Zones, UserAccessScope, Cartões, Table Map (incluindo mobile), Campanhas/Regras/A-B, isolamento entre tenants, RBAC com um segundo usuário real, o pipeline `/r/[code]` completo, Playbooks/AutoPilot de ponta a ponta (aplicar E desfazer, com efeito real no banco), Branding, e a API Pública v1 com escopos/erros/paginação. **8 bugs reais foram encontrados e corrigidos nas duas rodadas**, incluindo um crítico (Impressão/PDF retornava erro 500 em 100% das tentativas, em produção). Isso ainda não é "literalmente todas as ~75 linhas do checklist" — a seção 9 lista o que continua fora, com honestidade sobre o porquê.

---

## 2. URLs e credenciais

| Ambiente | URL | Uso |
|---|---|---|
| **Produção** | https://nfc-os-production.vercel.app | Dados reais / demonstração para investidor ou cliente |
| **Staging** | https://nfc-os-staging.vercel.app | Testes destrutivos — crie, edite e apague à vontade, nunca afeta Produção |

**Contas de teste criadas nesta sessão (Staging):**

| Papel | E-mail | Senha | Empresa |
|---|---|---|---|
| Proprietário | `clara.wechsler+clerk_test_empresab@gmail.com` | `GateFinal2026!Teste` | Empresa Teste Gate Final B (criada do zero via signup real) |
| Gerente (convidado, RBAC) | `clara.wechsler+clerk_test_rbacmanager@gmail.com` | `GateFinal2026!Teste` | Empresa Teste Gate Final B (mesma) |
| Proprietário (acesso de QA) | `clara.wechsler+clerk_test_bvaccess@gmail.com` | `GateFinal2026!Teste` | **Bella Vista** (empresa de seed, com 90 dias de histórico real) |

Todas usam o padrão de teste da Clerk (`+clerk_test`) — o código de verificação de e-mail é sempre `424242`, nunca chega um e-mail de verdade. A terceira conta foi criada especificamente para poder testar Playbooks/Heatmap/Analytics contra dados históricos reais, já que uma empresa nova não tem volume suficiente para gerar recomendações — foi vinculada à Bella Vista via um registro `User` pendente criado diretamente no banco (não pelo fluxo de convite normal, que exigiria já estar logado como o dono original, que não existe como conta Clerk real).

## 3. Banco de dados por ambiente

| Ambiente | Projeto Supabase | Connection pooling |
|---|---|---|
| Produção | `wrxenecdfiteqkldsovz` ("Nfc Review Pro") | Transaction (6543) / Session (5432), `sa-east-1` |
| Staging | `xcrniyhjiscldevjzgpt` ("Nfc Review Pro 2") | Idêntico, projeto separado |

Bancos completamente separados — nunca compartilham dados. Redis: só Produção tem (decisão deliberada de isolamento, ver `DEPLOY_SETUP.md` e seção 11 abaixo sobre a consequência disso para Idempotência e Chaos Mode).

## 4. Como resetar/repopular o Staging

```bash
# Aponte DATABASE_URL/DIRECT_URL do .env para o pooler do projeto Supabase de Staging, depois:
npx prisma migrate deploy   # reaplica a estrutura (idempotente)
npx tsx prisma/seed.ts      # repõe os dados de demonstração (Bella Vista, Sushi House, Nova Steakhouse)
```

Isso NÃO apaga o que você criou manualmente (contas via signup, novas empresas) — o seed só faz `upsert` das empresas de demonstração. Para um reset completo (apagar tudo, inclusive o que você testou), seria necessário um `TRUNCATE` manual nas tabelas — deliberadamente não automatizado ainda, para evitar apagar Staging por engano com um comando de um clique.

---

## 5. Rotas auditadas

Ver `ROTAS_AUDITADAS.md` — 26 páginas + 126 rotas de API inventariadas, com verificação estática (100%) e verificação ao vivo (a maioria das páginas do dashboard, isolamento entre tenants, RBAC, e agora também Branding e a API Pública).

## 6. Fluxos E2E testados de verdade (as duas rodadas)

Ver `E2E_FINAL_CHECKLIST.md` para o detalhe linha a linha. Resumo do que foi executado contra o Staging real:

1. **Cadastro → verificação de e-mail → onboarding → empresa criada**, com 2 empresas e 3 contas reais distintas.
2. **Pipeline `/r/[code]` completo** — desempate de especificidade real entre até 3 campanhas concorrentes, regras de dispositivo/recorrência/data filtrando de verdade, `RedirectLog` gravado, fallback correto, campanha DRAFT vs. ACTIVE mudando o resultado de verdade.
3. **Analytics e Heatmap refletindo dados reais** — números batendo com os testes gerados na própria sessão, não decorativos.
4. **Branches/Zones/UserAccessScope**: criação "on the fly" ao atribuir campanha; 3 cenários de restrição de acesso testados via API (COMPANY bloqueado para usuário restrito, zona fora do escopo bloqueada, unidade dentro do escopo permitida).
5. **Table Map**: drag-to-reposition persiste de verdade (confirmado no banco e após reload); arrastar uma campanha para uma mesa cria a atribuição real; agora também usável em viewport mobile (bug corrigido, ver seção 7).
6. **Campanhas → Regras → A/B**: criação de variante A/B testada; os 3 editores (Atribuições/Regras/Variantes) tinham o mesmo bug de contador (corrigido, seção 7).
7. **Playbooks — ciclo completo, ponta a ponta**: motor de avaliação real rodado contra os dados históricos da Bella Vista, gerou recomendações genuínas com números reais; "Ver motivo" (painel de explicabilidade com dados reais, não texto genérico); "Aplicar" (criou de verdade uma Campaign + Rule + CampaignAssignment no banco); "Desfazer" (reverteu tudo — campanha arquivada, atribuição removida, confirmado no banco).
8. **RBAC real com um segundo usuário**: convite → aceite automático (sem passar por onboarding) → 4 permissões testadas via API (1 corretamente permitida, 3 corretamente bloqueadas) → acesso à Configurações/Desenvolvedores/Branding corretamente restrito ou bloqueado conforme o papel.
9. **Isolamento entre 2 tenants reais**: 6 tentativas de acesso cross-tenant (campanha GET/PATCH, cartão PATCH/DELETE, membro de equipe PATCH/DELETE) — todas corretamente bloqueadas com 403.
10. **Branding/Theme Studio**: cor salva persiste de verdade, preview ao vivo funciona antes de salvar — mas encontrou e corrigiu uma alegação enganosa no texto (ver seção 7).
11. **API Pública v1**: chave com escopo `cards:read` funciona; sem header → 401; escopo insuficiente → 403; paginação por cursor real; limite de plano aplicado também via API. Criação de Webhook funciona, segredo HMAC gerado.
12. **Impressão Profissional (PDF)**: os 5 templates confirmados gerando PDF real depois do bug crítico corrigido (seção 7).

---

## 7. Bugs encontrados e corrigidos (as duas rodadas)

Todos encontrados durante teste ao vivo (não por leitura estática de código), corrigidos, testados de novo, e reimplantados em **Staging e Produção**.

| # | Bug | Onde | Impacto | Correção |
|---|---|---|---|---|
| 1 | Criar campanha com recorrência "Nenhuma" (opção padrão) falhava sempre com "Dados inválidos" | `src/lib/validations/campaign.ts` | **Bloqueava 100% das criações de campanha** com a configuração mais comum | Schema Zod passou a aceitar `null` além de `undefined` em `recurrenceConfig` |
| 2 | Página de Campanhas quebrava (`TypeError`) logo após criar, editar, duplicar ou arquivar qualquer campanha | `src/repositories/campaign.repository.ts` | Crash da UI a cada ação de escrita em campanhas | `createCampaign`/`updateCampaign` passaram a incluir `_count`/`owner`, igual à listagem |
| 3 | Badge de Status ficava em branco após criar/editar/duplicar/arquivar uma campanha, até recarregar | `src/services/campaign.service.ts` | Confuso — usuário não sabia se a campanha estava ativa sem dar F5 | `displayStatus` passou a ser calculado nos 4 pontos de escrita, não só na listagem |
| 4 | Configurações mostrava o formulário de edição completo para papéis sem permissão — salvar dava erro em vez do formulário não aparecer | `src/app/dashboard/settings/page.tsx` | Beco sem saída de UX para Marketing/Gerente/Operador/Somente leitura | Formulários só renderizam para quem tem `settings:write`, igual ao padrão de Desenvolvedores/Branding |
| 5 | Contador "Atribuições"/"Regras"/"A-B" no editor de campanha não atualizava sem reabrir o painel — mesmo bug nos 3 editores | `assignment-manager.tsx`, `rule-manager.tsx`, `variant-manager.tsx` | Usuário via "(0)" mesmo depois de criar algo com sucesso; risco de duplicar por achar que não salvou | Os 3 componentes agora notificam o pai (`onAssignmentsChange`/`onRulesChange`/`onVariantsChange`) a cada criação/remoção |
| 6 | Theme Studio afirmava que salvar a marca muda "dashboard, login, QR e impressão" — o dashboard real nunca muda (o preview é só uma ilustração, por design) | `theme-studio-view.tsx`, `brand-preview-panels.tsx` | Alegação falsa sobre o que o produto faz | Texto corrigido para não prometer o que não acontece; legenda explícita adicionada sob o preview de Dashboard |
| 7 | **Crítico** — `/api/cards/[id]/print` (Impressão Profissional) retornava 500 em **100% das tentativas**, em Staging e Produção | `next.config.ts` (config de deploy, não o código do PDF em si) | Toda a funcionalidade de imprimir adesivo/cartão PVC/displex/cavalete/plaquinha estava completamente quebrada em qualquer ambiente implantado | `pdfkit` carrega fontes com `require()` dinâmico que o file tracer da Vercel não segue — `outputFileTracingIncludes` força a inclusão do diretório de fontes no bundle da função. Os 5 templates testados de novo, todos gerando PDF real |
| 8 | Mapa de Mesas praticamente inutilizável em viewport mobile — canvas espremido a ~50px de largura, barra de ferramentas vazando para fora da tela | `table-map-view.tsx`, `campaign-tray.tsx` | Uma das telas mais importantes do produto (a mais visual/espacial) inutilizável no celular | Layout agora empilha verticalmente abaixo do breakpoint `sm`, canvas ganha altura mínima real, barra de ferramentas quebra linha |

## 8. Achados arquiteturais reais (não bugs pontuais — decisões que precisam ficar registradas)

- **Idempotency-Key não é aplicado no Staging** — testei repetir uma criação de Webhook com o mesmo `Idempotency-Key` duas vezes e recebi dois recursos diferentes (deveria ter recebido a mesma resposta). O próprio código (`src/lib/api-v1/idempotency.ts`) documenta que isso é esperado: sem Redis, a idempotência degrada de propósito para "sem proteção" em vez de bloquear a chamada. Staging não tem Redis por uma decisão de isolamento já tomada (para não vazar Chaos Mode para a Produção). **Não testei isso ainda contra a Produção** (que tem Redis real) — isso exigiria criar uma chave de API direto no banco de Produção fora do fluxo normal da aplicação, o que não fiz por ser uma ação sensível demais para prosseguir sozinha. Recomendo validar isso pela UI normal da Produção antes de declarar o item fechado.
- **Chaos Mode não é alcançável em nenhum ambiente implantado** — `/dev/ceo/reliability` (onde as flags de Chaos Mode são ligadas) retorna 404 tanto em Staging quanto em Produção, porque as rotas `/dev/**` são bloqueadas de propósito sempre que `NODE_ENV=production`, e os dois ambientes da Vercel rodam nesse modo. Isso significa que o Chaos Mode, do jeito que está construído, só é testável rodando a aplicação localmente (`npm run dev`) — nunca contra um ambiente real implantado. Testar com Redis real localmente exigiria apontar para o Redis de Produção (as flags são globais, não isoladas por ambiente — ver ADR já registrado), o que arriscaria afetar o comportamento real da Produção; por isso não fiz esse teste nesta rodada.
- **Bella Vista (empresa de seed) tem 51 cartões no plano PRO, que declara limite de 10** — inconsistência entre o dado semeado e a regra de negócio atual. Não corrigi unilateralmente (mudar o plano ou remover cartões de uma empresa de demonstração é uma decisão de produto, não um bug de código) — sinalizando para você decidir.

## 9. O que fica pendente (não executado ainda)

- Sessão/expiração real, refresh no meio de uma edição não salva, botão voltar do navegador (Bloco 10.5-10.7).
- Domínio customizado / White Label por subdomínio de verdade, e isolamento de branding entre tenants nesse cenário (a lógica existe no código — `resolve-brand.ts` — mas não configurei um domínio de teste real).
- Isolamento de Webhooks entre tenants (criei um Webhook, mas não testei se o de uma empresa nunca recebe evento de outra).
- Event Explorer, painel de Reliability (ambos são páginas `/dev/**`, mesma limitação de acesso da seção 8).
- Uma auditoria página-a-página dedicada e sistemática das 26 páginas com a lista completa de estados (loading/empty/error/duplicidade/muitos dados) pedida no item 2 do pedido — o que foi encontrado até aqui (bugs #2-#8) surgiu como efeito colateral de testar funcionalidade, não de uma varredura visual própria e exaustiva.
- Uma passagem dedicada de UX/Design polish (item 4 do pedido) — ainda não feita como exercício visual isolado.
- O documento de Definition of Done (item 15 do pedido).
- Uma segunda rodada de regressão completa depois de TODAS as correções (item 17) — os quality gates (seção 12) foram rodados após cada correção individual, mas não há ainda uma passada final única, de ponta a ponta, revalidando tudo junto.
- O teste final "como cliente real, sem olhar o código" (item 18).

## 10. Stubs, mocks e integrações declaradamente não reais

Nenhum encontrado além do que já era documentado e visível ao usuário como tal — `COUPON`/`AI_MENU` mostram "Em breve"; `/dev/**` bloqueado em produção; `/demo` gera dados reais via Scenario Engine, rotulado como demonstração; nenhum `console.log`/`TODO`/número decorativo encontrado na varredura.

## 11. Limitações conhecidas (arquiteturais, aceitas)

- Clerk em modo Development para os dois ambientes — Bot Protection precisou ser desativada manualmente para permitir teste automatizado de cadastro.
- Staging sem Redis (decisão de isolamento) — consequências diretas: cache/filas em fallback gracioso, e Idempotency-Key sem proteção real (seção 8).
- Cron Jobs da Vercel Hobby rodam 1x/dia.
- `git push` para o GitHub segue pendente do seu lado (bloqueio de permissão do Claude Code, não do repositório).

## 12. Resultado dos quality gates

| Gate | Resultado |
|---|---|
| `tsc --noEmit` | ✅ limpo (rodado de novo após cada uma das 8 correções) |
| `eslint . --max-warnings=0` | ✅ limpo |
| `prisma validate` | ✅ schema válido |
| `npm run build` (via deploy real na Vercel) | ✅ múltiplos builds de produção completos e bem-sucedidos, depois de cada correção, em Staging e Produção |
| Navegação manual pós-build | ✅ — toda esta sessão foi navegação real contra o build de produção da Vercel. O bug #7 (PDF) é a prova mais clara de por que isso importa: `tsc`/`eslint`/`build` local nunca o teriam pego — só apareceu no ambiente real implantado |

## 13. O que ainda impede chamar isto de "pronto para produção" hoje

- As pendências da seção 9 — nenhuma apareceu como bloqueio do fluxo principal pelo que foi possível observar, mas não foram testadas ao vivo ainda.
- Confirmar Idempotency-Key contra a Produção real (seção 8).
- Decidir o que fazer com a inconsistência de plano/limite da Bella Vista (seção 8).
- A auditoria página-a-página exaustiva, o polish de UX dedicado, e o documento de Definition of Done (itens 2, 4 e 15 do pedido) ainda não foram feitos como exercícios próprios.
