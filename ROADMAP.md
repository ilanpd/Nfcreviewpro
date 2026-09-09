# NFC Review Pro — Roadmap

> A partir da Fase 4.5, este documento (e toda a documentação do projeto) é escrito em português brasileiro — Regra Permanente nº 1. Ver `RELATORIO_FASE_4_5.md`.

Evoluindo o MVP (construído como um SaaS focado em avaliações do Google) para um **Sistema Operacional de Marketing Físico**: todo ativo NFC/QR é um identificador permanente e burro cujo comportamento é decidido dinamicamente por um Campaign Resolution Engine, mirando uma escala eventual de 100 mil empresas / 5 milhões de ativos NFC / milhões de acessos diários / franquias nacionais / redirecionamentos sub-100ms.

Duas decisões arquiteturais inegociáveis, travadas na Fase 1 e nunca revisitadas:

1. Um chip NFC só codifica `https://dominio/r/{code}` — um identificador imutável e opaco. Toda inteligência fica no servidor, então uma empresa pode mudar o que um cartão faz infinitamente, sem nunca reprogramá-lo.
2. O **Ativo** físico nunca aponta diretamente para um **Destino**. Toda resolução passa por um pipeline: `Ativo NFC → Resolvedor → Campanha → Destino`.

O trabalho avança em fases, cada uma exigindo aprovação antes que a próxima comece. O status abaixo é atualizado manualmente ao final de cada fase — ver `/dev` e `/dev/ceo` (apenas não-produção) para os mesmos dados renderizados como um dashboard, `PROXIMAS_TAREFAS.md` para o checklist granular da fase atual, e `DECISOES_DE_ARQUITETURA.md` para o porquê por trás de cada decisão estrutural (não só o quê).

## Architect Review — obrigatório antes de qualquer fase ser considerada concluída (a partir da Fase 4)

Nenhum relatório final de fase é entregue sem esta sequência rodar primeiro, em ordem:

1. Procurar inconsistências arquiteturais que criariam dívida técnica futura.
2. Procurar vulnerabilidades de isolamento entre tenants.
3. Procurar gargalos de performance.
4. Procurar race conditions.
5. Procurar oportunidades de simplificar sem perder flexibilidade.
6. Verificar que a mudança continua compatível com toda fase anterior.
7. Rodar os quality gates: `tsc`, `eslint`, `prisma validate`, `npm run build`.
8. Registrar toda decisão tomada — incluindo "procurou, não achou nada" — no relatório daquela fase, e em `DECISOES_DE_ARQUITETURA.md` para qualquer coisa estrutural.

Isso não é prática nova — as Fases 1-3 já fizeram versões disso (a correção do fallback de Redis, a correção da race condition com transação Serializable, a verificação cross-tenant de branch/zona, o bug de slug de UTM, a proteção de mudança de tipo/variante foram todos encontrados assim). Esta seção existe para que seja uma regra permanente, não algo que precisa ser lembrado.

## Product Review — obrigatório junto com o Architect Review, antes de qualquer fase ser considerada concluída (a partir da Fase 5)

O Architect Review pergunta "está construído certo." Este pergunta "parece certo de usar." Ambos travam a mesma linha de chegada — nenhum é opcional, e o relatório de uma fase registra os dois, incluindo "procurou, não achou nada" para qualquer um deles. Antes de entregar, responda honestamente:

1. A experiência parece um produto premium, ou apenas uma tela de admin com campos nela?
2. Existe algum atrito desnecessário — um passo que existe só porque foi mais fácil de construir assim?
3. A interface exige mais cliques do que a tarefa realmente precisa?
4. Existe uma forma mais intuitiva de realizar a mesma tarefa?
5. Um gerente de restaurante aprenderia esse fluxo em menos de 2 minutos, sem ajuda?
6. Existe uma oportunidade de efeito "uau" aqui que não custa nada em performance ou complexidade?

Registrar as respostas no relatório daquela fase, do mesmo jeito que os achados do Architect Review são registrados — incluindo quais toques de "uau" foram adicionados como resultado direto (o preview do Ghost Mode e o pulso de confirmação de soltura da Fase 5 foram ambos encontrados assim, não pedidos item a item).

## Demo First — obrigatório junto com o Architect Review e o Product Review, a partir da Fase 6

Os dois reviews acima perguntam "está construído certo" e "parece certo de usar." Este pergunta uma terceira coisa, igualmente decisiva: "isso convence alguém que ainda não decidiu comprar." Nenhuma funcionalidade é considerada completa sem responder, com honestidade, exatamente estas perguntas:

1. Essa funcionalidade impressionaria um investidor em uma demonstração de 2 minutos?
2. Um dono de restaurante entenderia o valor em menos de 30 segundos?
3. Existe um momento "uau" claramente perceptível?
4. O comportamento parece software premium ou apenas funcional?
5. Existe uma animação, feedback visual ou transição que comunique melhor o estado sem prejudicar performance?

Registrar as respostas no relatório daquela fase, junto com o Architect Review e o Product Review — incluindo "procurou, não achou nada" quando for o caso.

## Revenue Review — obrigatório junto com os três reviews acima, a partir da Fase 7

Os três reviews acima perguntam "está construído certo," "parece certo de usar" e "convence numa demonstração." Este pergunta a coisa que paga as contas: "isso justifica a assinatura continuar sendo cobrada todo mês." A partir da Fase 7, o NFC OS deixa de ser só um conjunto de funcionalidades e passa a ser avaliado como um ativo que vende assinatura — toda fase responde, com honestidade:

1. Essa funcionalidade aumenta a percepção de valor da assinatura?
2. O empresário entenderia quanto dinheiro isso pode gerar ou economizar?
3. Existe algum insight que justifique renovar o plano mensal?
4. Existe algum recurso digno de aparecer na página de vendas?
5. Existe alguma oportunidade de transformar dados em recomendação automática?

Registrar as respostas no relatório daquela fase, junto com os outros três reviews — incluindo "procurou, não achou nada" quando for o caso.

## Reliability Review — obrigatório junto com os quatro reviews acima, a partir da Fase 8

Os quatro reviews acima perguntam "está construído certo," "parece certo de usar," "convence numa demonstração" e "justifica a assinatura." Este pergunta a coisa que decide se um cliente fica depois do primeiro incidente: "isso continua de pé sob estresse, e se cair, avisa e se recupera." A partir da Fase 8, toda fase responde, com honestidade:

1. Essa funcionalidade continua funcionando sob alta carga?
2. Existe algum ponto único de falha?
3. O redirecionamento público continua protegido?
4. Existe degradação graciosa quando Redis, filas ou serviços externos falham?
5. Os eventos podem ser recuperados sem perda importante?
6. A observabilidade permite descobrir rapidamente onde um problema começou?

Registrar as respostas no relatório daquela fase, junto com os outros quatro reviews — incluindo "procurou, não achou nada" quando for o caso.

## Platform First Review — obrigatório junto com os cinco reviews acima, a partir da Fase 9

Os cinco reviews acima perguntam "está construído certo," "parece certo de usar," "convence numa demonstração," "justifica a assinatura" e "continua de pé sob estresse." Este pergunta uma coisa diferente, específica de toda fase que expõe uma superfície para OUTRO desenvolvedor integrar: "um desenvolvedor terceiro, que nunca viu este projeto, teria prazer em integrar com isso?" A partir da Fase 9, toda fase que toca a API pública, o SDK ou os webhooks verifica, com honestidade:

- Consistência da API (mesmo padrão de verbos/recursos, sem exceções arbitrárias)
- Versionamento e compatibilidade futura (nada quebra um consumidor existente)
- Developer Experience (DX): documentação, exemplos reais, mensagens de erro, tipagem
- SDK, webhooks, idempotência, paginação, limites de taxa, autenticação

Registrar as respostas no relatório daquela fase, junto com os outros cinco reviews — incluindo "procurou, não achou nada" quando for o caso. Duas regras permanentes adicionais, também a partir da Fase 9, não são reviews mas caminham junto com todas elas em todo relatório de fase:

- **WOW Factor Review:** responder "o que faria alguém dizer 'nunca vi um SaaS fazer isso'?" e implementar pelo menos uma melhoria pequena de alto impacto (visual ou funcional) sempre que ela não gerar dívida técnica.
- **Zero Dívida Silenciosa:** todo bug, risco arquitetural, inconsistência, duplicação ou oportunidade grande encontrada durante a fase deve ser investigada, corrigida se for segura, registrada em ADR, e explicada no relatório — nunca deixada de lado sem registro.

## Enterprise Brand Review — obrigatório junto com os reviews acima, a partir da Fase 10

Os reviews acima perguntam se o produto está bem construído, é usável, convence, é rentável, resiliente e agradável de integrar. Este pergunta uma coisa mais específica, sobre tudo que toca a identidade visual de uma empresa cliente: "uma rede com 500 unidades teria coragem de colocar sua marca inteira em cima disso?" A partir da Fase 10, toda fase que toca branding responde, com honestidade, avaliando:

- Identidade visual, domínio, login, favicon, e-mails, URLs, QR Codes, NFCs
- Consistência da marca, experiência mobile, experiência desktop
- Nada pode parecer "marca compartilhada" com o produto genérico

## Franchise First Review — obrigatório junto com os reviews acima, a partir da Fase 10

Todo recurso novo, a partir da Fase 10, responde:

1. Funciona para 1 loja?
2. Funciona para 50?
3. Funciona para 500?
4. Funciona para 5.000?

