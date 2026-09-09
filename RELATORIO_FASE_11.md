# Relatório da Fase 11 — Smart Campaign Playbooks

Ver `ROADMAP.md` para a lista completa de fases e `PROXIMAS_TAREFAS.md` para o checklist que esta fase fecha. Esta é a primeira fase sob uma nova regra permanente obrigatória — **Autonomy Review** (nono review) — e duas novas regras permanentes de engenharia — **Explainability First** e **One-Tap Execution** — ver seções dedicadas abaixo.

## O que foi implementado

O objetivo declarado desta fase era parar de mostrar dados e passar a propor ações: o sistema observa o restaurante, entende o contexto e sugere a próxima melhor decisão com transparência, segurança e execução em um clique.

- **Biblioteca de Playbooks** (`prisma/seed.ts`, catálogo `Playbook`, ver **ADR-048**): 7 playbooks reais e declarativos — Happy Hour Boost, Google Review Recovery, Instagram Momentum, VIP Table Recovery, Silent Zone Rescue, Lunch Rush Optimization, Weekend Accelerator — todos combinando um de 7 `PlaybookTriggerType` com um de 4 `PlaybookActionType`. Nenhuma linha de código por playbook: o que diferencia um do outro é só `triggerConfig`/`actionConfig` (JSON, dados), semeados uma vez. Um oitavo playbook, dentro desse vocabulário, é uma linha de `INSERT`, nunca um deploy.
- **Domínio puro** (`src/domain/playbooks/`): `triggers.ts` (7 avaliadores puros, sem Prisma, mesmo padrão do Insight Engine da Fase 7), `confidence-engine.ts` (score 0-1 determinístico — amostra + magnitude do efeito + atualidade, nunca um número decorativo), `impact.ts` (reaproveita literalmente a fórmula do ROI Mode da Fase 7, `domain/analytics/roi.ts`, em vez de inventar uma segunda matemática de "quanto isso vale").
- **Os cinco motores pedidos**: `services/playbook-engine.service.ts` (avalia o catálogo contra dados reais + dedup anti-conflito), `services/recommendation-engine.service.ts` (ciclo de vida de uma recomendação: listar/explicar/ignorar/aplicar/desfazer), `services/execution-engine.service.ts` (preview no estilo Ghost Mode, execução, undo, agendamento), `services/automation-engine.service.ts` (AutoPilot), `domain/playbooks/confidence-engine.ts`.
- **Event Bus estendido** (Fase 8): 3 eventos novos — `RecomendacaoGerada`, `PlaybookExecutado`, `PlaybookDesfeito`. Nova fila `"playbooks"` (Queue Engine) inscrita SÓ em eventos de comportamento real do cliente (`RedirecionamentoResolvido`, `FeedbackRecebido`, `AvaliacaoPublicada`) — nunca nos eventos que a própria execução de playbook produz (`CampanhaCriada`/`CampanhaAtualizada`/`CampanhaEncerrada`), a proteção estrutural contra loop de automação (ver **ADR-050**).
- **Varredura periódica** (`GET /api/playbooks/evaluate`, Cron a cada 15 min, protegida por `CRON_SECRET`, mesmo padrão de `/api/queues/process`): cobre gatilhos de AUSÊNCIA de evento (zona silenciosa, mesa VIP parada), que o Event Bus não consegue perceber sozinho.
- **Recommendation Center** (`/dashboard/playbooks`): cartões premium (`RecommendationCard`, novo componente em `packages/ui`) mostrando categoria, confiança, impacto estimado e duração, com três ações — Aplicar, Ver motivo, Ignorar. AutoPilot Selector com os 4 níveis explicados. Histórico e execuções agendadas visíveis na mesma tela.
- **Explainability Panel** (`components/dashboard/playbooks/explainability-panel.tsx`): ao abrir "Ver motivo", mostra a regra disparada, os dados brutos usados, a confiança fatorada (um fator por linha, com a barra visual), e a ação que será tomada — tudo direto de `PlaybookRecommendation`, nunca gerado na hora.
- **One-Tap Execution** (`playbook-apply-dialog.tsx`): aplicar reaproveita o mesmo padrão do `GhostModePreviewDialog` do Mapa de Mesas (Fase 5/6) — busca o escopo afetado e a estimativa de impacto ANTES de mudar qualquer coisa, mostra como desfazer, e só aplica após confirmação explícita.
- **Scheduler Inteligente**: agora/depois/repetir/pausar, via `delay`/`upsertJobScheduler` nativos do BullMQ (Queue Engine, Fase 8) — nenhuma infraestrutura nova. "Repetir" é restrito às duas ações idempotentes (atribuir/criar campanha) — nunca prioridade/pausa, para nunca compor um efeito sem limite (ver ADR-050).
- **AutoPilot Seguro** (`automation-engine.service.ts`, ver **ADR-049**): 4 níveis (Manual/Recomendado/Semi-automático/Automático). Só playbooks marcados `safeForAutomation=true` E com confiança ≥75% podem agir sem confirmação humana; um teto de 5 auto-execuções por empresa por dia protege contra excesso; toda auto-execução carrega `triggeredBy="AUTOPILOT"`, publica o mesmo evento de uma execução manual, e tem o mesmo Desfazer disponível depois.
- **Executive Copilot** (`/dev/ceo/command-center`): coluna "Próximas melhores ações" com um botão de execução imediata de verdade — a ÚNICA rota de escrita que o Command Center já teve, uma exceção estreita e documentada a ADR-027 (ver **ADR-051**).
- **ROI Antes da Execução**: toda recomendação mostra conversões/avaliações/receita esperadas, sempre rotulado "Estimativa" — nunca uma promessa, reaproveitando a mesma fórmula honesta do ROI Mode (`revenueConfigured=false` quando a empresa não configurou ticket médio/taxa de retorno, mesma garantia da Fase 7).
- **Heatmap Preditivo** (`use-heatmap-layer.ts`, `table-node.tsx`): compara a janela atual com a anterior na MESMA rota `/api/heatmap` já existente (sem endpoint novo) — tendência "aquecendo"/"esfriando" por mesa, com uma animação de respiração leve (`heatmap-breathe`, `globals.css`, respeitando `prefers-reduced-motion`) para mesas aquecendo.
- **Demo Premium**: dados sintéticos da Bella Vista enviesados de propósito (`prisma/seed.ts`) para dois playbooks dispararem de forma determinística — a conversão da Varanda sobe de verdade das 18h-22h, e Mesa VIP 1 fica sem nenhum toque nos últimos 4+ dias — para o roteiro de demonstração ter um caso real, não fabricado.
- **Achado e fechado durante a própria construção, sob Zero Dívida Silenciosa/Architect Review**: o risco de loop infinito de automação (aplicar um playbook publica eventos que poderiam reavaliar gatilhos e reaplicar) foi identificado ANTES de escrever o código de avaliação, não depois — a fila de eventos que dispara reavaliação nunca escuta os três eventos que a própria execução de playbook produz. Ver Achados do Architect Review abaixo e ADR-050.

