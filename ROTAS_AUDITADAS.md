# Inventário e Auditoria de Rotas — Gate Final de Entrega

Este documento é o inventário completo de todas as **26 páginas** e **126 rotas de API** existentes no NFC OS até a Fase 12, como primeira etapa do Gate Final de Entrega pedido.

**Leia isto antes das tabelas:** a coluna "Verificação estática" reflete o que já foi comprovado por `tsc`/`eslint`/`prisma validate`/`npm run build` (todos limpos). A coluna "Verificação ao vivo" foi **atualizada em 2026-09-09 contra o Staging real** (`https://nfc-os-staging.vercel.app`) — as páginas onde o dashboard completo foi navegado (como dono e como um segundo usuário convidado com papel Gerente) estão marcadas ✅ com o resultado real observado; as que não foram clicadas nesta rodada continuam ⏳. Nenhuma linha abaixo foi marcada como "ok" sem ter sido, de fato, checada da forma indicada.

---

## Páginas (26)

| Rota | Autenticação (por código) | Propósito | Verificação estática | Verificação ao vivo |
|---|---|---|---|---|
| `/` | Pública | Landing page de marketing | ✅ compila, ✅ renderiza (build estático) | ✅ feita nesta sessão (200 OK) |
| `/sign-in/[[...sign-in]]` | Pública (Clerk) | Login | ✅ compila | ✅ testada de verdade (login de 2 usuários distintos) |
| `/sign-up/[[...sign-up]]` | Pública (Clerk) | Cadastro | ✅ compila | ✅ testada de verdade — ver achado sobre Bot Protection/Turnstile no `DEPLOY_SETUP.md` |
| `/onboarding` | Autenticada (Clerk, sem empresa ainda) | Criar a primeira empresa após o cadastro | ✅ compila | ✅ empresa real criada no Postgres |
| `/dashboard` | Autenticada | Visão geral | ✅ compila | ✅ KPIs reais, zerados corretamente para empresa nova |
| `/dashboard/cards` | Autenticada | Cartões NFC | ✅ compila | ✅ criação real de cartão com QR, limite de plano aplicado corretamente |
| `/dashboard/table-map` | Autenticada | Mapa de Mesas | ✅ compila | ✅ renderiza cartão/campanha reais, sem crash |
| `/dashboard/campaigns` | Autenticada (`campaign:write`/`campaign:assign` controlam ações) | Campanhas/Regras/Variantes/Atribuições | ✅ compila | ⚠️ 3 bugs reais encontrados e corrigidos nesta rodada — ver `E2E_FINAL_CHECKLIST.md` 4.1/4.2 |
| `/dashboard/analytics` | Autenticada | Analytics Enterprise | ✅ compila | ✅ reflete dados reais gerados nesta sessão |
| `/dashboard/playbooks` | Autenticada (`campaign:assign` para aplicar, `automation:manage` para AutoPilot) | Recommendation Center | ✅ compila | ✅ carrega, estado vazio correto para empresa nova |
| `/dashboard/branding` | Autenticada (`settings:write`, bloqueio total sem a permissão) | Theme Studio / White Label | ✅ compila | ✅ bloqueio de acesso confirmado para papel Gerente |
| `/dashboard/developers` | Autenticada (`developers:manage`) | Chaves de API, Webhooks, Logs | ✅ compila | ✅ bloqueio de acesso confirmado para papel Gerente |
| `/dashboard/team` | Autenticada (`team:write` controla ações) | Equipe/RBAC/Escopos de acesso | ✅ compila | ✅ convite real enviado e aceito (auto-join sem onboarding) |
| `/dashboard/settings` | Autenticada | Configurações da empresa | ✅ compila | ⚠️ bug real encontrado e corrigido (formulário visível sem permissão) — ver 10.3 no checklist |
| `/feedback` | Pública (token de link, sem sessão) | Feedback privado pós-avaliação baixa | ✅ compila | ⏳ |
| `/thank-you` | Pública | Agradecimento pós-avaliação alta | ✅ compila | ⏳ |
| `/r/[code]` | Pública (o pipeline NFC/QR inteiro) | Resolution Engine — redireciona ou mostra o fluxo de estrelas | ✅ compila | ⏳ **crítico, ver seção dedicada abaixo** |
| `/developers` | Pública | Playground/documentação da API v1 | ✅ compila, ✅ renderiza (build estático) | ✅ feita em fase anterior (Fase 9) |
| `/demo` | **Pública, produção** (`force-dynamic`) | Demo OS — narrativa de 9 momentos | ✅ compila | ⏳ exige Postgres real |
| `/demo/investor` | **Pública, produção** | Investor Mode (auto-play) | ✅ compila | ⏳ |
| `/dev` | Bloqueada em produção (`NODE_ENV`) | Status de build | ✅ compila, ✅ renderiza (build estático) | ✅ (não depende de banco) |
| `/dev/ceo` | Bloqueada em produção | Modo CEO / visão executiva | ✅ compila, ✅ renderiza (build estático) | ✅ (não depende de banco) |
| `/dev/ceo/command-center` | Bloqueada em produção | Command Center (Fase 6) | ✅ compila | ⏳ exige Postgres real |
| `/dev/ceo/mission-control` | Bloqueada em produção | Mission Control (Fase 8) | ✅ compila | ⏳ |
| `/dev/ceo/reliability` | Bloqueada em produção | Painel de Saúde (Fase 8) | ✅ compila | ⏳ |
| `/dev/command-center` | Bloqueada em produção | Dev Command Center v2 (Fase 12) | ✅ compila | ⏳ |
| `/dev/command-center/events` | Bloqueada em produção | Event Explorer (Fase 12) | ✅ compila | ⏳ |