Sempre priorizar arquitetura escalável (consultas indexadas O(1) por tenant, nunca uma varredura que cresce com o número de empresas) sobre uma solução que só funciona no caso pequeno. Registrar as respostas no relatório daquela fase, junto com os outros — incluindo "procurou, não achou nada" quando for o caso. Uma terceira regra permanente, também a partir da Fase 10, não é um review mas caminha junto com todos eles em todo relatório de fase:

- **Luxury UX:** sempre que existir oportunidade de melhorar a percepção premium sem criar dívida técnica, implementar (transições, partículas leves, microinterações, loading inteligente, previews, feedbacks visuais, estados vazios cinematográficos) — sem exagero; a régua é "sensação de software de empresa bilionária," com Stripe/Linear/Vercel/Notion/Figma/Framer como referências permanentes.

## Autonomy Review — obrigatório junto com os reviews acima, a partir da Fase 11

Os reviews acima perguntam se o produto está bem construído, é usável, convence, é rentável, resiliente, agradável de integrar e digno da marca de uma rede. Este pergunta a coisa mais sensível de todas — o quanto o produto pode agir sozinho sem perder a confiança de quem o opera. A partir da Fase 11, toda automação nova responde, com honestidade:

1. O sistema age sozinho?
2. O usuário entende por que agiu?
3. Existe Undo?
4. Existe limite de segurança?
5. Existe log completo?

Registrar as respostas no relatório daquela fase, junto com os outros — incluindo "procurou, não achou nada" quando for o caso. Duas regras permanentes adicionais, também a partir da Fase 11, não são reviews mas caminham junto com todas elas em todo relatório de fase:

- **Explainability First:** nenhuma recomendação pode parecer mágica. Toda decisão automática mostra, sempre visível (nunca escondida atrás de um clique extra): quais dados usou, qual regra disparou, qual confiança possui, qual ação será tomada.
- **One-Tap Execution:** toda recomendação importante pode virar ação com um clique — mas nunca silenciosamente: sempre com preview de impacto antes e Desfazer depois.

## Demo OS Review — obrigatório junto com os reviews acima, a partir da Fase 12

Os reviews acima perguntam se o produto está bem construído, é usável, convence, é rentável, resiliente, agradável de integrar, digno da marca de uma rede e seguro para agir sozinho. Este pergunta a coisa que decide se alguém que nunca viu o produto entende o valor sem ajuda: "isso impressiona em 30 segundos, sem exigir nada de quem está vendo?" A partir da Fase 12, toda funcionalidade nova responde, com honestidade:

1. Impressiona em 30 segundos?
2. Funciona sem cadastro?
3. Conta uma história completa?
4. Parece produção ou protótipo?
5. Existe um momento "uau"?

Registrar as respostas no relatório daquela fase, junto com os outros — incluindo "procurou, não achou nada" quando for o caso. Duas regras permanentes adicionais, também a partir da Fase 12, não são reviews mas caminham junto com todas elas em todo relatório de fase:

- **Self-Healing Development:** nunca mais depender de editar `middleware.ts`/`layout.tsx` (ou qualquer arquivo de infraestrutura permanente) para testar interativamente — toda necessidade de bypass de desenvolvimento vira uma variável de ambiente explícita, checada em um único ponto de decisão, permanente e documentado.
- **Zero Fake Demo:** nenhuma tela de demonstração pode fingir dados. Todo dado mostrado numa vitrine/demo nasce dos mesmos motores reais do produto (mesmas tabelas, mesmos serviços) — nunca um estado de UI fabricado ou hardcoded.

| # | Fase | Escopo | Status |
|---|-------|-------|--------|
| 0 | Processo e visibilidade | `ROADMAP.md`, `PROXIMAS_TAREFAS.md`, página `/dev` local | ✅ Concluída |
| 1 | Campaign Resolution Engine (fundação) | Modelos `Campaign` / `CampaignAssignment` / `RedirectLog`; resolvedor desacoplado + cache Redis; `/r/[code]` fica ciente de campanhas mantendo 100% de retrocompatibilidade | ✅ Concluída |
| 2 | Campaign Manager V2 | Dashboard de campanhas enterprise (busca/filtro/ordenação, rascunho/duplicar/arquivar/excluir), Campaign Builder premium com preview de destino ao vivo + UTM automático, atribuições em 4 níveis (empresa/branch/zona/cartão) sobre um modelo mínimo de `Branch`/`Zone`, camadas de Domínio/Repositório/Serviço, visão executiva `/dev/ceo` | ✅ Concluída |
| 3 | Motor de Regras + testes A/B | Avaliação em tempo real e ciente de fuso horário de `Rule` (dia/hora/data/dispositivo) via `Intl` nativa, ordenação determinística especificidade→prioridade→recência (inalterada, agora ciente de regras), seleção A/B configurável por peso de `CampaignVariant`, `RuleExecutionLog` (volume limitado), integração completa ao motor sem custo adicional de cache | ✅ Concluída |
| 4 | Multi-unidade + RBAC v2 | `Organization` como wrapper opcional acima de `Company` sobre `Branch`/`Zone` da Fase 2; RBAC em matriz de 6 papéis (Owner/Admin/Marketing/Manager/Operator/Read-Only); restrição opt-in de branch/zona via `UserAccessScope`; escopo de campanha `ORGANIZATION` com sua própria camada de cache; log de auditoria (`AuditLog`) para mutações de alto valor | ✅ Concluída |
| 5 | Mapa de Mesas | Editor visual de planta baixa estilo Figma para restaurantes: arrastar/zoom/pan/snap em grade/múltipla seleção/renomear inline/duplicar, atribuição de campanha por arrastar-e-soltar (mesa única, lote com múltipla seleção, ou zona inteira) com preview de cor ao vivo "Ghost Mode" antes da soltura, indicadores de status e conflito por mesa | ✅ Concluída |
| 4.5 | NFC OS Design Language & Integração de MCPs | Tokens de design + biblioteca de componentes (`packages/ui`, `packages/design-tokens`, `packages/icons`, `packages/animations`) sobre o shadcn/ui, microinterações com energia estilo Magic UI, autoria de componentes acelerada por MCPs de design, glassmorphism, skeleton loading, dark mode impecável, um motion system de verdade, cards premium reutilizáveis (Analytics/Campanha/Heatmap/Mesa/Zona), Command Palette — o "NFC OS Design Language." Ver "Escopo da Fase 4.5" abaixo para o briefing completo. | ✅ Concluída |
| 6 | Live Mode + Heatmap | Live Mode (SSE com reconexão/heartbeat), Heatmap Inteligente de 6 camadas, Live Presence (pulso ao vivo nas mesas), Ghost Mode Evolution (Preview Inteligente + Desfazer), Time Machine + Playback, Command Center em `/dev/ceo` | ✅ Concluída |
| 7 | Analytics Enterprise | 5 motores desacoplados (Analytics/Insights/Forecast/Ranking/Export Engine), Funil Inteligente, Insights Automáticos, Rankings, Comparativos, Timeline Executiva, Forecast, ROI Mode, exportação CSV/Excel/PDF, Command Center Evolution | ✅ Concluída |
| 8 | Event sourcing + filas + observabilidade | Event Bus interno (10 eventos de domínio, `EventLog` durável), Queue Engine (BullMQ/Redis, 6 filas com retry/backoff/dead-letter/idempotência), Observability Engine (OpenTelemetry, Correlation ID, logs estruturados, Sentry preparado), Painel de Saúde + Mission Control em `/dev/ceo`, Chaos Mode, Event Replay, segurança operacional (rate limit por organização) | ✅ Concluída |
| 9 | API pública v1 + SDK + webhooks | REST API v1 versionada (`/api/v1/**`) sobre autenticação por `ApiKey`/escopos, paginação por cursor, idempotência com replay de resposta, envelope de erro único; SDK oficial `@nfc-os/sdk` (JS/TS, autopaginação, erros tipados); Webhooks Enterprise (`WebhookEndpoint`/`WebhookDelivery`, HMAC, retry, replay); Dashboard de Desenvolvedor (`/dashboard/developers`) e Playground público (`/developers`) | ✅ Concluída |
| 9.5 | Marketplace & Integrações | Marketplace de integrações (WhatsApp/Instagram/TikTok/Google Business/Meta Ads/Zapier/Make/n8n/HubSpot/Pipedrive), templates de automação, OAuth completo, App Directory para parceiros, SDK de plugins — registrada como fase futura, não projetada nem iniciada | 🚧 Planejada |
| 10 | White Label Enterprise | Identidade completa por empresa (logo/favicon/cores/domínio/subdomínio/login), `DomainResolver` cacheável, `BrandProvider` central, Theme Studio (`/dashboard/branding`) com preview ao vivo, favicon/OG/manifest dinâmicos, QR/impressão com marca (5 formatos físicos reais), Brand Motion System, CSP (report-only)/HSTS — preparação registrada (não implementada) para Fases 11/12/13 | ✅ Concluída |
| 11 | Smart Campaign Playbooks | Recommendation Center (`/dashboard/playbooks`) com 7 playbooks declarativos reais (Happy Hour Boost, Google Review Recovery, Instagram Momentum, VIP Table Recovery, Silent Zone Rescue, Lunch Rush Optimization, Weekend Accelerator), Confidence Engine + Explainability Panel, One-Tap Execution com Ghost Mode/Preview Inteligente/Desfazer, Scheduler Inteligente (agora/depois/repetir/pausar), AutoPilot Seguro (4 níveis, confiança ≥75% + teto diário), Executive Copilot no Command Center, Heatmap Preditivo (tendência aquecendo/esfriando) | ✅ Concluída |
| 12 | Developer Command Center v2 + Demo OS | Dev Runtime permanente (`DEV_RUNTIME=1`, elimina o harness descartável — ver ADR-052); Demo OS público em `/demo` (narrativa de 9 momentos reais, Scenario Engine com 7 cenários, Demo Timeline, White Label Live Switch, Investor Mode em `/demo/investor`); Dev Command Center v2 (`/dev/command-center`) com Event Explorer, State Inspector, Network Inspector e Visual Event Flow | ✅ Concluída |
| 13 | AI Copilot & Marketplace OS | AI Campaign Copilot, Marketplace, Plugins, Integrações, agentes especializados, automações inteligentes — registrada como fase futura, não projetada nem iniciada | 🚧 Planejada |