## Autonomy Review (nova regra permanente, primeira fase em que se aplica)

**As cinco perguntas obrigatórias, para cada automação desta fase:**

1. **O sistema age sozinho?** Sim, mas só nos níveis Semi-automático/Automático do AutoPilot, e só para playbooks marcados `safeForAutomation=true` (Happy Hour Boost, Instagram Momentum, Silent Zone Rescue, Lunch Rush Optimization, Weekend Accelerator) — Google Review Recovery e VIP Table Recovery nunca agem sozinhos, em nenhum nível, porque mexem com reputação/relacionamento e exigem julgamento humano.
2. **O usuário entende por que agiu?** Sim — toda execução (manual ou automática) tem `triggeredBy` gravado (nunca ambíguo), aparece na tela de Playbooks com a mesma cara de uma execução manual, e o Explainability Panel mostra a mesma evidência/confiança que gerou a recomendação original.
3. **Existe Undo?** Sim, sempre — a mesma `undoExecution` para uma execução manual, automática (AutoPilot) ou de demonstração (Executive Copilot). Reverte atribuições criadas, restaura prioridade/status anteriores, e arquiva (nunca exclui) uma campanha que a própria execução criou, se nada mais a referenciar.
4. **Existe limite de segurança?** Sim, em camadas: confiança mínima de 75% para qualquer auto-execução (mais alta que o limiar de simplesmente EXIBIR uma recomendação); um teto de 5 auto-execuções por empresa por dia; o nível Semi-automático nunca executa na hora — agenda com uma janela de 15 minutos, sempre cancelável; `RECOMMENDATION_APPLIED`/`AUTOPILOT_LEVEL_CHANGED` exigem a permissão `campaign:assign`/`automation:manage` respectivamente, nunca uma ação sem dono.
5. **Existe log completo?** Sim — toda execução vira uma linha de `PlaybookExecution` (com `actionsTaken` detalhado o bastante para o Undo funcionar) e um evento `PlaybookExecutado`/`PlaybookDesfeito` no Event Bus, com `AuditLog` gravado na camada de rota (mesmo padrão de toda mutação autenticada desde a Fase 4).