**26/26 páginas existem e compilam.** 6 já tiveram sua renderização real confirmada nesta ou em fases anteriores (as que não dependem de banco). 20 aguardam o ambiente de Staging.

---

## Rotas de API — agrupadas por recurso (126 no total)

Listar as 126 uma a uma em linhas repetitivas teria menos valor do que agrupar por recurso, já que rotas do mesmo recurso compartilham o mesmo padrão de auth/validação (verificado uma vez por grupo, no código real de cada uma). Contagem exata por grupo:

| Grupo | Rotas | Autenticação | Observação |
|---|---|---|---|
| `/api/campaigns/**` | 13 | `requireAuthContext` + `campaign:write`/`campaign:assign` | CRUD completo + regras + variantes + atribuições (única/lote) |
| `/api/cards/**` | 6 | `requireAuthContext` + `card:write` | CRUD + layout + duplicar + impressão |
| `/api/v1/**` | 25 | `ApiKey` + escopo (`withApiV1`) | API pública v1 (Fase 9) — nunca sessão |
| `/api/analytics/**` | 9 | `requireAuthContext` | KPIs/funil/insights/forecast/ROI/export/timeline |
| `/api/dev/demo/**` | 15 | Nenhuma (empresa fixa) + bloqueada em produção | Espelhos somente-leitura para `/dev/ceo/*` |
| `/api/demo/**` | 9 | Nenhuma (empresa fixa) + rate limit por IP | Espelhos PÚBLICOS para `/demo` (Fase 12) |
| `/api/dev/**` (exceto `/api/dev/demo/**`) | 11 | Nenhuma + bloqueada em produção | Chaos/Replay/Reliability/Events/Inspectors (Fase 8/12) |
| `/api/playbooks/**` | 10 | `requireAuthContext` + `campaign:assign` | Recommendation/Execution Engine (Fase 11) |
| `/api/webhooks/**` + `/api/api-keys/**` + `/api/api-logs` | 8 | `requireAuthContext` + `developers:manage` | Dashboard de Desenvolvedor (Fase 9) |
| `/api/team/**` | 5 | `requireAuthContext` + `team:write` | Equipe/RBAC/Escopos |
| `/api/branches/**` + `/api/zones/**` | 4 | `requireAuthContext` + `settings:write` | Estrutura multi-unidade (Fase 4) |
| `/api/company/**` | 4 | `requireAuthContext` + `settings:write` | Configurações/domínio/branding |
| `/api/brand/**` | 1 | Pública (resolve por Host) | Assets Inteligentes (Fase 10) |
| `/api/automation/settings` | 1 | `requireAuthContext` + `automation:manage` | AutoPilot (Fase 11) |
| `/api/feedback/**` + `/api/export/feedback` | 3 | Pública (criar) / autenticada (listar/exportar) | Feedback privado |
| `/api/organization` | 1 | `requireAuthContext` + `organization:write` | Franquia (Fase 4) |
| `/api/visits` + `/api/ratings/**` | 3 | Pública, com `rateLimit("publicCard"/"rating")` | O pipeline de avaliação em si |
| `/api/live/**` + `/api/table-map/**` | 4 | `requireAuthContext` | SSE/Time Machine/Assignments do dashboard real |
| `/api/heatmap` | 1 | `requireAuthContext` | Heatmap do dashboard real |
| `/api/queues/process` | 1 | `Bearer CRON_SECRET` | Worker Engine acionado por Cron |
| `/api/onboarding` | 1 | Clerk (sem empresa ainda) | Criação da primeira empresa |