## Escopo da Fase 6 (registrado, agora implementado)

**Objetivo:** fazer o NFC OS parecer um sistema operacional *vivo* — não WebSockets funcionando nos bastidores, mas uma sensação real de controle instantâneo do salão inteiro.

- **Live Mode:** SSE com polling de banco a cada 2s (ver ADR-025 para por que não WebSocket real nesta fase), heartbeat de 15s, watchdog de 30s no cliente com reconexão exponencial, indicador de conexão (`ConnectionIndicator`), sincronização entre abas via conexões independentes.
- **Heatmap Inteligente:** 6 camadas alternáveis (Aproximações, Conversões, Google Reviews, Instagram, Campanha atual, Última interação) — `domain/heatmap/` + `services/heatmap.service.ts`, deliberadamente sem depender do motor de resolução (ver ADR-025).
- **Live Presence:** toda mesa que recebe um evento ao vivo com `cardId` reaproveita o mecanismo de pulso `celebrate()` já existente da Fase 5 — nenhuma animação nova, o mesmo toque de confirmação que já existia para o drop de campanha.
- **Ghost Mode Evolution:** mudanças em massa (grupo de mesas, zona, empresa) passam por um "Preview Inteligente" com contagem, nomes das mesas afetadas e uma estimativa de impacto real antes de aplicar, mais um "Desfazer" disponível no toast de sucesso — ver ADR-028.
- **Time Machine + Playback:** reconstrução honesta do salão num instante passado a partir de `RedirectLog` (ver ADR-026, incluindo o limite documentado dessa abordagem), com um modo de reprodução acelerada dos últimos 30 minutos reaproveitando o mesmo pipeline de eventos do Live Mode.
- **Command Center:** nova tela em `/dev/ceo/command-center` compondo o Mapa de Mesas (com Live Mode/Heatmap já embutidos), KPIs animados, feed de eventos ao vivo e campanhas ativas — reaproveitando a arquitetura inteira já construída (Resolution Engine, RedirectLog, RBAC, Table Map, Design System) numa única tela, sem infraestrutura paralela, exceto uma casca de rotas somente-leitura escopada à empresa de demonstração (ver ADR-027, a única exceção documentada e necessária).
- Seed da Bella Vista passou a gerar atividade sintética (toques/avaliações/feedbacks das últimas 36h) — sem isso, Heatmap/Feed/Time Machine/Command Center abririam vazios.

## Escopo da Fase 7 (registrado, agora implementado)

**Objetivo:** parar de construir só funcionalidades e passar a construir ativos que vendem assinatura — o NFC OS deve responder sozinho perguntas que o empresário normalmente nunca conseguiria responder, nunca só mostrar dados brutos.

- **Arquitetura em 5 motores desacoplados:** `analytics-engine.service.ts` (KPIs, funil, comparativos, ROI, timeline executiva), `insights-engine.service.ts`, `forecast-engine.service.ts`, `ranking-engine.service.ts`, `export-engine.service.ts` — cada um com responsabilidade única e suas próprias consultas, ver ADR-030 para a única dependência deliberada entre eles.
- **KPIs executivos:** aproximações hoje, conversões, avaliações geradas, CTR do fluxo de avaliação, taxa de conversão, crescimento semanal/mensal, receita estimada influenciada (ROI Mode) — mais 6 cartões "melhor X" (campanha/zona/mesa/funcionário/horário/dia) vindos do Ranking Engine.
- **Funil Inteligente:** Aproximação → Página aberta → Clique → Conversão → Avaliação publicada, escopado ao fluxo de avaliação (o único caminho com múltiplas etapas rastreáveis) — ver ADR-030 para por que toques de campanha ficam de fora do funil.
- **Insights Automáticos:** motor de regras determinístico (não uma chamada a LLM) que gera frases em português a partir de comparações reais com limiar de amostra e significância — ver `domain/analytics/insights.ts`.
- **Ranking Inteligente:** leaderboards de campanha (por toques), zona/mesa/funcionário (por conversões), horário/dia (por conversões, em fuso horário local via `getLocalDateParts`), com filtro de período.
- **Comparativos automáticos:** hoje vs. ontem, semana vs. semana anterior, mês vs. mês anterior, sempre com variação percentual.
- **Timeline Executiva:** eventos reais (mudança de atribuição via `AuditLog`, início/fim de campanha agendada, pico de aproximações, recorde de avaliações) — cada entrada com instante específico linka para o Time Machine da Fase 6.
- **Forecast Inteligente:** projeção linear simples a partir do ritmo diário recente, sempre rotulada como estimativa — meta de avaliações configurável e tendência de toques da campanha mais usada.
- **ROI Mode:** três campos opcionais em `Company` (ticket médio, taxa de retorno, valor de novo cliente) transformam toques em receita estimada, com a fórmula exposta na UI — ver ADR-029.
- **Exportações Enterprise:** CSV achatado, Excel (`exceljs`, múltiplas abas formatadas) e PDF executivo (`@react-pdf/renderer`, sem headless browser) — ver ADR-031.
- **Command Center Evolution:** `/dev/ceo/command-center` ganhou funil vivo, ranking vivo, timeline viva, forecast e alertas inteligentes (insights de severidade "atenção"), com refresh periódico de 30s.
- Seed da Bella Vista ganhou um segundo cartão de equipe ("Garçom João") e vieses de geração deliberados e documentados (Happy Hour respeitando sua janela real de sexta 18h-22h, Varanda com taxa de conversão real, Mesa VIP 1 e João favorecidos) — a história "Happy Hour engaja no horário certo, Varanda converte melhor, Mesa VIP e João lideram avaliações" emerge de números reais recalculados, nunca de texto fixo.

## Escopo da Fase 8 (registrado, agora implementado)

**Objetivo:** parar de tratar filas/eventos/observabilidade como um "e se" e construir a espinha dorsal de confiabilidade que separa um produto que aguenta um cliente grande de um que só aguenta a demonstração — sem nunca colocar em risco a única coisa que não pode ficar mais lenta: o toque→resolução→redirecionamento.

- **Event Bus:** 10 eventos de domínio nomeados (`NFCTocado`, `RedirecionamentoResolvido`, `CampanhaCriada`, `CampanhaAtualizada`, `CampanhaEncerrada`, `FeedbackRecebido`, `AvaliacaoPublicada`, `ZonaAtualizada`, `MesaAtualizada`, `OrganizacaoAtualizada`), tipados de ponta a ponta em `domain/events/types.ts`, publicados via `publishEvent` — grava em `EventLog` (durável) antes de tentar rotear para filas (best-effort), nunca lança para quem chamou. Ver ADR-032.
- **Queue Engine:** 6 filas BullMQ/Redis (`analytics`/`webhooks`/`whatsapp`/`emails`/`exports`/`heavy`) com retry exponencial, dead-letter dedicado, idempotência via Redis `SET NX EX`. Rodam em produção serverless via um padrão de drenagem por tempo limitado acionado por Vercel Cron — ver ADR-033.
- **Worker Engine:** um processador por fila, cada um com claim de idempotência + contexto de correlação + span de tracing; worker de webhooks assina HMAC-SHA256 e roda atrás de um Circuit Breaker; workers de WhatsApp/e-mail são stubs honestos (nenhuma integração real existe). Ver ADR-033.
- **Observability Engine:** OpenTelemetry real (`NodeSDK`, exportador console — nenhum coletor configurado), Correlation ID/Request ID via `AsyncLocalStorage`, logger estruturado para os módulos novos desta fase, Sentry preparado (no-op sem DSN), métricas de cache/SSE/spans recentes — tudo honesto sobre o que está de fato conectado. Ver ADR-034.
- **Painel de Saúde** (`/dev/ceo/reliability`): estado real de Redis (REST + TCP)/filas/workers/cache/eventos-por-minuto/conexões SSE, atualizado a cada 5s, com os toggles de Chaos Mode e o painel de Event Replay.
- **Mission Control** (`/dev/ceo/mission-control`): tela única estilo NOC combinando o Mapa de Mesas ao vivo (Bella Vista) com o mesmo `reliability.service` do Painel de Saúde — nenhum número decorativo, os dois lados usam os serviços reais desta fase.
- **Chaos Engine:** 5 flags de injeção de falha (`redisDown`/`queueStalled`/`workerSlow`/`timeout`/`webhookFailure`), bloqueadas em produção por duas camadas independentes, com custo zero no caminho crítico quando desligadas. Ver ADR-035.
- **Event Replay:** `reconstructSequence` (somente leitura) e `replayToQueues` (reenfileira usando o `id` original, sem duplicar a trilha de auditoria) — ver ADR-032.
- **Segurança operacional:** rate limit por organização no roteamento de filas (`queueRouting`, 500/min) protege o Queue Engine compartilhado sem nunca afetar o redirecionamento nem a gravação em `EventLog` — ver ADR-032.
- **Simulador de Carga da Bella Vista** (`/api/dev/load-simulator`): dispara uma rajada de eventos reais contra a empresa de demonstração, para o Mission Control mostrar filas enchendo sem esperar tráfego real.