**Veredito honesto:** o nível Automático do AutoPilot É uma automação real que age sem confirmação humana — isso não foi suavizado, é exatamente o que o pedido descreveu ("executar apenas playbooks seguros; registrar tudo; permitir rollback"). A segurança não vem de nunca agir sozinho, vem das duas travas (confiança + teto diário) e da reversibilidade total sempre disponível depois.

## Explainability First (nova regra permanente de engenharia, primeira fase em que se aplica)

**"Nenhuma recomendação pode parecer mágica."** Todo cartão de recomendação mostra, sempre visível, sem precisar de um clique extra: categoria, confiança (com nível baixa/média/alta e o score), impacto estimado, e duração. O botão "Ver motivo" existe para o DETALHE (dados brutos, comparação histórica, confiança fatorada — um fator por linha com peso e valor visíveis, regra disparada), nunca para revelar informação que deveria estar no cartão desde o início. Nenhuma frase é gerada por um modelo de linguagem — toda `headline`/`evidence` vem de `domain/playbooks/triggers.ts`, montada a partir dos números exatos que dispararam o gatilho, a mesma filosofia auditável do Insight Engine (Fase 7).

## One-Tap Execution (nova regra permanente de engenharia, primeira fase em que se aplica)

**"Toda recomendação importante pode virar ação com um clique — mas nunca silenciosamente."** Aplicar sempre passa pelo `PlaybookApplyDialog`: busca o escopo afetado e o impacto estimado antes de qualquer mudança, mostra como desfazer, e só executa após confirmação — o mesmo Ghost Mode do Mapa de Mesas (Fase 5/6), não uma segunda implementação. Ignorar e Desfazer são igualmente um clique. A única exceção documentada é o AutoPilot no nível Automático, que por definição não pede confirmação por clique — mas ainda assim nunca é silencioso no sentido que importa: fica registrado, visível e reversível (ver Autonomy Review acima).

## Enterprise Brand Review (continua a partir da Fase 10)

Nenhuma tela nova desta fase introduz identidade visual própria fora do `BrandProvider` já estabelecido — `/dashboard/playbooks` está dentro do layout do dashboard (branding automático, sem instanciar um segundo provider), e os cartões de recomendação usam os mesmos tokens de cor de marca (`PremiumCardShell`, `SmartBadge`) de todo o resto do produto. Uma rede de 500 unidades veria o Recommendation Center com a mesma cara do seu próprio dashboard, nunca uma "ferramenta de IA" com visual à parte.

## Franchise First Review (continua a partir da Fase 10)

- **Avaliação de gatilhos:** cada consulta de agregação (`playbook-engine.service.ts`) é escopada por `companyId`, com índices existentes (`RedirectLog`, `RatingEvent`, `NFCCard`) — o custo por empresa não cresce com o número de OUTRAS empresas.
- **Dedup/anti-conflito:** `createRecommendationIfNotConflicting` consulta por `(companyId, scopeType, scopeId)`, indexado (`@@index([companyId, playbookId, scopeType, scopeId])`) — O(1) por checagem, independente do volume total de recomendações já geradas.
- **Limite reconhecido, não escondido:** a varredura periódica (`/api/playbooks/evaluate`) percorre TODAS as empresas em sequência a cada tick de Cron — uma escolha simples e honesta para a escala real de hoje, não otimizada para milhares de empresas ainda. Documentado no `ROADMAP.md` como não-objetivo explícito, para não ser redescoberto como surpresa numa fase futura.
- **AutoPilot é por empresa**, não por playbook individual — 1, 50 ou 500 empresas configuram o próprio nível independentemente, sem nenhuma configuração global que vaze entre tenants.