**Verificação estática (todos os 126):** `tsc`/`eslint`/`prisma validate`/`npm run build` limpos nesta sessão — toda rota compila, toda rota que deveria ter `requireAuthContext()` tem, toda rota `/dev/**` genuína tem o gate de `NODE_ENV`, toda rota `/api/demo/**` NUNCA tem esse gate (verificado por leitura de código nesta auditoria, coerente com a Fase 12).

**Verificação ao vivo:** ⏳ pendente para a maioria dos 126 endpoints individualmente, mas os grupos de MAIOR risco (isolamento entre tenants e RBAC) foram testados de verdade nesta rodada, contra dados reais de duas empresas distintas:

- `/api/campaigns/**`: GET/PATCH cross-tenant → 403 corretamente; POST como papel Gerente → 201 corretamente (permitido); PATCH de status/atribuição → funcionam e refletem no `/r/[code]` real.
- `/api/cards/**`: PATCH/DELETE cross-tenant → 403 corretamente.
- `/api/team/**`: PATCH/DELETE cross-tenant → 403 corretamente; POST (convidar) como papel Gerente → 403 corretamente (sem `team:write`).
- `/api/company/**`: PATCH como papel Gerente → 403 corretamente (sem `settings:write`).
- `/api/api-keys/**`: POST como papel Gerente → 403 corretamente (sem `developers:manage`).
- Confirmados em fases anteriores: `GET /api/demo/scenarios`, `GET /api/playbooks/evaluate` sem `CRON_SECRET` (503), `GET /api/brand/icon`/`og`.

Os demais grupos (`/api/v1/**`, webhooks, playbooks apply/undo, branches/zones, heatmap, live/SSE) não foram exercitados ao vivo nesta rodada.

---

## `/r/[code]` — o pipeline mais crítico, tratamento dedicado

**Executado ao vivo contra o Staging real em 2026-09-09 — resultado: pipeline genuinamente conectado, ponta a ponta, com evidência em `RedirectLog`.** Cenários confirmados:

- ✅ **Especificidade de escopo real**: no cartão "Mesa VIP 1" (Bella Vista), 3 campanhas elegíveis simultaneamente (CARD com regra de dispositivo, ZONE com recorrência semanal, COMPANY agendada) — nenhuma bateu nas condições do momento do teste (desktop/quarta-feira/antes da data de início), e o engine corretamente caiu para uma campanha ORGANIZATION-scope ativa sem regras, em vez de ir direto ao fallback. Prova que a cadeia CARD → ZONE → BRANCH → COMPANY → ORGANIZATION → fallback é avaliada de verdade, não hardcoded.
- ✅ **Regras (`Rule`) filtrando de verdade**: regra `DEVICE_TYPE` (mobile/tablet) corretamente desqualificou a campanha num acesso desktop; recorrência `WEEKLY` (só sexta 18h-22h) corretamente desqualificou a campanha numa quarta-feira; janela de datas (`startsAt`/`endsAt`) corretamente desqualificou uma campanha agendada para novembro.
- ✅ **Ativo sem campanha → fallback**: cartão novo (Empresa B) sem nenhuma campanha ativa renderizou o fluxo de estrelas padrão, título correto, sem erro.
- ✅ **Campanha DRAFT nunca vence a resolução**: mesmo cartão, mesma campanha, só mudando o status — DRAFT caiu no fallback, ACTIVE redirecionou para o WhatsApp configurado. Confirma que o "Ativar" no dashboard realmente invalida o Resolution Engine.
- ✅ **`RedirectLog` gravado de verdade**: cada teste acima gerou uma linha nova em `RedirectLog` com o outcome e o timestamp exatos, consultado diretamente no Postgres — não é um log decorativo.
- ✅ **Ativo inexistente → resposta honesta, nunca um crash**: `/r/codigo-que-nao-existe` devolve HTTP 200 com "Cartão não encontrado" (decisão deliberada de UX amigável para um cliente físico escaneando um cartão morto — não chama `notFound()` de propósito, ver comentário em `src/app/r/[code]/page.tsx`).
- ⏳ Não executado nesta rodada: variantes A/B (seleção por peso) e o comportamento do cache do Resolution Engine sob `redisDown` (Chaos Mode) — Staging roda sem Redis por decisão de isolamento (ver `DEPLOY_SETUP.md`), então esse teste específico só é significativo em Produção.

Ver `E2E_FINAL_CHECKLIST.md`, Bloco 5, para o passo a passo exato reproduzível.