## Escopo da Fase 9 (registrado, agora implementado)

**Objetivo:** parar de expor "endpoints soltos" e construir uma plataforma — uma API pública que um desenvolvedor terceiro, que nunca viu este projeto, teria prazer em integrar.

- **REST API v1** (`src/app/api/v1/**`, isolada das rotas internas): recursos consistentes para cartões, campanhas + atribuições, zonas, unidades, organização, analytics, eventos, feedback e webhooks, todos seguindo o mesmo padrão de verbos (GET/POST/PATCH/DELETE) sem exceções arbitrárias.
- **Autenticação por `ApiKey`:** chave de servidor-a-servidor com escopos explícitos (`cards:read`, `campaigns:write`, etc.), nunca herdando papel/restrição de um usuário; segredo com hash SHA-256, nunca armazenado em texto puro. Nova permissão RBAC `developers:manage` (só OWNER/ADMIN) controla quem pode criar/revogar chaves. Ver ADR-036.
- **Paginação por cursor** em toda lista — `{ data, has_more, next_cursor }`, nunca offset.
- **Idempotência com replay de resposta:** `Idempotency-Key` em toda escrita — uma repetição dentro de 24h devolve a mesma resposta, nunca executa a mutação duas vezes; duas requisições concorrentes com a mesma chave não colidem (409 em vez de duplo efeito colateral).
- **Envelope de erro único:** `{ error: { code, message, request_id } }` em toda rota v1, com o mesmo Request ID dos logs/Correlation ID da Fase 8.
- **SDK oficial `@nfc-os/sdk`** (JavaScript/TypeScript): cliente tipado, erros tipados (`NFCOSApiError`), autopaginação, açúcar de conveniência (`campaigns.activate()`/`.pause()`) — real e completo, mas não publicado no npm (sem conta configurada neste ambiente). Ver ADR-038.
- **Webhooks Enterprise:** `WebhookEndpoint`/`WebhookDelivery` substituem o par único `Company.webhookUrl`/`webhookSecret` da Fase 8 — N endpoints por empresa, cada um assinando só os eventos públicos que quiser (`card.tapped`, `redirect.resolved`, `campaign.created/updated/ended`, `feedback.received`, `review.published`, `organization.updated`), HMAC-SHA256, retry exponencial, histórico completo com reenvio manual. Ver ADR-037.
- **Dashboard de Desenvolvedor** (`/dashboard/developers`): gestão real de chaves de API, endpoints de webhook (com histórico de entregas e reenvio), logs de chamadas reais (latência/status), e documentação rápida com snippets copiáveis (cURL/JS/TS/Node).
- **Playground público** (`/developers`): documentação, referência de recursos, e um explorador de API ao vivo que chama a API real contra a empresa de demonstração Bella Vista com uma chave fixa somente-leitura — sem exigir cadastro.
- Achado e corrigido durante a própria construção: `Branch`/`Zone` nunca tiveram uma capacidade de renomear (nem no dashboard interno) — um verbo PATCH faltando que só ficou óbvio ao desenhar a paridade de CRUD da API pública. Adicionado a ambos (interno e v1) — ver Achados do Architect Review em `RELATORIO_FASE_9.md`.

## Escopo da Fase 10 (registrado, agora implementado)

**Objetivo:** transformar cada cliente em dono de uma plataforma própria — não trocar um logo, mas fazer o produto inteiro (dashboard, login, QR, impressão) parecer construído exclusivamente para aquela empresa.

- **Identidade completa por empresa:** `Company` ganhou `secondaryColor`, `domainVerifiedAt`, `domainVerificationToken`, `loginHeadline`, `loginBackgroundUrl` (além de `faviconUrl`/`domain`, já preparados na Fase 9 — ver ADR-039). Subdomínio gratuito e imediato via `Company.slug` (`{slug}.dominio-raiz`), sem nenhuma configuração.
- **`DomainResolver`** (`lib/white-label/resolve-brand.ts`): resolve um `Host` para a marca de uma empresa, cacheado (`cachedOrLoad`, TTL 120s) — nunca resolve um domínio customizado não verificado. Roda dentro das páginas de login/cadastro (Server Components, runtime Node), não no middleware (Edge Runtime não sustenta o Prisma — um erro real de build encontrado e corrigido, ver ADR-042).
- **Domínio customizado com verificação real:** DNS-over-HTTPS (Cloudflare) confirma um registro TXT antes de `domainVerifiedAt` ser preenchido — nunca finge verificar. O apontamento de CNAME e a emissão de SSL continuam manuais, do lado da hospedagem (Vercel Domains ou equivalente) — um limite honesto, documentado, não escondido.
- **`BrandProvider`** (`components/white-label/brand-provider.tsx`): único ponto de verdade para cor/logo em runtime, usado no layout do dashboard e nas telas de login — sem reescrever componentes já estáveis (`AppSidebar` continua recebendo prop, ver ADR-040).
- **Login com marca própria:** fundo/logo/mensagem customizáveis, cor do Clerk via `appearance.variables.colorPrimary` (a API oficial do Clerk) — autenticação em si nunca duplicada (ver ADR-041).
- **Assets Inteligentes:** favicon, Apple Touch Icon, Open Graph, Twitter Card e Web App Manifest dinâmicos (`/api/brand/{icon,og,manifest}`), resolvidos por Host a cada requisição — sem favicon/logo próprio, gera um distintivo com a inicial do nome sobre a cor da marca. O `favicon.ico` estático foi removido de propósito (ver ADR-043).
- **QR Code White Label:** cor da marca sempre passa por uma checagem real de contraste (`ensureScannableDark`, ≥7:1) antes de virar QR — nunca um QR bonito e ilegível.
- **Impressão Profissional (bônus):** 5 formatos com dimensões físicas reais (adesivo, cartão PVC padrão CR80, displex de mesa, cavalete A4, plaquinha), gerados com `@react-pdf/renderer`, sem canvas/`sharp` (ver ADR-044).
- **Theme Studio** (`/dashboard/branding`): preview ao vivo (dashboard/login/QR/mockups físicos) que muda instantaneamente ao arrastar um seletor de cor, sem salvar primeiro — rascunho em estado local, nunca persistido até "Salvar."
- **Brand Motion System (bônus):** glow e ripple derivados automaticamente da cor da marca via `color-mix`, com fallback para a cor padrão do produto fora de um `BrandProvider` — zero configuração manual.
- **Segurança:** primeiro CSP do produto (via Clerk, `report-only` — nunca existiu nenhum antes desta fase, achado registrado) e HSTS real (`next.config.ts`). Ver ADR-045.
- **Preparação (não implementação) para as Fases 11, 12 e 13** — ver ADR-046.
- Achado e corrigido durante a própria construção: a primeira versão do `DomainResolver` chamava o Prisma de dentro do `middleware.ts` — o Edge Runtime deste Next.js não sustenta isso, e o build de produção falhou de verdade (não uma suposição). Corrigido movendo a resolução para as páginas de login/cadastro. Ver ADR-042 e Achados do Architect Review em `RELATORIO_FASE_10.md`.

## Escopo da Fase 11 (registrado, agora implementado)

**Objetivo:** transformar Analytics em ações automáticas — o empresário para de abrir um dashboard para descobrir o que fazer; o próprio sistema propõe a próxima melhor ação, com transparência total e execução em um clique.