**Veredito honesto:** a avaliação e a execução escalam por construção (índices, sem enumeração cross-tenant); a varredura periódica é o único ponto que precisaria de trabalho adicional (paralelização/particionamento) para milhares de empresas — reconhecido, não ignorado.

## Platform First Review (continua a partir da Fase 9)

- Nenhuma rota `/api/v1/**` foi tocada nesta fase — Playbooks são inteiramente uma superfície de dashboard interno, sem contrato público novo ainda.
- Os 3 novos eventos de domínio (`RecomendacaoGerada`/`PlaybookExecutado`/`PlaybookDesfeito`) foram deliberadamente deixados SEM nome público de webhook (`null` em `PUBLIC_WEBHOOK_EVENT_MAP`), mesmo precedente de `ZonaAtualizada`/`MesaAtualizada` (Fase 9) — uma superfície nova o bastante para merecer seu próprio desenho quando houver um pedido real de integração externa, não uma tradução apressada agora.
- As rotas internas novas (`/api/playbooks/**`, `/api/automation/settings`) seguem exatamente o mesmo padrão de toda rota interna já existente (`requireAuthContext` → `requirePermission` → `handleApiError`), nenhuma convenção nova introduzida.

## WOW Factor Review

**"O que faria alguém dizer 'nunca vi um SaaS fazer isso'?"** Aplicar uma recomendação e ver o AutoPilot, minutos depois, aplicar sozinho a PRÓXIMA recomendação de alta confiança — com o log completo e o Desfazer sempre um clique de distância — é a diferença entre "um dashboard com sugestões" e "um gerente operacional de verdade." A maioria dos produtos com "IA" mostra uma sugestão e para aí; este produto mostra a sugestão, explica o porquê com números reais, e — quando autorizado — age.

**Melhoria de alto impacto implementada sem gerar dívida técnica:** o Heatmap Preditivo reaproveita a MESMA rota `/api/heatmap` já existente (só chamando com `hours=24` e `hours=48` e subtraindo) — nenhuma agregação nova no banco, nenhum endpoint novo, e o salão passa a "respirar" visualmente (mesas aquecendo pulsam suavemente) sem nenhuma infraestrutura de tempo real adicional.

## Reliability Review (continua a partir da Fase 8)

1. **Essa funcionalidade continua funcionando sob alta carga?** Sim — a avaliação de gatilhos por evento é debounced (no máximo 1x por empresa a cada 30 min via essa via), e a varredura periódica roda em ciclos de Cron isolados, nunca acumulando trabalho.
2. **Existe algum ponto único de falha?** Não novo — sem Redis, o debounce degrada para "sempre avalia" (mais custo, nunca bloqueio); sem Queue Engine, agendamentos "depois"/"repetir" executam imediatamente em vez de perder a execução (degradação graciosa, mesmo padrão de toda fila deste produto desde a Fase 8).
3. **O redirecionamento público continua protegido?** Sim, inalterado — `/r/[code]` não foi tocado; Playbooks é inteiramente uma superfície de dashboard/cron.
4. **Existe degradação graciosa quando Redis/filas/serviços externos falham?** Sim, testada por leitura de código: `getQueue("playbooks")` retorna `null` sem Redis, e `enqueueDelayed`/`enqueueRepeating` caem para execução imediata em vez de silenciosamente perder o agendamento.
5. **Os eventos podem ser recuperados sem perda importante?** Sim — `RecomendacaoGerada`/`PlaybookExecutado`/`PlaybookDesfeito` herdam a durabilidade do `EventLog` (Fase 8): gravados antes de qualquer tentativa de roteamento para fila.
6. **A observabilidade permite descobrir rapidamente onde um problema começou?** Sim — `playbooksProcessor` roda dentro do mesmo `withCorrelation`/`withSpan` de todo processador desde a Fase 8; falhas de execução gravam `failureReason` em `PlaybookExecution`, nunca silenciosas.

## Revenue Review (continua a partir da Fase 7)

