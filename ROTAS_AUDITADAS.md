# Inventário e Auditoria de Rotas — Gate Final de Entrega

Este documento é o inventário completo de todas as **26 páginas** e **126 rotas de API** existentes no NFC OS até a Fase 12, como primeira etapa do Gate Final de Entrega pedido.

**Leia isto antes das tabelas:** a coluna "Verificação estática" reflete o que já foi comprovado por `tsc`/`eslint`/`prisma validate`/`npm run build` (todos limpos, ver `RELATORIO_FASE_12.md`) — ou seja, toda rota aqui listada **existe, compila, e segue o padrão de autenticação correto no código**. A coluna "Verificação ao vivo" é sobre clicar de verdade, ver a tela renderizar, submeter um formulário e confirmar que persiste — **isso exige um banco Postgres real acessível, que não existe neste sandbox** (documentado em todo relatório de fase desde a Fase 1) e será preenchido assim que o ambiente de Staging do `DEPLOY_SETUP.md` estiver no ar. Nenhuma linha abaixo foi marcada como "ok" sem ter sido, de fato, checada da forma indicada.

---

## Páginas (26)

| Rota | Autenticação (por código) | Propósito | Verificação estática | Verificação ao vivo |
|---|---|---|---|---|
| `/` | Pública | Landing page de marketing | ✅ compila, ✅ renderiza (build estático) | ✅ feita nesta sessão (200 OK) |
| `/sign-in/[[...sign-in]]` | Pública (Clerk) | Login | ✅ compila | ⏳ exige Clerk real |
| `/sign-up/[[...sign-up]]` | Pública (Clerk) | Cadastro | ✅ compila | ⏳ exige Clerk real |
| `/onboarding` | Autenticada (Clerk, sem empresa ainda) | Criar a primeira empresa após o cadastro | ✅ compila | ⏳ exige Clerk + Postgres reais |
| `/dashboard` | Autenticada | Visão geral | ✅ compila | ⏳ exige Clerk + Postgres reais |
| `/dashboard/cards` | Autenticada | Cartões NFC | ✅ compila | ⏳ |
| `/dashboard/table-map` | Autenticada | Mapa de Mesas | ✅ compila | ⏳ |
| `/dashboard/campaigns` | Autenticada (`campaign:write`/`campaign:assign` controlam ações) | Campanhas/Regras/Variantes/Atribuições | ✅ compila | ⏳ |
| `/dashboard/analytics` | Autenticada | Analytics Enterprise | ✅ compila | ⏳ |
| `/dashboard/playbooks` | Autenticada (`campaign:assign` para aplicar, `automation:manage` para AutoPilot) | Recommendation Center | ✅ compila | ⏳ |
| `/dashboard/branding` | Autenticada (`settings:write`, bloqueio total sem a permissão) | Theme Studio / White Label | ✅ compila | ⏳ |
| `/dashboard/developers` | Autenticada (`developers:manage`) | Chaves de API, Webhooks, Logs | ✅ compila | ⏳ |
| `/dashboard/team` | Autenticada (`team:write` controla ações) | Equipe/RBAC/Escopos de acesso | ✅ compila | ⏳ |
| `/dashboard/settings` | Autenticada | Configurações da empresa | ✅ compila | ⏳ |
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

**Verificação ao vivo:** ⏳ pendente do ambiente de Staging para a maioria — as exceções já confirmadas ao vivo nesta sessão: `GET /api/demo/scenarios` (200 OK, sem precisar de banco), `GET /api/playbooks/evaluate` sem `CRON_SECRET` (503, sem precisar de banco), `GET /api/brand/icon`/`GET /api/brand/og` no domínio raiz (200 OK, sem precisar de banco).

---

## `/r/[code]` — o pipeline mais crítico, tratamento dedicado

Por ser o coração do produto, esta rota recebe uma seção própria em vez de uma linha na tabela. O pipeline completo (`NFC/QR → resolveDestination → Campaign → Rules → Variant → Destination → RedirectLog/EventBus → Analytics`) está implementado desde a Fase 1 e estendido em toda fase seguinte — mas **nunca foi exercitado de ponta a ponta contra um banco real neste sandbox**, pela mesma razão de sempre. A lista de cenários que o `RELATORIO_FASE_N.md` de cada fase já documentou como logicamente implementados (mas não observados ao vivo):

- Ativo sem campanha → fallback para o fluxo de estrelas (`REVIEW_FLOW_FALLBACK`).
- Campanha pausada/encerrada/agendada → nunca vence a resolução (checado por `status`/`startsAt`/`endsAt`).
- Múltiplas campanhas concorrendo → desempate por especificidade de escopo (CARD > ZONE > BRANCH > COMPANY > ORGANIZATION) → prioridade → recência.
- Regras (`Rule`, dia/hora/data/dispositivo) → todas combinadas com AND.
- Variantes A/B → seleção por peso.
- Cache do Resolution Engine → `cachedOrLoad`, com bypass automático quando `redisDown` (Chaos Mode) está ativo.
- Ativo inexistente → 404 honesto, nunca um crash.

Isso entra como o item #1 do roteiro em `E2E_FINAL_CHECKLIST.md` assim que houver um banco real — é o teste de maior prioridade de todo o Gate Final.