- **Biblioteca de Playbooks:** catálogo declarativo global (`Playbook`, nunca por empresa), 7 playbooks reais (Happy Hour Boost, Google Review Recovery, Instagram Momentum, VIP Table Recovery, Silent Zone Rescue, Lunch Rush Optimization, Weekend Accelerator), cada um combinando um de 7 `PlaybookTriggerType` com um de 4 `PlaybookActionType` — nenhuma linha de código por playbook, só dados (ver ADR-048).
- **Confidence Engine** (`domain/playbooks/confidence-engine.ts`): score 0-1 determinístico (amostra + magnitude do efeito + atualidade), com o detalhamento fator-a-fator sempre visível — nunca um número decorativo.
- **Recommendation Center** (`/dashboard/playbooks`): cartões premium mostrando impacto estimado, confiança, tempo esperado, e três ações (Aplicar/Ver motivo/Ignorar); Explainability Panel mostra dados usados, confiança fatorada, regra disparada — nunca uma justificativa inventada.
- **One-Tap Execution:** aplicar reaproveita o mesmo padrão do Ghost Mode (Fase 5/6) — preview de impacto antes, nunca execução silenciosa, Desfazer sempre disponível depois.
- **Scheduler Inteligente:** executar agora/depois/repetir/pausar, reaproveitando o Queue Engine (Fase 8) — `delay`/Job Scheduler nativos do BullMQ, nenhuma infraestrutura nova.
- **AutoPilot Seguro:** 4 níveis (Manual/Recomendado/Semi-automático/Automático); só playbooks marcados `safeForAutomation` e com confiança ≥75% podem agir sozinhos, sempre com um teto diário de execuções, log completo no Event Bus e Desfazer disponível (ver ADR-049).
- **Executive Copilot:** coluna "Próximas melhores ações" no Command Center, com a única rota de escrita que `/dev/ceo` já teve — uma exceção estreita e documentada a ADR-027 (ver ADR-051).
- **ROI Antes da Execução:** toda recomendação mostra conversões/avaliações/receita esperadas, reaproveitando a mesma fórmula do ROI Mode (Fase 7) — nunca uma promessa, sempre rotulado como estimativa.
- **Heatmap Preditivo:** tendência aquecendo/esfriando por mesa (comparação de janela atual vs. anterior, mesma rota `/api/heatmap` já existente), com uma animação de "respiração" leve para mesas aquecendo.
- **Demo Premium:** dados sintéticos da Bella Vista enviesados para o cenário "Varanda converte melhor às 18h-22h" e "Mesa VIP 1 está silenciosa" dispararem de verdade, para o roteiro de demonstração ter um caso real, não fabricado.
- Achado e corrigido durante a própria construção: o risco de loop infinito de automação (aplicar um playbook publica eventos que poderiam reavaliar gatilhos e reaplicar) foi fechado estruturalmente — a fila de avaliação nunca escuta os eventos que a própria execução produz (ver ADR-050 e Achados do Architect Review em `RELATORIO_FASE_11.md`).

## Escopo da Fase 12 (registrado, agora implementado)

**Objetivo:** eliminar a dependência de um harness descartável para sempre, e dar ao produto um ambiente de demonstração permanente onde qualquer pessoa — investidor, franquia, cliente ou desenvolvedor — entende o valor em menos de 30 segundos, sem cadastro, sem imaginar como seria em produção.

- **Dev Runtime** (`src/lib/dev-runtime/`): `DEV_RUNTIME=1` faz `getAuthContext()` resolver direto para um `User` real semeado, sem chamar o Clerk — `middleware.ts` (passthrough) e `layout.tsx` (sem `<ClerkProvider>`) reagem a isso permanentemente, nunca mais editados à mão. Ver ADR-052.
- **Scenario Engine** (`services/scenario-engine.service.ts`): 7 cenários reais (Happy Hour, Restaurante Lotado, Avaliações Disparando, Zona Silenciosa, Franquia, Falha de Redis, AutoPilot Trabalhando) — cada um cria dados reais e chama serviços reais (Playbook Engine, Event Bus, Chaos Mode, AutoPilot), nunca fabrica um estado de UI. Ver ADR-053.
- **Demo OS** (`/demo`, público, alcançável em produção): narrativa de 9 momentos guiados (hero → mapa vivo → eventos → KPIs → heatmap respirando → playbooks → AutoPilot → ROI → White Label), reaproveitando o `TableMapView`, o Heatmap Preditivo (Fase 11) e o `BrandProvider` (Fase 10) por completo.
- **Demo Timeline**: `usePlayback` (Fase 6) estendido com velocidade (1x/2x/5x) e salto para "momentos importantes" — mesmo histórico do Event Bus, nunca um paralelo.
- **White Label Live Switch**: troca instantânea entre 3 empresas reais (Bella Vista, Sushi House, Nova Steakhouse — nomes fictícios, nunca marcas de terceiros) via `BrandProvider`, sem reload.
- **Investor Mode** (`/demo/investor`): a mesma experiência do Demo OS, avançando sozinha pelos 9 momentos, pensada para caber em ~2 minutos.
- **Dev Command Center v2** (`/dev/command-center`, ferramenta de engenharia, sempre bloqueada em produção): compõe o Reliability Engine (Fase 8) com webhooks/playbooks/AutoPilot/cenário atual — nunca recalcula o que já existia (ver ADR-055). Event Explorer dedicado (`/dev/command-center/events`) com payload/correlação/replay/duração. State Inspector (por mesa) e Network Inspector (ApiRequestLog) como painéis. Visual Event Flow — partículas reais viajando por um pipeline NFC→Resolution→Event Bus→Analytics→Playbooks→Command Center, nunca decorativas.
- **Nenhum banco embarcado/em memória foi construído** — decisão de escopo deliberada, ver ADR-054.
- Achado e corrigido durante a própria construção: `/demo` tentava ser pré-renderizada estaticamente no build (o Next.js trata todo Server Component `async` sem sinal de dinamismo como candidato a página estática), o que congelaria os dados da Bella Vista no momento do build — corrigido com `export const dynamic = "force-dynamic"`.
- Achado e corrigido sob Zero Dívida Silenciosa: a lista de tipos de evento do seletor de Event Replay (`/dev/ceo/reliability`) estava desatualizada desde a Fase 11 (faltavam os 3 eventos de Playbook) — corrigida.

## Reprioritização: Mapa de Mesas antes do Design System

Originalmente sequenciada como Fase 4.5 e depois Fase 5. Reordenada a pedido explícito assim que a Fase 4 foi entregue: o Mapa de Mesas é a tela mais importante do produto, e precisava nascer com a arquitetura correta primeiro — a fase de Design System então transforma *esses* componentes reais no "NFC OS Design Language" de `packages/ui`, em vez de construir componentes teóricos antes da tela que de fato os testaria sob estresse. O Mapa de Mesas (Fase 5) está concluído; a Fase 4.5 seguiu a próxima na fila, e agora também está concluída.

## Escopo da Fase 4.5 (registrado, agora implementado)

Ao final da Fase 4, o domínio e a arquitetura ainda estavam sendo consolidados (hierarquia multi-unidade, RBAC); com a Fase 5 (Mapa de Mesas) pronta, praticamente todo formato de tela que o produto precisa já existe e é real. Esse foi o momento em que um passe de identidade visual toca a maior superfície com o menor retrabalho — feito antes, teria perseguido um alvo móvel e chutado os formatos reais dos componentes do Mapa de Mesas; feito agora, reveste telas que já existem e já funcionam.

**Objetivo:** dar ao produto uma identidade visual própria — inspirada em Stripe, Linear, Vercel, Notion, Raycast e na Apple Human Interface Guidelines — em vez de "um app de shadcn," sem uma reescrita.

- Tokens de design próprios: cor, tipografia, espaçamento, radius, sombra, motion, z-index e breakpoints.
- Pacotes próprios: `packages/ui`, `packages/design-tokens`, `packages/icons`, `packages/animations` — implementados como pastas com alias de import próprio (`@nfc-os/*`) dentro do app Next.js único existente, não como um monorepo real com workspaces/build separados. Ver ADR-022 para o porquê dessa escolha e quando reconsiderá-la.
- shadcn/ui continua sendo a base oficial do sistema de componentes — não substituído.
- MCPs de design tratados como aceleradores de engenharia, nunca como dependência do produto — ver "Integração de MCPs" abaixo para o que foi detectado neste ambiente e como conectar o que não está disponível.
- **Ordem de prioridade explícita, por instrução:** priorizar construir os componentes próprios do produto em vez de depender permanentemente de qualquer uma das bibliotecas/MCPs acima. shadcn/Magic UI/MCPs aceleram chegar lá; a identidade do produto (`packages/ui`) é o que é entregue e do que se depende no longo prazo.
- Glassmorphism leve, skeleton loading onde dados carregam, dark mode feito de verdade (não um toggle de última hora), um motion system de verdade (não props de Framer Motion espalhadas ad-hoc por componente).
- Componentes premium reutilizáveis: Card KPI, Card Analytics, Card Campanha, Card Zona, Card Mesa, Card Organização, Modal/Drawer/Popover Premium, Command Palette, Empty States, Skeleton States, Timeline, Activity Feed, Heatmap Card, Badge Inteligente, Avatar Stack, Permission Matrix.
- O resultado tem nome: **NFC OS Design Language.**

## Integração de MCPs (Fase 4.5)

Verificação feita no início desta fase, via o registro de MCPs conectável a esta sessão: **nenhum conector estava instalado**, e uma busca pelos termos "shadcn," "ui components," "design system," "magic ui," "figma," "design" não retornou nenhum resultado no registro disponível para esta conta. Ou seja: nenhum dos MCPs priorizados (Shadcn UI MCP, Magic UI MCP, Design MCP, Shadcn Space) estava conectado ou detectável neste ambiente.

Como consequência, todo o trabalho desta fase foi feito com componentes internalizados à mão, sobre a stack já existente (shadcn/ui + Tailwind v4 + Radix + Framer Motion) — nada no produto depende de um MCP para funcionar, hoje ou depois. A arquitetura (tokens centralizados, componentes de `packages/ui` com uma API estável) foi desenhada para plug-and-play: se um MCP de design for conectado depois, ele pode gerar/ajustar componentes que se encaixam nos tokens e convenções já estabelecidos, sem retrabalho estrutural.

Instruções de instalação para quando o usuário quiser conectar manualmente (verificadas nesta fase, não copiadas de memória):