1. **Essa funcionalidade aumenta a percepção de valor da assinatura?** Sim, fortemente — "o sistema recomenda a próxima melhor ação sozinho" é o tipo de recurso que justifica um tier superior por si só, não um complemento de analytics.
2. **O empresário entenderia quanto dinheiro isso pode gerar ou economizar?** Sim, diretamente — cada recomendação já mostra receita influenciada estimada antes de aplicar, a resposta mais direta possível a essa pergunta.
3. **Existe algum insight que justifique renovar o plano mensal?** Sim — ver o AutoPilot aplicar algo sozinho (com log completo) e o KPI reagir é um lembrete recorrente de valor, mais forte que um relatório mensal estático.
4. **Existe algum recurso digno de aparecer na página de vendas?** Sim, um dos mais fortes até agora: "seu restaurante ganha um gerente que nunca dorme, observando 24/7 e agindo com sua permissão" é uma frase de vendas real.
5. **Existe alguma oportunidade de transformar dados em recomendação automática?** Esta é literalmente a fase que constrói essa capacidade — os Insights Automáticos (Fase 7) e agora os Playbooks fecham o ciclo "dado → insight → ação."

## Demo First Review (continua a partir da Fase 6)

1. **Essa funcionalidade impressionaria um investidor em uma demonstração de 2 minutos?** Sim, fortemente — o roteiro Happy Hour Boost (Varanda converte melhor às 18h → recomendação aparece → Preview Inteligente mostra impacto → aplica → KPI reage) é exatamente o tipo de momento que separa "temos dados" de "temos inteligência."
2. **Um dono de restaurante entenderia o valor em menos de 30 segundos?** Sim — "o sistema me disse que a Varanda vende mais depois das 18h e já preparou a campanha, só preciso clicar" não exige nenhuma explicação técnica.
3. **Existe um momento "uau" claramente perceptível?** Sim — ver a recomendação, o motivo (números reais) e o resultado aplicado em sequência, no Command Center, sem sair da tela.
4. **O comportamento parece software premium ou apenas funcional?** Premium — `RecommendationCard` segue exatamente o Design Language já estabelecido (`PremiumCardShell`), o Explainability Panel usa o mesmo `PremiumDrawer` de toda a Fase 10.
5. **Existe uma animação/transição que comunique melhor o estado sem prejudicar performance?** O Heatmap Preditivo "respirando" nas mesas aquecendo é a resposta direta e literal a essa pergunta nesta fase.

## Product Review (continua a partir da Fase 5)

1. **A experiência parece um produto premium, ou apenas uma tela de admin?** Premium — nenhuma lista crua de "regras"; cartões com hierarquia visual clara (confiança, impacto, ação).
2. **Existe algum atrito desnecessário?** Evitado deliberadamente: aplicar é um clique até o diálogo de preview, que já vem com "Agora" pré-selecionado — quem só quer aplicar não precisa tocar em mais nada.
3. **A interface exige mais cliques do que precisa?** Não — Ignorar é um clique direto no cartão, sem confirmação adicional (reversível pela própria natureza de "ignorar", nunca destrutivo).
4. **Existe uma forma mais intuitiva de fazer a mesma tarefa?** O AutoPilot Selector mostra as 4 opções lado a lado com a consequência de cada uma escrita por extenso, em vez de um dropdown que esconde o que cada nível realmente significa.
5. **Um gerente de restaurante aprenderia isso em menos de 2 minutos?** Sim — três botões (Aplicar/Ver motivo/Ignorar) em cada cartão é a mesma gramática de interação de qualquer notificação de app que o usuário já conhece.
6. **Oportunidade de "uau" que não custa nada?** O selo de confiança colorido (verde/roxo/âmbar) no topo do cartão comunica "o quão certo o sistema está" antes mesmo de ler a frase — informação useful de graça, sem custo de implementação.

## Achados do Architect Review (corrigidos proativamente, não pedidos) — incluindo Zero Dívida Silenciosa

1. **O achado mais importante desta fase — procurado ativamente ANTES de escrever o motor de avaliação, não descoberto depois de já estar quebrado:** aplicar um playbook (`CREATE_AND_ASSIGN_CAMPAIGN`) cria uma `Campaign`/`CampaignAssignment`, que já publicam `CampanhaCriada`/`CampanhaAtualizada` no Event Bus desde a Fase 8. Se a fila de avaliação de gatilhos escutasse esses eventos, um playbook aplicado poderia reavaliar gatilhos sobre a própria campanha que acabou de criar — um caminho real para um loop de automação. Fechado estruturalmente: a fila `"playbooks"` só escuta os 3 eventos que representam comportamento REAL de cliente (toque/feedback/avaliação), nunca os 3 que uma execução de playbook pode ela mesma produzir. Documentado em **ADR-050**.
2. **Playbooks conflitantes — verificado e fechado:** `createRecommendationIfNotConflicting` nunca cria uma nova recomendação para um escopo (zona/mesa/empresa) que já tem uma `PENDING` ou uma `APPLIED` recente — de QUALQUER playbook, não só o mesmo. Duas recomendações nunca competem pela mesma mesa ao mesmo tempo.
3. **Execuções simultâneas — verificado, não encontrado:** `executeRecommendation` checa `recommendation.status !== "PENDING"` antes de agir e atualiza o status para `APPLIED` na mesma chamada que cria o `PlaybookExecution` — uma segunda tentativa de aplicar a mesma recomendação (duplo clique, ou uma corrida entre o AutoPilot e um clique manual) encontra o status já mudado e recusa, nunca executa duas vezes.
4. **Rollback incompleto — verificado, evitado por desenho:** `actionsTaken` sempre grava o estado ANTERIOR suficiente para reverter por completo (prioridade anterior, status anterior, se a campanha foi criada por esta execução) — `undoExecution` nunca precisa adivinhar o que fazer, e é idempotente (chamar duas vezes não falha, só não faz nada na segunda).
5. **Falsos positivos — mitigado, herdado do Insight Engine:** todo gatilho exige um tamanho de amostra mínimo antes de disparar (`minSampleSize` em `triggerConfig`), a mesma defesa determinística contra ruído que a Fase 7 já validou para os Insights Automáticos.
6. **Duplicação de contratos evitada deliberadamente:** `estimateImpact` (`domain/playbooks/impact.ts`) chama `computeRoiSummary` de `domain/analytics/roi.ts` diretamente, em vez de reimplementar a fórmula — uma mudança futura na matemática de ROI (Fase 7) se propaga automaticamente para as estimativas de Playbook, nunca duas fórmulas divergindo com o tempo.
7. **Conflito de decisão nomeado, não escondido:** ADR-027 (Fase 6) dizia "o Command Center nunca ganha rotas de escrita própria"; o pedido desta fase pede um botão de execução imediata ali. Em vez de silenciosamente violar ADR-027 ou silenciosamente recusar o pedido, o conflito foi registrado e resolvido explicitamente em **ADR-051** — uma exceção estreita, nomeada, com o mesmo gate de segurança triplo de toda a árvore `/dev/ceo`.
8. **Performance:** nenhuma consulta N+1 nova nas agregações de gatilho — cada avaliador busca os dados de que precisa em, no máximo, 2-3 consultas indexadas por empresa, nunca por linha.
9. **Compatibilidade com toda fase anterior:** `updateCampaign`/`assignCampaign`/`createCampaign`/`unassignCampaign` (Fase 2/4) não tiveram assinatura alterada — o Execution Engine os chama exatamente como o dashboard manual e a API v1 já chamam, herdando de graça a invalidação de cache do Resolution Engine (Fase 1) que já existe dentro deles.

## Como isso foi verificado (não só compilado)

Todos os quatro quality gates (`tsc --noEmit`, `eslint .`, `prisma validate`, `npm run build` com um `.env.local` temporário completo) passam limpos — incluindo as ~20 novas rotas, os 4 novos modelos Prisma, e o novo componente `RecommendationCard` em `packages/ui`, tanto ANTES quanto DEPOIS da restauração do harness de verificação interativa (dois builds completos de produção nesta fase, não um).

**Sem Postgres/Redis/Clerk reais neste sandbox** (mesma limitação de toda fase anterior). Verificação interativa usou o mesmo padrão já estabelecido: `src/middleware.ts` temporariamente reduzido a um matcher vazio e `<ClerkProvider>` temporariamente removido de `src/app/layout.tsx`, ambos restaurados exatamente ao original depois.