- **Shadcn MCP** — `npx shadcn@latest mcp init --client claude`, ou manualmente em `.mcp.json`:
  ```json
  { "mcpServers": { "shadcn": { "command": "npx", "args": ["shadcn@latest", "mcp"] } } }
  ```
  Depois de configurado, reiniciar o Claude Code e rodar `/mcp` para confirmar. Dá acesso a navegar componentes, buscar em registries, instalar por linguagem natural. Fonte: [ui.shadcn.com/docs/mcp](https://ui.shadcn.com/docs/mcp).
- **Magic UI / 21st.dev MCP** — `npx @21st-dev/cli@latest install claude --api-key <chave>`, ou manualmente:
  ```json
  { "mcpServers": { "@21st-dev/magic": { "command": "npx", "args": ["-y", "@21st-dev/magic@latest", "API_KEY=\"sua-chave\""] } } }
  ```
  Exige uma chave de API gratuita (com limite de uso) do console em 21st.dev. Fonte: [github.com/21st-dev/magic-mcp](https://github.com/21st-dev/magic-mcp).
- **Shadcn Space** — um registry/MCP complementar de blocos e componentes shadcn; documentação de configuração em [shadcnspace.com/docs/getting-started/mcp-server-docs](https://shadcnspace.com/docs/getting-started/mcp-server-docs).
- **Design MCP genérico** — nenhum conector com esse nome exato foi encontrado no registro; se o usuário tiver um específico em mente (Figma, outro), procurar por nome exato no registro de MCPs ou instalar via `.mcp.json` manualmente seguindo a documentação do provedor.

## Por que esta ordem

A Fase 1 é o pipeline em que tudo mais se encaixa — precisa existir antes de uma UI de Campaign Manager (Fase 2) ter algo para gerenciar, antes de Regras (Fase 3) terem algo para filtrar, antes do Mapa de Mesas (Fase 5) ter algo para atribuir campanhas.

**Desvio do plano original, feito deliberadamente na Fase 2:** o plano original da Fase 1 adiava toda modelagem de `Organization`/`Branch`/`Zone` para a Fase 4, raciocinando que o formato final da hierarquia multi-unidade ainda não estava decidido. O escopo aprovado da Fase 2 pedia explicitamente atribuição "para a empresa inteira, uma unidade, uma zona, ou um cartão específico" — o que exige *algum* conceito de Branch/Zone existir já, não depois. Em vez de travar nesse pedido, a Fase 2 lança a menor versão que o desbloqueia: `Branch`/`Zone` como tabelas simples, opcionais, escopadas por empresa (uma empresa sem nenhuma das duas é um negócio de localização única, inafetado). A decisão maior, ainda adiada — a hierarquia completa de franquia com `Organization` envolvendo múltiplas empresas — ficou para a Fase 4, agora construída *sobre* as tabelas da Fase 2 em vez de do zero. O `/dev/ceo` também foi antecipado da Fase 12 para a Fase 2 a pedido explícito; o ambiente `/demo/*` mais rico (50 mesas, heatmap, 90 dias de dados) continua na Fase 12 já que ainda precisa genuinamente do Mapa de Mesas + Analytics existirem primeiro.

**Decisão de escopo da Fase 3, feita deliberadamente:** `Rule` só adiciona condições *temporais* (dia/hora/data) e *contextuais* (dispositivo) — NÃO ganha dimensões de mesa/zona/unidade/estado-de-campanha, mesmo essas aparecendo na lista de desejos de longo prazo. Segmentação por mesa/zona/unidade já é trabalho de `CampaignAssignment.scope` (Fase 1/2); a ordenação de prioridade/janela de uma campanha já trata "quando a campanha X terminar, volte para Y" sem precisar de uma regra especial para isso (verificado diretamente — ver `RELATORIO_FASE_3.md`). Adicionar dimensões de regra que duplicam um mecanismo existente criaria duas formas de expressar a mesma coisa e uma ambiguidade sobre qual vence; a Fase 3 deliberadamente mantém uma só.

**Decisão de escopo da Fase 4, feita deliberadamente:** `Organization` é lançada como um wrapper opcional *acima* de `Company`, não uma renomeação dela — `Company` continua sendo a única fronteira de isolamento de tenant pela qual toda consulta existente já é escopada. Ver ADR-013 em `DECISOES_DE_ARQUITETURA.md` para as três opções pesadas e por que esta foi escolhida. Os pontos de extensão para mercados de franquia explicitamente pedidos (hotéis, academias, clínicas, coworkings, varejo) são deliberadamente NÃO construídos nesta fase — ver ADR-018 — só a hierarquia genérica e agnóstica de vertical (`Organization → Branch → Zone → ativo`) sobre a qual esses mercados eventualmente se encaixariam.

**Decisão de escopo da Fase 5, feita deliberadamente:** o layout do Mapa de Mesas vive direto em `NFCCard` (ver ADR-019) em vez de uma nova entidade, e seu preview de status por mesa reaproveita a ordenação de especificidade do motor de resolução sem reimplementar avaliação de regra/hora/dispositivo (ver ADR-020) — uma visão deliberadamente aproximada de "o que está configurado," não "o que um cliente veria neste segundo." Estender a verificação de unicidade de atribuição de campanha para todo escopo (ver ADR-021) foi uma correção de corretude que surgiu ao construir o endpoint de atribuição em lote desta fase, não escopo adicional da Fase 5.

**Decisão de escopo da Fase 4.5, feita deliberadamente:** `packages/{ui,design-tokens,icons,animations}` são pastas com alias de TypeScript dentro do app Next.js único existente, não um monorepo real com workspaces separados (pnpm/turborepo) e seus próprios `package.json`/build — ver ADR-022. Nenhum MCP de design estava disponível neste ambiente (ver "Integração de MCPs" acima), então todo componente foi construído à mão, sobre a stack já existente.

**Decisão de escopo da Fase 6, feita deliberadamente:** Live Mode é SSE com polling, não WebSocket real (ver ADR-025) — uma escolha de infraestrutura honesta para o alvo de deploy serverless deste projeto, não uma simplificação silenciosa do que foi pedido. Time Machine reconstrói o passado a partir de `RedirectLog` (o único histórico de verdade que existe), não de uma reconstrução perfeita de atribuições que o schema não sustenta — ver ADR-026. O Command Center em `/dev/ceo` precisou de um pequeno par de rotas somente-leitura escopadas à empresa de demonstração (ver ADR-027) para poder reaproveitar `TableMapView` inteiro sem uma sessão real por trás — a única duplicação desta fase, e deliberadamente mínima (a casca da rota, nunca a lógica de serviço).

**Decisão de escopo da Fase 7, feita deliberadamente:** um limite estrutural real foi descoberto ao desenhar o Analytics Enterprise — nenhuma campanha consegue, honestamente, "gerar uma avaliação" neste modelo de dados (ela redireciona o cliente para fora do produto antes de qualquer avaliação existir), então toda comparação de campanha usa toques, nunca avaliações (ver ADR-030). Insights Automáticos são um motor de regras determinístico com limiar de amostra/significância, não uma chamada a um LLM — cada frase vem com a evidência numérica exata por trás, nunca uma alegação solta. ROI Mode nunca estima com dado parcial: os três parâmetros só entram em vigor juntos, e "ROI da campanha"/"custo por avaliação" só existem para campanhas com custo auto-declarado (ver ADR-029). Exportação em PDF usa `@react-pdf/renderer` em vez de um headless browser — a mesma lógica de "sem infraestrutura exótica" do ADR-025, aplicada de novo (ver ADR-031).

**Decisão de escopo da Fase 8, feita deliberadamente:** `EventLog.companyId`/`organizationId` são strings indexadas simples, sem foreign key — um log de eventos precisa sobreviver e se desacoplar do estado atual das entidades que descreve (ver ADR-032). BullMQ não sustenta um `Worker` sempre ativo em serverless; em vez de fingir isso ou exigir uma VM dedicada, a Fase 8 constrói um padrão de drenagem por tempo limitado acionado por Cron — o mesmo tipo de honestidade de infraestrutura do ADR-025, agora aplicado a filas (ver ADR-033). Nem OpenTelemetry nem Sentry têm um coletor/projeto real configurado neste ambiente — ambos rodam de verdade (spans reais, SDK real) mas exportam para onde é possível sem uma conta externa (console / no-op), nunca fingindo uma conexão que não existe (ver ADR-034). "Traces ativos" foi deliberadamente reformulado para "spans registrados nos últimos ~2 minutos" no Mission Control — um `ConsoleSpanExporter` não sustenta honestamente a primeira alegação (ver ADR-034).

**Decisão de escopo da Fase 9, feita deliberadamente:** `Company.webhookUrl`/`webhookSecret` (Fase 8) foram removidos, não mantidos ao lado do novo `WebhookEndpoint` — duas formas de fazer a mesma coisa seria exatamente a "duplicação de contratos" que o Platform First Review pede para caçar, e não havia dado real em produção para migrar (ver ADR-037). O SDK `@nfc-os/sdk` é código real e completo, mas não publicado no npm — este ambiente não tem uma conta/pipeline de publicação, e fingir isso seria uma alegação não verificável (ver ADR-038, mesma honestidade do OpenTelemetry/Sentry na Fase 8). `ForbiddenError` dos serviços internos vira 404 (não 403) na API pública só quando a rota está buscando um recurso por id (`notFoundIfMissing`) — um erro de regra de negócio genuína (ex.: limite de plano) continua 403, porque um desenvolvedor terceiro precisa da distinção certa entre "não existe" e "não pode" (ver ADR-036). Dois dos 10 eventos do Event Bus (`ZonaAtualizada`/`MesaAtualizada`) ainda não têm um nome público de webhook — não fazem parte do contrato externo desta fase, deliberadamente.

**Decisão de escopo da Fase 10, feita deliberadamente:** o `DomainResolver` roda dentro das páginas de login/cadastro, nunca do `middleware.ts` — não por preferência de estilo, mas porque a primeira versão (no middleware, como o pedido original desenhava) quebrou um build de produção de verdade: o Edge Runtime não sustenta o Prisma (ver ADR-042). Branding vive em `Company`, não em `Organization` — nada nesta fase pediu explicitamente uma marca compartilhada entre múltiplas empresas de uma mesma franquia, e inventar essa camada sem um pedido real seria escopo não solicitado; o caminho natural para isso, se um dia for pedido, é a API Pública da Fase 9 (configurar a mesma marca em N empresas via um script), não uma nova tabela agora. Mockups físicos (mesa/balcão/vitrine/porta/quarto/cartão) são ilustrações 2D em CSS, nunca renders 3D — um motor de renderização 3D seria uma infraestrutura desproporcional ao que foi pedido ("consegue visualizar antes de imprimir"), que uma ilustração 2D honesta já satisfaz (ver ADR-044). O CSP ligado nesta fase é `report-only`, não bloqueante — introduzir o primeiro CSP do produto em modo bloqueante sem conseguir testar contra um navegador real neste sandbox arriscaria quebrar algo imprevisível em produção (ver ADR-045).

**Decisão de escopo da Fase 11, feita deliberadamente:** `Playbook` é um catálogo GLOBAL, não por empresa — a "biblioteca" pedida é uma coleção compartilhada de receitas, e `PlaybookRecommendation` (por empresa) já resolve a personalização por instância; inventar uma camada de customização por tenant sem um pedido real seria escopo não solicitado (ver ADR-048). `CREATE_AND_ASSIGN_CAMPAIGN` só cria campanhas WHATSAPP/GOOGLE_REVIEWS — os dois únicos tipos cujo dado de configuração é garantido existir em `Company`, nunca uma URL de Instagram/cardápio inventada. AutoPilot no nível Automático executa de verdade sem confirmação humana — aceito explicitamente pelo pedido, cercado por confiança mínima de 75% e um teto diário de execuções, nunca ilimitado (ver ADR-049). A fila de avaliação de gatilhos nunca escuta eventos que a própria execução de playbook produz — a proteção estrutural contra um loop de automação, encontrada e fechada durante a própria construção, não depois (ver ADR-050). O Command Center ganhou sua única rota de escrita — uma exceção estreita e documentada a ADR-027, nunca uma reabertura geral de escrita nessa área (ver ADR-051).

**Decisão de escopo da Fase 12, feita deliberadamente:** nenhum banco de dados embarcado/em memória foi construído para o Live Sandbox — o gargalo real que forçava editar arquivos a cada fase era sempre autenticação (Clerk), nunca a ausência de Postgres em si; resolver isso (Dev Runtime) entrega o essencial de "Self-Healing Development" sem a instabilidade de uma dependência experimental (PGlite + um adaptador Prisma não oficial, nunca testado contra Prisma 7) — ver ADR-052/ADR-054. "Redis fake"/"filas fake" não precisaram ser construídos porque já existem desde a Fase 1/8 (degradação graciosa sem Redis) — o Dev Runtime reconhece isso, não duplica. O Demo OS é deliberadamente PÚBLICO e alcançável em produção (ao contrário de todo `/dev/*`), protegido por limite de taxa por IP em vez de `NODE_ENV` — porque "funciona sem cadastro" foi um requisito explícito, não um descuido de segurança (ver ADR-053). O cenário "Falha de Redis" reaproveita o Chaos Mode da Fase 8 sem nenhum gate novo, porque `setChaosFlag`/`isChaosActive` já eram auto-protegidos contra produção em duas camadas independentes desde então. Nomes de marca no White Label Live Switch são sempre fictícios (Sushi House, Nova Steakhouse) — nunca uma marca real de terceiro, mesmo numa demonstração.

## Não-objetivos explícitos das fases atuais

- Sem teste de carga / medição de latência — este ambiente de desenvolvimento não tem conexão real com Postgres ou Redis. As fases 1+ deixam o *design* consciente de latência; provar números exige uma implantação real.
- Sem feed ao vivo de erro-de-build/status-de-migração dentro de `/dev` — isso precisa de um processo em segundo plano acompanhando logs, o que pertence ao Command Center v2 da Fase 12.
- Sem seletor de fuso horário em Configurações ainda — `Company.timezone` (Fase 3) tem padrão `America/Sao_Paulo` e é usado por toda avaliação de Regra, mas não há UI para mudá-lo para uma empresa fora desse fuso. Um campo de Configurações, não um bloqueador da Fase 3.
- Regras se combinam só com AND — sem OR / grupos de regra. Uma campanha precisando de "sexta OU sábado, 18-22h" precisa hoje de duas regras DAY_OF_WEEK inclusivas (`days: [5,6]`), não dois conjuntos alternativos de regras.
- `RuleExecutionLog.ruleResults` pode conter IDs de regra sintéticos (`recurrence:<campaignId>:day`) para verificações derivadas de recorrência que não correspondem a uma linha real de `Rule` — esperado, não um bug, mas vale saber antes de unir esta tabela de volta a `Rule` numa futura fase de analytics.
- Sem modelagem específica de hotel/academia/clínica/coworking/varejo na Fase 4 — só a hierarquia genérica `Organization → Branch → Zone` sobre a qual esses mercados eventualmente construiriam (ver ADR-018). Também não existe ainda UI para uma empresa *entrar* numa organização já existente como uma unidade de franquia adicional — a Fase 4 lança a criação de uma nova organização a partir de uma empresa que não tem nenhuma; adicionar mais empresas a uma já existente é um próximo passo natural, não construído agora.
- Sem trilha de auditoria para mutações feitas fora de uma rota autenticada do dashboard (um futuro script ou worker de fila chamando uma função de serviço diretamente não seria registrado) — ver ADR-017.
- A atribuição de campanha por arrastar-e-soltar do Mapa de Mesas usa a API nativa HTML5 Drag and Drop, que não tem equivalente em dispositivo touch — arrastar um chip de campanha sobre uma mesa não funciona em tablet ou celular. Um gerente de restaurante com um tablet no salão é um usuário realista exatamente para essa funcionalidade; uma alternativa baseada em toque (selecionar uma campanha, depois tocar nas mesas para aplicar — o mesmo padrão já usado para posicionar uma mesa não posicionada) é um próximo passo natural da Fase 5.x, não construído agora. Sinalizado durante o Product Review desta fase, não descoberto depois.
- O preview de status do Mapa de Mesas mostra o que está *configurado*, não o que um cliente veria neste instante — ver ADR-020. Não avalia condições de dia/hora/data/dispositivo de `Rule` nem roda seleção de variante A/B.
- Ainda não existe forma de excluir uma mesa do próprio Mapa de Mesas (já existe na página de Cartões), e ainda não existe nenhuma UI para redimensionar ou rotacionar uma mesa — `layoutWidth`/`layoutHeight`/`layoutRotation` são lidos (toda mesa renderiza no seu tamanho/rotação salvos) e a API já aceita atualizações neles, mas nada no canvas deixa um comerciante mudá-los interativamente ainda (uma alça de redimensionar/rotacionar é um próximo passo natural da Fase 5.x).
- `packages/{ui,design-tokens,icons,animations}` (Fase 4.5) não são pacotes npm publicáveis com versão própria — são pastas com alias de import limpo dentro do app único. Uma conversão real para workspaces só se justifica quando existir um segundo consumidor de verdade (ex.: um SDK de API pública) que precise de pacotes publicados/versionados — ver ADR-022.
- Nenhum MCP de design (Shadcn UI MCP, Magic UI MCP, Design MCP, Shadcn Space) estava conectado neste ambiente durante a Fase 4.5 — instruções de instalação manual estão em "Integração de MCPs" acima.
- Live Mode não é WebSocket real nesta fase — é SSE com polling de banco a cada 2s (ver ADR-025). A arquitetura do lado do cliente (`useLiveConnection`) já isola isso o bastante para trocar o transporte sem tocar em quem o consome, se um dia se justificar.
- Time Machine não reconstrói com precisão perfeita "qual atribuição de campanha estava ativa" num instante passado — não existe histórico de atribuições no schema atual, e fingir essa precisão seria inventar um dado que o produto não tem. Reconstrói, honestamente, a última campanha que cada mesa realmente serviu até aquele instante, a partir de `RedirectLog` — ver ADR-026.
- O Command Center em `/dev/ceo` não tem edição/atribuição de campanha própria — é uma tela de observação (`canEditLayout`/`canAssign` desligados). Arrastar uma campanha continua exclusivo do dashboard real e autenticado.
- Playback Mode reproduz no máximo os últimos 30 minutos de eventos (limite de 300 eventos por chamada) — não é um scrubber arbitrário sobre todo o histórico da empresa.
- Nenhuma campanha aparece em ranking/insight por "avaliações geradas" — o modelo de dados não permite essa atribuição honesta (ver ADR-030). Campanhas são comparadas por toques (uso), nunca por conversão.
- Insights Automáticos são um motor de regras determinístico, não uma IA generativa de verdade — nenhuma chamada a um LLM, nenhum custo/latência de API externa, e cada frase vem com os números exatos que a geraram.
- ROI Mode e "custo por avaliação"/"ROI da campanha" são estimativas configuradas pelo próprio empresário (ticket médio, taxa de retorno, custo da campanha) — não há integração de gasto de anúncio nem confirmação de receita real; nunca calculado com valor parcial ou padrão inventado.
- Forecast Inteligente é uma projeção linear simples (taxa diária recente extrapolada), não um modelo estatístico com sazonalidade — sempre rotulado como estimativa, nunca como previsão garantida.
- Exportação em PDF usa `@react-pdf/renderer` (sem headless browser) — suficiente para um relatório executivo de texto/tabelas, não para embutir os gráficos interativos do dashboard como imagens vetoriais complexas.
- O Command Center Evolution atualiza funil/ranking/timeline/forecast a cada 30s (polling), não via push instantâneo como os eventos do Live Mode — agregados que não mudam a cada segundo não justificam um segundo canal SSE.
- Nenhum coletor real de OpenTelemetry (Honeycomb, Grafana Cloud, Jaeger) nem projeto Sentry real está configurado neste ambiente — ambos os SDKs rodam de verdade, exportando para console/no-op; ver ADR-034.
- Um Worker do BullMQ não fica sempre ativo em produção serverless — processa em ciclos de ~45s acionados por Vercel Cron a cada minuto, não instantaneamente; um job pode esperar até ~1 minuto antes de ser pego. Ver ADR-033.
- Chaos Mode simula falha só nos módulos que a Fase 8 construiu (Redis/fila/worker/webhook) — não simula o próprio Postgres fora do ar nem outra infraestrutura fora do escopo desta fase.
- "Traces ativos" não existe como métrica honesta sem um coletor real — o Mission Control mostra "spans registrados nos últimos ~2 minutos" (spans já finalizados), nunca requisições em andamento. Ver ADR-034.
- Rate limit por organização (`queueRouting`) protege só o roteamento de eventos para filas, não o redirecionamento público em si (já protegido por IP desde a Fase 1) nem nenhuma outra rota — um limite mais amplo por organização é trabalho de uma fase futura de API pública (Fase 9).
- `/dev/ceo/mission-control` e `/dev/ceo/command-center` exigem a empresa de demonstração (`bella-vista`) existir num Postgres alcançável — sem um banco real conectado, a página inteira falha (mesma limitação já aceita desde a Fase 6 para o Command Center, não uma regressão desta fase).
- `@nfc-os/sdk` não está publicado no npm — código real e completo, mas sem conta/pipeline de publicação configurados neste ambiente; usável hoje só de dentro deste monorepo ou copiando a pasta `packages/sdk/src`. Ver ADR-038.
- Nem todo evento do Event Bus tem um nome público de webhook ainda — `ZonaAtualizada`/`MesaAtualizada` continuam internos; um `WebhookEndpoint` não consegue assiná-los nesta fase. Ver ADR-037.
- A API pública v1 não tem um limite de taxa por organização mais amplo que o de cada `ApiKey` individualmente — um cliente com várias chaves soma capacidade, não é limitado como uma única organização. Um próximo passo natural, não construído agora.
- O Playground em `/developers` só executa chamadas de LEITURA (a chave de demonstração semeada não tem nenhum escopo de escrita) — não é possível criar/editar/excluir nada da empresa Bella Vista a partir dele, por design.
- O Dashboard de Desenvolvedor (`/dashboard/developers`) não tem um "modo de teste" separado de "modo de produção" (ao contrário da Stripe) — este produto não tem hoje o conceito de ambiente sandbox vs. live para a própria API pública; toda chave criada é imediatamente capaz de agir sobre os dados reais da empresa, dentro do escopo escolhido.
- Branding é por `Company`, não por `Organization` — uma franquia com várias empresas sob uma organização não tem hoje um jeito de configurar UMA marca compartilhada entre todas de uma vez pela UI; cada empresa configura a sua própria (ver ADR-042 para o caminho natural via API pública, se um dia for pedido).
- Verificação de domínio confirma posse via DNS TXT, mas o apontamento de CNAME e a emissão do certificado SSL continuam manuais, do lado do provedor de hospedagem — nenhum dos dois é algo que código sozinho, sem uma conta de produção real, consegue fazer. Ver ADR-042.
- Mockups físicos (mesa/balcão/vitrine/porta/quarto/cartão) no Theme Studio são ilustrações 2D em CSS, nunca renders 3D fotorrealistas — suficientes para confirmar a composição de marca, não para substituir uma prova física antes de um pedido grande de impressão. Ver ADR-044.
- QR/impressão não compõem um logo DENTRO do próprio QR code (nenhuma biblioteca de imagem tipo `sharp`/`canvas` está instalada) — o logo aparece ao lado do QR nos ativos de impressão, nunca sobreposto a ele.
- O primeiro CSP deste produto está em modo `report-only` — reporta violações, não bloqueia nada ainda. Apertar para bloqueante exige revisar relatórios de violação de um ambiente de produção real primeiro. Ver ADR-045.
- HSTS está ligado sem o flag `preload` — `preload` exige submissão manual a hstspreload.org contra o domínio real de produção, um passo fora do alcance deste sandbox.
- Nenhuma linha de código de IA existe neste produto — a "preparação para IA" da Fase 10 foi reconhecer que a API pública/SDK da Fase 9 já servem de interface para um futuro agente, não escrever nenhuma chamada a um modelo de linguagem. Ver ADR-046.
- "Temas claro e escuro" da identidade de marca não foi cumprido integralmente: o produto nunca teve dark mode de verdade ligado em nenhuma fase (`forcedTheme="light"` desde antes desta fase; o bloco `.dark` em `globals.css` existe desde a Fase 4.5 mas nunca é aplicado). O cálculo de cor do `BrandProvider` já é agnóstico a tema (funcionaria sob escuro se um dia for religado), mas nenhuma tela escura foi construída, testada ou aparece no Theme Studio — ligar dark mode de verdade é uma mudança transversal do tamanho de uma fase própria, nunca pedida como tal. Ver ADR-047.
- `Playbook` não tem uma tela própria de autoria/edição — o catálogo é semeado (`prisma/seed.ts`) e editável só via banco/uma futura tela administrativa; `/dashboard/playbooks` consome recomendações, nunca cria playbooks novos. Um oitavo playbook, dentro do vocabulário existente de 7 gatilhos/4 ações, é uma linha de seed, não uma tela.
- `PlaybookActionType.ASSIGN_CAMPAIGN_TO_SCOPE` está implementado e testável, mas nenhum dos 7 playbooks semeados o usa hoje (todos usam `CREATE_AND_ASSIGN_CAMPAIGN` ou `BOOST_CAMPAIGN_PRIORITY`) — um ponto de extensão pronto para um playbook futuro que reaproveite uma campanha já existente sem criar outra.
- O Scheduler Inteligente ("repetir") só permite ações idempotentes (atribuir/criar) — `BOOST_CAMPAIGN_PRIORITY`/`PAUSE_CAMPAIGN` nunca podem ser agendados como recorrentes, para nunca compor um aumento de prioridade sem limite (ver ADR-050).
- A varredura periódica de `/api/playbooks/evaluate` (Cron, a cada 15 minutos) percorre TODAS as empresas em sequência — uma escolha simples e honesta para a escala real deste produto hoje, não otimizada para milhares de empresas ainda (ver Franchise First Review em `RELATORIO_FASE_11.md`).
- Sem confirmação por WhatsApp/e-mail de que uma mensagem gerada por um playbook (`CREATE_AND_ASSIGN_CAMPAIGN` tipo WHATSAPP) foi de fato lida ou respondida pelo cliente — o produto sabe que a campanha foi atribuída e teve toques, não o desfecho da conversa.
- AutoPilot é uma configuração por empresa (`AutoPilotSetting`), não por usuário nem por playbook individual — todo playbook `safeForAutomation=true` está sujeito ao mesmo nível escolhido pela empresa, sem um interruptor por playbook ainda.
- Nenhum banco de dados embarcado/em memória foi construído — o Dev Runtime resolve autenticação, não a ausência de um Postgres real neste sandbox; sem `DATABASE_URL` configurado para um banco de verdade (local, Docker, ou nuvem), páginas que dependem de dados continuam falhando no mesmo ponto de sempre. Ver ADR-052/ADR-054.
- "Redis fake"/"filas fake" citados no pedido original já existiam como degradação graciosa desde a Fase 1/8 — nenhuma classe nova de mock foi construída, só reconhecida e documentada.
- O Demo Timeline (`usePlayback` estendido) não reproduz eventos DE VOLTA para dentro do `TableMapView` embutido no Demo OS — é seu próprio feed cronológico separado, não uma segunda fonte de verdade que tentasse reescrever o estado visual do mapa. Ver RELATORIO_FASE_12.md.
- O Scenario Engine roda cenários deixando dados sintéticos permanentes na empresa de demonstração — sem um mecanismo de limpeza/expiração automática; um uso público intenso do Demo OS cresce essa tabela ao longo do tempo.
- O Visual Event Flow mostra até onde no pipeline um TIPO de evento normalmente chega (um mapa fixo, documentado) — não rastreia o caminho realmente percorrido por UM evento específico através das filas em tempo real (isso exigiria instrumentação de tracing distribuído que este produto não tem, ver ADR-034).
- White Label Live Switch troca só a marca (cor/nome/logo) sobre a MESMA operação da Bella Vista — não troca os dados mostrados por dados de uma empresa diferente; é uma demonstração de identidade visual, não uma segunda operação simulada.