Confirmado via inspeção real de DOM/rede/logs de servidor (não apenas "o texto certo apareceu"):
- **`/api/playbooks/evaluate` sem `CRON_SECRET`:** `503 Service Unavailable` confirmado via `read_network_requests`, com a mensagem exata "CRON_SECRET não configurado — rota desabilitada" — prova que o gate de segurança do Cron funciona ANTES de qualquer tentativa de conexão com o banco, mesmo padrão já validado para `/api/queues/process` na Fase 8.
- **`/api/playbooks`, `/dashboard/playbooks`:** `500 Internal Server Error`, confirmado nos logs do servidor como o MESMO erro do Clerk ("`auth()` foi chamado, mas o Clerk não detecta `clerkMiddleware()`") já visto em `/dashboard/developers`/`/dashboard/branding` nas Fases 9/10 — mesma classe de limitação, não uma regressão.
- **`/dev/ceo/command-center`:** falha confirmada nos logs como `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` — um erro de conexão Postgres genuína (sem `DATABASE_URL` real neste harness), a mesma limitação já aceita para toda a árvore `/dev/ceo/*` desde a Fase 6, provando que a nova coluna "Próximas melhores ações" e a nova rota de escrita não introduzem uma classe de erro diferente da já existente.

**O que não pôde ser provado neste sandbox:** um Playbook disparando de verdade contra dados reais em produção (a lógica foi verificada por leitura de código e pelos testes de tipo/build, não por observação ao vivo, já que não há Postgres real conectado); o AutoPilot executando de verdade em qualquer nível (exige a mesma combinação Clerk+Postgres+Redis reais); o Scheduler Inteligente com um Job Scheduler do BullMQ de verdade rodando (exige Redis real); a animação de "respiração" do Heatmap Preditivo sendo vista num navegador de verdade (verificada por leitura de código/CSS, não por captura de tela, já que a tela que a mostra exige a mesma combinação de credenciais reais).

## Migração

Quatro modelos novos (`Playbook`, `PlaybookRecommendation`, `PlaybookExecution`, `AutoPilotSetting`), seis enums novos (`PlaybookTriggerType`, `PlaybookActionType`, `PlaybookCategory`, `RecommendationStatus`, `PlaybookExecutionStatus`, `AutoPilotLevel`), quatro valores novos em `AuditAction`, um campo aditivo (`PlaybookRecommendation.targetCampaignId`) — todos novos, nenhuma coluna existente alterada ou removida. Sem histórico em `prisma/migrations/` ainda (mesma restrição de toda fase anterior).

## Riscos carregados adiante

- `Playbook` não tem tela própria de autoria — o catálogo é semeado, editável só via banco; um playbook novo dentro do vocabulário existente é uma linha de seed, não uma tela (ver ADR-048).
- `PlaybookActionType.ASSIGN_CAMPAIGN_TO_SCOPE` está implementado mas nenhum dos 7 playbooks semeados o usa hoje — um ponto de extensão pronto, não exercitado.
- O Scheduler Inteligente ("repetir") só permite ações idempotentes — `BOOST_CAMPAIGN_PRIORITY`/`PAUSE_CAMPAIGN` nunca podem repetir (ver ADR-050).
- `/api/playbooks/evaluate` varre todas as empresas em sequência a cada tick de Cron — simples e honesto para a escala de hoje, não otimizado para milhares de empresas (ver Franchise First Review acima).
- AutoPilot é uma configuração por empresa, não por playbook individual.
- O teto de 5 auto-execuções/dia é um número de partida, não derivado de dado real de produção (ver ADR-049).
- Dos 7 playbooks semeados, só Happy Hour Boost e VIP Table Recovery têm dados sintéticos deliberadamente enviesados para disparar de forma determinística — os outros 5 dependem do padrão aleatório dos dados sintéticos gerados a cada seed, honestamente.
- `/dashboard/playbooks` e a coluna Executive Copilot do Command Center não são verificáveis interativamente de ponta a ponta neste sandbox (exigem Clerk + Postgres reais) — mesma limitação de todo `/dashboard/*`/`/dev/ceo/*` desde fases anteriores, não uma regressão desta fase.
- `/dev/ceo` deixou de ser 100% somente-leitura pela primeira vez desde a Fase 6 (ver ADR-051) — mitigado pelo mesmo gate triplo de segurança de toda a árvore, mas registrado como uma mudança de postura, não escondido.

## Próximos passos

Aguardando aprovação para iniciar a **Fase 12 — Developer Command Center v2 + ambiente de demo**.
