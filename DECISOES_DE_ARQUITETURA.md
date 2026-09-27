# Registro de Decisões de Arquitetura (ADRs)

> Este arquivo é a versão em português de `ARCHITECTURE_DECISIONS.md`, renomeado nesta fase em cumprimento à Regra Permanente nº 1 (português como idioma oficial do projeto — ver `RELATORIO_FASE_4_5.md`). O conteúdo técnico é idêntico ao original; apenas o idioma mudou.

Um registro das decisões que moldam o sistema, por que foram tomadas e o que custaram. O `ROADMAP.md` acompanha *o quê* é construído e quando; este arquivo registra *por quê* é construído do jeito que é — o que impede um projeto de violar silenciosamente seus próprios fundamentos assim que fica grande demais para uma pessoa guardar tudo na cabeça. Escrito retroativamente para as Fases 1-3 (tudo ainda válido hoje), e a partir da Fase 4 em diante, conforme as decisões são efetivamente tomadas.

Valores de Status: **Aceita** (em vigor), **Substituída por ADR-NNN** (substituída, mantida para histórico), **Adiada** (decidido *não* construir ainda, e por quê).

---

## ADR-001: Um ativo NFC/QR codifica apenas um código opaco e imutável

**Status:** Aceita · **Fase:** 1

**Contexto:** O chip físico é a coisa mais cara de mudar neste sistema — uma vez impresso e entregue a um comerciante, tocar nele de novo significa uma visita técnica. Tudo acima do chip pode ser reimplantado em segundos; o chip não pode.

**Decisão:** O payload NFC/QR de um cartão é sempre `https://dominio/r/{uniqueCode}` — `uniqueCode` é um identificador aleatório, opaco e permanente, sem nenhum significado embutido. Nenhum destino, ID de campanha ou lógica de negócio é jamais codificado no próprio chip.

**Consequências:** Uma empresa pode redirecionar um cartão do Google Reviews para o WhatsApp, para um cupom, para um cardápio com IA, infinitamente, sem reimprimir nada. O custo é uma consulta extra ao banco por toque (`uniqueCode` → cartão) em vez de codificar uma URL direta — tornado irrelevante pelo cache da ADR-004.

---

## ADR-002: O motor de resolução é um módulo desacoplado, não construído sobre as camadas de serviço/repositório do dashboard

**Status:** Aceita · **Fase:** 1

**Contexto:** `src/services/*.service.ts` é um padrão adequado para CRUD autenticado e escopado por tenant no dashboard — mas o motor é público, não autenticado, crítico em latência, e precisa ser chamável a partir do NFC hoje e de uma API pública/QR/links amanhã (conforme o roadmap), sem arrastar Clerk, validação de dashboard, ou qualquer coisa no formato de camada de serviço.

**Decisão:** `src/lib/resolution-engine/` nunca importa de `src/services/` ou `src/repositories/`, mesmo quando uma consulta é quase idêntica a uma que já existe lá (ex.: `loadCardMeta` duplica a maior parte de `getActiveCardByCode` do `card.service.ts`).

**Consequências:** Uma consulta duplicada, barata e indexada. Em troca, o motor pode ser extraído para um pacote independente ou uma rota de API pública mais tarde, sem uma única dependência de camada de serviço para desembaraçar antes.

---

## ADR-003: O fluxo legado de avaliação é um fallback puro de código — nunca uma campanha padrão semeada

**Status:** Aceita · **Fase:** 1

**Contexto:** Toda empresa que existia antes das campanhas (e toda empresa que nunca configura uma) precisa continuar funcionando exatamente como antes.

**Decisão:** `CampaignType.REVIEW_FLOW` existe no schema como um valor de enum reservado para o qual nenhum caminho de código jamais cria uma linha. "Zero campanhas" e "o fluxo de estrelas" são o mesmo estado, expresso como ausência de dados — não uma feature flag, não uma linha padrão retroativamente inserida.

**Consequências:** A retrocompatibilidade se sustenta por construção: não existe migração que possa errar isso, nenhuma flag que possa ficar desligada, nada a esquecer. O custo é um `if (!winner)` a mais em vez de uma consulta — menos código, não mais.

---

## ADR-004: Três chaves de cache invalidadas independentemente por resolução, não um único blob

**Status:** Aceita · **Fase:** 1 (estendida na Fase 4 — ver ADR-016)

**Contexto:** Uma única entrada de cache "tudo para este cartão" significa que editar o logo de uma empresa (1 escrita) exigiria invalidar a entrada de cache de cada cartão (N escritas) para evitar dados desatualizados.

**Decisão:** A resolução armazena em cache os metadados do cartão, as informações da empresa e as campanhas de uma empresa como três chaves Redis separadas, invalidadas independentemente por qualquer mutação que de fato alterou aquele dado (`invalidateCard`, `invalidateCompany`, `invalidateCompanyCampaigns`).

**Consequências:** Qualquer edição no dashboard é exatamente um `DEL`, não importa quantos cartões/campanhas uma empresa tenha — é isso que "cache inteligente sem degradar a resolução pública" significou, concretamente, em toda fase desde então. O custo é três leituras de cache em caso de cache miss total, em vez de uma — paralelizadas via `Promise.all`, então não compõem o orçamento de latência.

---

## ADR-005: A conexão de runtime do Prisma 7 e a conexão de CLI/migração usam URLs de banco de dados deliberadamente diferentes

**Status:** Aceita · **Fase:** 1

**Contexto:** O Prisma 7 removeu o motor de consulta em Rust; um driver adapter (`@prisma/adapter-pg`) é obrigatório, e `prisma7.config.ts` (CLI) não compartilha mais configuração de conexão com `new PrismaClient({ adapter })` (runtime) — nesta versão, eles são configurados independentemente de propósito.

**Decisão:** O runtime da aplicação usa a conexão **pooled** do Supabase (`DATABASE_URL`, PgBouncer) para escalabilidade sob concorrência serverless; a CLI (`prisma7.config.ts`) usa a conexão **direta** (`DIRECT_URL`) para migrações, já que o modo transaction do PgBouncer não suporta os recursos de nível de sessão que as migrações exigem.

**Consequências:** Duas strings de conexão para manter organizadas em vez de uma — documentado explicitamente no `.env.example` e na seção de migração de cada relatório de fase, porque inverter isso quebra migrações ou esgota o limite de conexões diretas sob carga.

---

## ADR-006: Branch/Zone lançadas mínimas e escopadas por empresa na Fase 2; hierarquia completa de Organização deliberadamente adiada

**Status:** Substituída pela ADR-013 (Fase 4) — mantida para histórico

**Contexto:** A Fase 2 precisava de *algo* para atribuir campanhas abaixo de "a empresa inteira," mas o formato eventual de franquia multi-empresa ainda não estava decidido, e errar o palpite seria mais caro de desfazer do que esperar.

**Decisão:** `Branch`/`Zone` foram lançadas como tabelas simples, opcionais, escopadas por empresa — nenhum conceito de `Organization`. Uma empresa sem nenhuma das duas é um negócio de localização única, completamente inafetado.

**Consequências:** Zero retrabalho necessário para o caso comum quando a Fase 4 chegou; o único campo desenhado defensivamente com antecedência (`CampaignAssignment.scope` como um enum, não um par fixo) foi exatamente o campo que a Fase 4 precisou estender em vez de redesenhar. Ver ADR-013 para o que substituiu isto.

---

## ADR-007: A unicidade de atribuição em escopo COMPANY é garantida com uma transação Serializable, não uma constraint de banco

**Status:** Aceita · **Fase:** 2

**Contexto:** "No máximo uma atribuição em escopo COMPANY por campanha" parece um trabalho para `@@unique`, mas o Postgres trata `NULL` como distinto — e a coluna que precisaria participar (`cardId`, nula em linhas de escopo COMPANY) não consegue fazer um índice único simples funcionar. A DSL de schema do Prisma não tem sintaxe de índice único parcial para expressar `WHERE scope = 'COMPANY'`.

**Decisão:** Aplicado em `campaign.service.ts` com uma transação de isolamento `Serializable`: verifica-então-insere dentro da transação, deixando o Postgres abortar uma de duas transações verdadeiramente concorrentes e conflitantes (erro `P2034`), capturado e exposto como um `CampaignConflictError` limpo.

**Consequências:** Correto sob concorrência real, sem uma migração SQL bruta fora da DSL do Prisma. O custo é um caminho de escrita um pouco mais caro para esta única operação — irrelevante perto de quão raramente uma campanha é atribuída à empresa inteira em comparação a quão frequentemente é resolvida.

---

## ADR-008: A renderização de destino é uma função isomórfica única, compartilhada pelo redirecionamento do motor e pelo preview ao vivo do dashboard

**Status:** Aceita · **Fase:** 2

**Contexto:** Um preview do Builder que reimplementa "para qual URL isso vai redirecionar de verdade" de forma independente do motor pode divergir da realidade no momento em que qualquer um dos dois lados mudar.

**Decisão:** `buildDestinationPreview()` em `src/lib/campaign-destination.ts` é o único lugar onde um par `(type, config)` vira um destino real — chamado de forma idêntica por `/r/[code]/page.tsx` (servidor, redirecionamento real, contexto real do cartão) e pelo preview client-side do Builder (ainda sem contexto de cartão, um placeholder usado para o `utm_content` do UTM).

**Consequências:** O preview não pode mentir sobre o que um cliente vai experimentar, por construção. Foi isso também que capturou o bug de acento no UTM na Fase 2 — um bug na função compartilhada ficou visível no dashboard imediatamente, não descoberto depois nos logs de redirecionamento.

---

## ADR-009: Recorrência é aplicada sintetizando-a no mesmo caminho de avaliação de Regras, não um segundo mecanismo

**Status:** Aceita · **Fase:** 3

**Contexto:** `Campaign.recurrenceType`/`recurrenceConfig` (Fase 2) e as linhas de `Rule` (Fase 3) ambos expressam "quando esta campanha é elegível" — construir dois caminhos de aplicação separados arrisca eles discordarem em casos extremos (fuso horário, janelas que cruzam a meia-noite) que só um dos dois recebe correção.

**Decisão:** `domain/rules/recurrence.ts` traduz os campos de recorrência de uma campanha para o mesmo formato `RuleLike` (`DAY_OF_WEEK` + `TIME_WINDOW`) que as linhas de `Rule` criadas manualmente usam, e então ambos fluem pelo único `evaluateRuleSet()`.

**Consequências:** Um único motor de avaliação para testar, corrigir e raciocinar sobre, não dois. O custo é uma pequena função de tradução — mais barato do que a alternativa de toda futura correção de avaliação de regra precisar ser aplicada duas vezes.

---

## ADR-010: A avaliação de Regras é ciente de fuso horário usando a API nativa `Intl`, com padrão por empresa em vez de por servidor

**Status:** Aceita · **Fase:** 3

**Contexto:** O servidor roda em UTC (Vercel); a regra de Happy Hour "sexta 18:00" de um comerciante significa 18h onde fica o restaurante dele, não 18h UTC — e perto de uma virada de dia, o próprio dia da semana pode diferir entre os dois.

**Decisão:** `domain/rules/timezone.ts` decompõe um `Date` em dia da semana/hora/minuto/data locais via `Intl.DateTimeFormat` com um `timeZone` explícito, obtido de uma nova coluna `Company.timezone` (padrão `America/Sao_Paulo`). Nenhuma dependência de biblioteca de datas foi adicionada para isso.

**Consequências:** Avaliação de regras correta sem uma dependência `date-fns-tz`/`luxon`. O custo é que toda empresa hoje avalia no mesmo fuso horário padrão até que Configurações ganhe um seletor — uma limitação explícita e rastreada, não silenciosa.

---

## ADR-011: O Motor de Regras não duplica dimensões de segmentação que já pertencem ao escopo de atribuição

**Status:** Aceita · **Fase:** 3

**Contexto:** A lista de desejos de longo prazo listava mesa/zona/unidade e "campanha encerrada → fallback" como dimensões de regra. Ambas já têm um mecanismo: `CampaignAssignment.scope` (Fase 1/2) para a primeira, e a ordenação existente de prioridade/janela (verificada diretamente, não presumida) para a segunda.

**Decisão:** `RuleType` cobre apenas dimensões que não tinham mecanismo existente: `DAY_OF_WEEK`, `TIME_WINDOW`, `DATE_RANGE`, `DEVICE_TYPE`.

**Consequências:** Nenhuma ambiguidade sobre qual mecanismo vence quando dois discordam, porque só existe um mecanismo por preocupação. O custo é que esta decisão precisa ser ativamente lembrada quando uma fase futura for tentada a adicionar um tipo de regra `ZONE` "por conveniência" — que é exatamente para isso que esta ADR serve.

---

## ADR-012: Event sourcing é adiado para uma fase posterior; `RedirectLog`/`RuleExecutionLog` são trilhas de auditoria best-effort até lá

**Status:** Adiada (alvo: Fase 8) · **Decidido:** Fase 1, explicitado aqui

**Contexto:** Event sourcing de verdade (log de eventos durável, repetível, alimentando webhooks/analytics/filas) é infraestrutura de verdade — no mínimo uma fila (BullMQ/Redis conforme o roadmap) — que ainda não existe e não deveria ser construída pela metade como efeito colateral de uma fase não relacionada.

**Decisão:** `RedirectLog` e `RuleExecutionLog` são escritos via `after()` do `next/server`, fora do caminho de resposta, mas sem garantia de entrega — uma queda abrupta entre a resolução e a execução do callback `after()` pode perder uma linha. Isso é aceito como suficiente para uma trilha de auditoria leve hoje, explicitamente insuficiente para qualquer coisa que jamais possa perder um evento (cobrança, webhooks) no futuro.

**Consequências:** Zero infraestrutura para operar hoje. O custo é conhecido e limitado: essas duas tabelas são logs de auditoria, não fonte de verdade para nada — e a Fase 8 existe especificamente para substituí-las por algo durável quando o produto precisar dessa garantia.

---

## ADR-013: Organization é um wrapper opcional acima de Company — Company continua sendo a fronteira de isolamento de tenant

**Status:** Aceita · **Fase:** 4

**Contexto:** A Fase 4 precisa de um conceito de franquia ("Rede Bella Vista" possuindo múltiplas contas de restaurante), mas praticamente toda consulta, serviço e rota de API na base de código é escrita como um `where: { companyId }` simples — bem mais de 100 pontos de chamada. Três formatos foram considerados: (a) renomear `Company` → `Organization` e introduzir uma nova `Company` para unidades (rejeitado — toca todos esses pontos de chamada sem ganho funcional); (b) tornar `Campaign.companyId` opcional para que uma campanha possa viver diretamente sob uma Organization (rejeitado — confunde qual empresa é dona/edita uma campanha, e complica toda leitura existente escopada por `companyId`); (c) adicionar `Organization` como um novo pai opcional acima da `Company` existente, sem tocar em mais nada.

**Decisão:** `Organization` é um novo modelo de nível superior. `Company` ganha um `organizationId` opcional — toda empresa que existia antes da Fase 4 (e todo negócio de localização única depois dela) recebe `organizationId = null` e fica completamente inafetada. `Company` permanece a única fronteira de isolamento de tenant: toda consulta existente continua escopada por `companyId` sem mudanças. `CampaignAssignment.organizationId` é a única exceção deliberada — o único campo em todo o schema que resolve através de fronteiras de `companyId` (ver o comentário do modelo e `loadOrganizationCampaigns()` em `resolution-engine/data.ts`).

**Consequências:** Zero retrabalho e zero migração de dados para toda empresa que não optar por isso. O custo é uma única brecha estreita e explicitamente documentada em uma regra até então universal de "sempre filtrar por companyId" — vale a pena porque é a *única* brecha, não uma entre várias, e é protegida no ponto de atribuição (`assignCampaign` verifica `ctx.organizationId === input.organizationId` antes de gravar a linha).

---

## ADR-014: RBAC v2 substitui OWNER/ADMIN/STAFF por uma matriz de permissões de 6 papéis, não uma hierarquia de papéis

**Status:** Aceita · **Fase:** 4

**Contexto:** O produto agora precisa de Owner/Admin/Marketing/Manager/Operator/Read-Only, cada um com um subconjunto diferente do que pode fazer — um formato que uma verificação simples baseada em hierarquia de 3 papéis (`role >= ADMIN`) não consegue mais expressar, já que Marketing e Manager não são "mais" ou "menos" um que o outro, apenas diferentes.

**Decisão:** `domain/rbac/roles.ts` define `Permission` como uma lista plana de capacidades (`campaign:write`, `campaign:assign`, `team:write`, `access-scope:write`, `organization:write`, `settings:write`, `card:write`, `feedback:resolve`, `audit:read`) e uma matriz `Record<Role, Set<Permission>>` — sem herança, sem comparações `role >= X` em lugar nenhum da base de código depois desta fase. Toda verificação de rota/serviço passa por `requirePermission(ctx, permission)`, não uma lista fixa de papéis. O papel pré-existente `STAFF` não tem equivalente no novo conjunto; linhas `STAFF` existentes mapeiam para `OPERATOR` (semântica mais próxima: linha de frente, não gestão) via o `@default(OPERATOR)` do schema. Seguro como decisão única porque isto é pré-lançamento — nenhuma migração no Supabase real rodou ainda, nenhum dado real de usuário em risco.

**Consequências:** Adicionar um 7º papel ou uma nova capacidade depois é uma edição de uma linha na matriz, não uma busca por toda comparação `role === "ADMIN"` na base de código. O custo desta própria migração: toda rota de API pré-existente a esta fase (`campaigns`, `team`, `branches`, `zones`, `company`) precisou ser varrida de `requireRole(ctx, ["OWNER","ADMIN"])` para `requirePermission(ctx, "...")` — feito nesta fase especificamente porque uma verificação `requireRole` desatualizada teria divergido silenciosamente do próprio gate de UI `canManage` do dashboard (que já lia a nova matriz de permissões), deixando um usuário Marketing/Manager ver um botão de "gerenciar" que retornava 403 ao ser clicado. Capturado durante o Architect Review desta fase, não por um relato de usuário.

---

## ADR-015: UserAccessScope é uma restrição opt-in (lista de permissão), não um sistema de concessão

**Status:** Aceita · **Fase:** 4

**Contexto:** "Owner deve conseguir... limitar acesso por unidade... limitar acesso por zona" poderia ser construído como (a) um sistema de concessão, onde todo usuário começa com zero acesso e um Owner concede explicitamente branches/zonas, ou (b) um sistema de restrição, onde todo usuário começa com acesso completo (dentro do seu papel) e um Owner opcionalmente o restringe. A opção (a) é RBAC mais convencional, mas significaria que todo usuário já existente do app — todos com zero linhas de escopo de acesso hoje — subitamente teria *zero acesso a qualquer coisa* no momento em que este modelo fosse lançado, a menos que um script de preenchimento retroativo rodasse perfeitamente em toda empresa.

**Decisão:** Linhas de `UserAccessScope` são restrições, não concessões: `isWithinScope()` retorna `true` incondicionalmente quando um usuário tem zero linhas (`domain/rbac/scope.ts`). Uma ou mais linhas restringem aquele usuário apenas à(s) branch(es)/zona(s) listada(s); uma linha em nível de branch implica toda zona sob ela. Exatamente um de `{branchId, zoneId}` é definido por linha, aplicado na camada de aplicação (o mesmo padrão de pareamento do escopo/alvo de `CampaignAssignment`).

**Consequências:** A retrocompatibilidade se sustenta por construção — idêntico ao raciocínio da ADR-003 para o fluxo legado de avaliação. Sem preenchimento retroativo, sem script de migração, sem risco de um usuário ficar trancado para fora por um rollout incompleto. O custo: o acesso *efetivo* de um usuário agora é a interseção de dois sistemas independentes (as permissões do seu papel, e sua restrição de escopo de acesso, se houver) em vez de uma única verificação de papel — `assignCampaign`/`unassignCampaign` precisaram ambas ser estendidas nesta fase para verificar `requireScopeAccess` além de `requirePermission`, incluindo o caso específico de bloquear um usuário restrito por escopo de usar escopo COMPANY/ORGANIZATION, já que nenhum dos dois formatos de restrição conseguiria expressar "a empresa inteira" ou "a organização inteira." Também capturado durante o Architect Review desta fase.

---

## ADR-016: Campanhas de toda a organização ganham sua própria camada de cache, buscada apenas quando uma empresa de fato tem uma organização

**Status:** Aceita · **Fase:** 4 (estende a ADR-004)

**Contexto:** A ADR-004 estabeleceu três chaves de cache de resolução invalidadas independentemente (cartão/empresa/campanhas), escopadas por empresa. Uma campanha em escopo ORGANIZATION precisa resolver para todo cartão em toda empresa daquela organização — reaproveitar a chave `campaigns` por empresa significaria invalidá-la para toda empresa-membro a cada edição de campanha de toda a organização.

**Decisão:** Uma quarta chave de cache, `resolve:org-campaigns:v1:{organizationId}`, guarda apenas atribuições em escopo ORGANIZATION, invalidada uma vez por edição via `invalidateOrganizationCampaigns()` independentemente de quantas empresas pertençam àquela organização. O motor de resolução (`resolution-engine/index.ts`) só busca esta chave quando `company.organizationId` não é nulo — uma empresa sem organização (o padrão) paga zero latência extra e zero idas e vindas extras a Redis/Postgres.

**Consequências:** Editar uma campanha de toda a franquia é uma invalidação de cache, não N (uma por empresa-membro) — a mesma propriedade que a ADR-004 estabeleceu para edições por empresa, agora estendida um nível acima. O custo é uma quarta chave para raciocinar sobre, e uma leitura de cache condicional a mais no caminho crítico para empresas que *de fato* pertencem a uma organização — paralelizável com as leituras existentes de empresa/campanhas se isso algum dia se tornar mensurável, ainda não feito porque não é.

---

## ADR-017: Log de auditoria é uma preocupação de fronteira, chamado a partir dos route handlers — não espalhado por toda função de serviço

**Status:** Aceita · **Fase:** 4

**Contexto:** "Registrar: quem fez, quando fez, de onde fez" precisa de um ator (`userId`), então toda função de serviço de uma mutação auditada precisaria, de outra forma, de um parâmetro `AuthContext` adicionado só para satisfazer o log — uma preocupação transversal vazando para dentro de código de regra de negócio que não tem outro motivo para saber quem está chamando.

**Decisão:** `recordAudit(ctx, action, {targetId, metadata})` em `services/audit.service.ts` é chamado a partir dos route handlers da API, imediatamente após a chamada de serviço subjacente já ter tido sucesso — nunca de dentro de `campaign.service.ts`, `team.service.ts`, etc. `AuditAction` cobre deliberadamente apenas mutações de alto valor (ciclo de vida de campanha, membros de equipe, escopos de acesso, configurações de empresa/organização) — não toda operação de CRUD do app; uma trilha completa de tudo é trabalho de event sourcing da Fase 8. Best-effort por design: uma falha de log é capturada e registrada, nunca permitida a falhar uma requisição cuja mutação subjacente já foi commitada (mesmo raciocínio do `RedirectLog` da ADR-012, só que no lado autenticado do app). Reaproveita a convenção existente de hash salgado de `lib/ip.ts` para o campo `ipHash`, uma única convenção de privacidade em todo o app em vez de um caso especial para ações de equipe.

**Consequências:** Toda rota que precisava de uma trilha de auditoria (12 delas, ao final desta fase) ganhou uma linha extra de `await recordAudit(...)` com zero mudanças na camada de serviço por baixo. O custo: uma entrada de auditoria só existe para mutações que passam por uma rota auditada — uma futura chamada direta de serviço (de um script, um worker de fila, etc.) que contorne a camada de rota pularia o log silenciosamente. Aceitável hoje já que toda mutação atualmente *de fato* passa por uma rota; vale reexaminar se isso deixar de ser verdade.

---

## ADR-018: Pontos de extensão para mercados de franquia ficam como espaço para crescer, não construídos

**Status:** Adiada · **Decidido:** Fase 4

**Contexto:** A visão de longo prazo nomeia vários verticais além de restaurantes — hotéis, academias, clínicas, coworkings, varejo, redes de franquia nacionais — que o mesmo núcleo (`Organization → Branch → Zone → asset → Campaign Resolution Engine`) deve eventualmente suportar. Construir funcionalidades específicas de vertical agora (ex.: um tipo de ativo "quarto" para hotéis, um conceito de "matrícula" para academias) significaria desenhar para mercados que este produto ainda não atende, contra requisitos que ninguém validou.

**Decisão:** A Fase 4 lança a hierarquia genérica (`Organization → Branch → Zone → NFCCard`) com um vocabulário que já se lê como agnóstico de vertical no schema e na camada de domínio (uma "Zone" é qualquer agrupamento, uma "Branch" é qualquer unidade física) — mas não adiciona nenhuma modelagem, campo ou texto de UI específico de vertical além de restaurantes. Nenhum código é escrito para hotéis/academias/clínicas/coworkings/varejo nesta fase.

**Consequências:** O núcleo permanece pequeno e comprovadamente correto para o único mercado que atualmente atende. O custo/risco: um vertical futuro pode precisar de uma mudança de schema que esta hierarquia genérica não antecipou (ex.: um "quarto" de hotel precisando de estado por diária que uma "mesa" de restaurante nunca precisa) — aceito explicitamente, já que adivinhar esse formato agora, antes de existir um único cliente de hotel, arrisca o mesmo problema de "formato errado é caro de desfazer" que a ADR-006 já enfrentou uma vez com Branch/Zone.

---

## ADR-019: O layout do Mapa de Mesas vive no próprio NFCCard — sem uma entidade Table separada

**Status:** Aceita · **Fase:** 5

**Contexto:** O Mapa de Mesas precisa da posição no canvas, tamanho, rotação, forma e número de lugares de cada cartão. A alternativa a estender `NFCCard` seria um novo modelo `TableLayout` em relação 1:1 com ele — o mesmo formato de decisão da questão Organization-vs-Company da ADR-013, mas em uma escala muito menor.

**Decisão:** Os campos de layout (`layoutX`, `layoutY`, `layoutWidth`, `layoutHeight`, `layoutRotation`, `tableShape`, `seats`) são colunas diretamente em `NFCCard`, todas opcionais ou com padrão, de modo que todo cartão criado antes da Fase 5 simplesmente fica "não posicionado" (`layoutX`/`layoutY` nulos) em vez de exigir uma migração para preencher posições retroativamente. Uma "mesa" no mapa É o NFCCard — não uma entidade diferente que referencia um — porque todo ativo NFC/QR neste produto (uma mesa, uma recepção, o cartão de um funcionário) já é exatamente um `NFCCard`, e o trabalho do Mapa de Mesas é visualizar e organizar esses ativos, não introduzir um segundo conceito paralelo de "mesa."

**Consequências:** Zero joins para renderizar o mapa (`listCardsForMap` é uma única consulta plana), e todo caminho de código existente de listagem/CRUD/atribuição de campanha de `NFCCard` continua funcionando sem modificação. O custo: `NFCCard` agora carrega colunas específicas do editor de UI (rotação, forma) que não têm significado para um ativo que não é mesa, como "Recepção" — aceito como padrões inofensivos e não usados, em vez de valer um segundo modelo, a mesma escolha que `seats`/`tableShape` já fazem.

---

## ADR-020: O preview de status do Mapa de Mesas reaproveita as regras de ordenação do motor, não o motor inteiro

**Status:** Aceita · **Fase:** 5

**Contexto:** "Mostrar quais mesas possuem campanhas ativas" e "mostrar conflitos" precisam saber, para cada mesa, qual campanha se aplica atualmente — o que soa exatamente como o trabalho do Campaign Resolution Engine. Mas a decisão real do motor (`resolveDecision`) depende de entradas escopadas à requisição que não existem para uma visualização estática de admin: o instante atual (para avaliação de dia/hora/data de `Rule`), um tipo de dispositivo, e seleção de variante A/B. Reaproveitar o motor como está significa ou simular essas entradas (enganoso — o mapa mostraria o que um visitante hipotético veria agora, não "o que está atribuído") ou bifurcá-lo.

**Decisão:** `domain/table-map/status.ts` reimplementa apenas a **ordenação** de especificidade→prioridade→recência (`scopeSpecificityRank`, importada do mesmo módulo de domínio que o próprio motor usa — uma função de ranking, não duas), aplicada às atribuições que estruturalmente se aplicam a um cartão (casadas por escopo contra sua branch/zona/empresa/organização). Deliberadamente pula a avaliação de `Rule` e a seleção de variante A/B. Uma mesa mostrando "Happy Hour Sexta" no mapa significa "esta campanha seria a candidata líder se sua própria regra de dia/hora passar" — um preview bom o suficiente, não uma promessa.

**Consequências:** Nenhum motor de decisão duplicado para manter sincronizado com a ordem de desempate do motor real (eles compartilham a única função de ranking, então uma futura mudança na especificidade se aplica automaticamente a ambos). O custo, declarado claramente no código e aqui: a cor de status do mapa pode mostrar uma campanha que uma regra na verdade excluiria agora (ex.: uma campanha só-de-sexta mostrada numa terça) — aceitável para "o que está configurado aqui" num relance, errado se lido como "o que um cliente vê neste segundo." Revisitar se o Live Mode (Fase 6) precisar de uma visão real em tempo real.

---

## ADR-021: A verificação de duplicidade de CampaignAssignment foi generalizada para todo escopo, não só COMPANY/ORGANIZATION

**Status:** Aceita · **Fase:** 5 (corrige a ADR-007 e parte da ADR-013)

**Contexto:** A ADR-007 (Fase 2) e a proteção de escopo ORGANIZATION adicionada na Fase 4 ambas presumiram que só atribuições em escopo COMPANY e ORGANIZATION precisavam de uma verificação explícita de existência, raciocinando que escopos CARD/ZONE/BRANCH tinham uma coluna distinguidora não-nula (`cardId`/`zoneId`/`branchId`) que a constraint `@@unique` ainda conseguiria capturar. Reexaminar isso ao estender `assignCampaign` para o fluxo de atribuição em lote do Mapa de Mesas revelou a regra real: constraints únicas do Postgres nunca tratam dois NULLs como iguais, para **nenhuma** coluna da constraint — então uma única coluna nula em qualquer lugar da linha comparada é suficiente para deixar passar uma duplicata, não importa o que as outras colunas (incluindo a "distinguidora") contenham. Como linhas CARD/ZONE/BRANCH ainda têm as *outras três* colunas-alvo nulas, elas estiveram expostas à mesma brecha silenciosa de duplicidade que COMPANY/ORGANIZATION o tempo todo — só que de forma menos óbvia, já que exigia duas atribuições idênticas ao mesmo cartão/zona/branch específico, em vez de duas atribuições de empresa inteira.

**Decisão:** A verificação de existência de `assignCampaign` dentro de sua transação Serializable agora é uma única consulta unificada — `{campaignId, scope, organizationId, branchId, zoneId, cardId}` casada por igualdade real (o Prisma compila um filtro `null` para `IS NULL`, que não tem o ponto cego NULL-vs-NULL da constraint) — cobrindo todo escopo de forma uniforme, não casos especiais por escopo.

**Consequências:** Fecha um bug latente anterior a esta fase: um duplo clique em "Atribuir," ou uma requisição repetida, antes podia criar uma atribuição duplicada e silenciosa em escopo CARD/ZONE/BRANCH (inofensiva para o comportamento de resolução, já que o resolvedor simplesmente veria dois candidatos idênticos e escolheria qualquer um, mas uma linha duplicada confusa na lista de atribuições do dashboard e um `_count.assignments` inflado). Nenhuma mudança de schema, nenhuma migração — puramente uma correção de camada de aplicação. Encontrado e corrigido durante o Architect Review desta fase, não por relato de usuário.

---

## ADR-022: `packages/{ui,design-tokens,icons,animations}` são pastas com alias de import, não um monorepo real

**Status:** Aceita · **Fase:** 4.5

**Contexto:** O briefing da Fase 4.5 pede pacotes próprios (`packages/ui`, `packages/design-tokens`, `packages/icons`, `packages/animations`) para dar ao Design System uma identidade de "produto próprio," não apenas mais uma pasta de componentes dentro de `src/`. Um monorepo real (pnpm/turborepo workspaces, um `package.json` e um pipeline de build por pacote) é a forma mais "correta" de fazer isso a longo prazo — mas também é uma mudança estrutural de alto risco num projeto que já tem uma base de código grande, com um único `next build` já validado por quatro fases e meia de trabalho. A instrução explícita desta fase é "sem quebrar compatibilidade."

**Decisão:** `packages/design-tokens`, `packages/ui`, `packages/icons` e `packages/animations` existem como pastas TypeScript normais, importadas via aliases dedicados no `tsconfig.json` (`@nfc-os/design-tokens`, `@nfc-os/ui`, `@nfc-os/icons`, `@nfc-os/animations`) apontando para `packages/*/src`. Não há `package.json` por pacote, não há workspace do gerenciador de pacotes, não há build separado — é o mesmo `next build` único de sempre, só que com uma organização de pastas e uma convenção de import que já se parecem com pacotes reais.

**Consequências:** Todo o ganho organizacional pedido (tokens centralizados, uma biblioteca de componentes com uma superfície de import estável e "de marca própria") sem nenhum dos riscos operacionais de uma conversão de monorepo em produção (mudança de todas as ferramentas de build, scripts de CI, resolução de módulos). O custo: estes não são pacotes npm publicáveis ou versionáveis de verdade — se um dia existir um segundo consumidor real (por exemplo, um SDK de API pública da Fase 9 que precise do mesmo design system, ou um app mobile) que precise instalar `@nfc-os/ui` como uma dependência separada e versionada, essa é a hora de fazer a conversão real para workspaces — não antes, quando o único "consumidor" é o próprio app que já os contém.

---

## ADR-023: Uma única cor de marca (violeta-índigo) substitui o cinza neutro padrão do shadcn/ui em todo o produto

**Status:** Aceita · **Fase:** 4.5

**Contexto:** O tema padrão do shadcn/ui (herdado desde o MVP) usa `--primary` em escala de cinza puro (preto/branco) — funcional, mas sem nenhuma identidade visual própria. Quase todo botão, link, anel de foco, badge de status "ativo" e destaque de navegação do produto inteiro já referenciava `--primary`/`--ring`/`--sidebar-primary`, então essa é a alavanca de maior efeito possível para dar identidade visual ao produto inteiro de uma vez.

**Decisão:** Um único violeta-índigo (`oklch(0.549 0.214 279)` no claro, `oklch(0.685 0.19 279)` no escuro) definido como `--brand` em `globals.css`, com `--primary`, `--ring`, `--sidebar-primary` e `--accent` todos redirecionados para derivar dele (`--accent`/`--sidebar-accent` usam uma versão bem clara/dessaturada, `--brand-subtle`, para fundos). Nenhum componente precisou mudar — a cor se propaga automaticamente para tudo que já usava essas variáveis.

**Consequências:** Identidade visual em todo o produto com uma mudança em um único arquivo, não uma auditoria de cada componente. O custo: qualquer captura de tela ou documentação externa que já existisse com o cinza antigo fica desatualizada visualmente (não há nenhuma, já que o produto nunca foi lançado) — e qualquer novo token de cor futuro (ex.: uma segunda cor de marca para um white-label da Fase 10) precisa decidir explicitamente se deriva de `--brand` ou é independente.

---

## ADR-024: Componentes de `packages/ui` recebem ícones como elemento já renderizado, nunca como referência do componente

**Status:** Aceita · **Fase:** 4.5

**Contexto:** Encontrado durante a verificação interativa desta fase: `/dev/ceo` e `/dev` (Server Components) quebravam em runtime com "Functions cannot be passed directly to Client Components" ao passar `icon={GitBranch}` para `KpiCard`. A causa: `KpiCard` (e vários outros componentes de `packages/ui`) são módulos `"use client"` (usam Framer Motion), e uma referência de componente Lucide (`LucideIcon`, um `ForwardRefExoticComponent`) não é um valor serializável através do limite Server→Client do React Server Components — só elementos JSX já renderizados, strings, números e objetos simples atravessam esse limite. O bug não aparecia nos testes interativos da Fase 5 porque aquele harness era inteiramente `"use client"` (cliente chamando cliente nunca serializa nada); só surgiu ao testar de verdade uma página Server Component real.

**Decisão:** Todo prop de ícone em `packages/ui` (`KpiCard.icon`, `CampaignCard.icon`, `EmptyState.icon`, `SmartBadge.icon`, `TimelineItem.icon`, `ActivityFeedEntry.icon`) tem o tipo `React.ReactNode`, não `LucideIcon` — quem chama passa `icon={<GitBranch className="size-4" />}`, nunca `icon={GitBranch}`. Onde um wrapper interno do app precisa manter a API antiga por conveniência de quem já a usa (`StatCard.icon` continua `LucideIcon`, já que várias Server Components já o chamam assim), a conversão para elemento renderizado acontece dentro do próprio wrapper, exatamente no ponto em que cruza para dentro do componente `"use client"` — não é responsabilidade de cada página lembrar disso.

**Consequências:** Todo o restante desta verificação de tipos passou a ser feito pelo próprio `tsc` — mudar o tipo do prop fez o compilador apontar exatamente todo call-site que precisava de correção, nenhum precisou ser encontrado por inspeção manual. O custo: quem usa `packages/ui` pela primeira vez precisa saber dessa convenção (documentada no comentário de `premium-card.tsx` e aqui) — um pequeno preço a mais de API em troca de funcionar corretamente tanto chamado de uma Server Component quanto de uma Client Component, que é exatamente como este produto é construído.

---

## ADR-025: Live Mode é SSE com polling do banco, não WebSocket real — e o Heatmap Engine é um módulo de domínio deliberadamente separado

**Status:** Aceita · **Fase:** 6

**Contexto:** O briefing da Fase 6 pediu explicitamente "WebSocket como primeira opção" para o Live Mode. Mas o alvo de deploy estabelecido desde a Fase 0 é Vercel — funções serverless, que não sustentam uma conexão WebSocket persistente sem uma peça de infraestrutura à parte (um servidor Node dedicado sempre ligado, ou um provedor de tempo real terceirizado como Pusher/Ably/PartyKit/Supabase Realtime). Nenhuma dessas peças existe neste projeto hoje, e criar uma só para esta fase seria a mesma armadilha que o projeto já evitou antes (ver ADR-002, ADR-018): fingir uma infraestrutura que não existe de verdade.

**Decisão:** O transporte real desta fase é Server-Sent Events (`ReadableStream` numa Route Handler `runtime = "nodejs"`) alimentado por _polling_ do banco a cada 2s (`src/services/live.service.ts`'s `listRecentEvents`, lendo `RedirectLog`/`RatingEvent`/`PrivateFeedback`/`AuditLog` — nenhuma tabela de eventos nova). A conexão se fecha sozinha após 50s (antes de qualquer timeout de plataforma) e emite um evento `reconnect` com o último `since` conhecido; o `EventSource` do navegador reconecta sozinho, e o hook cliente (`use-live-connection.ts`) trata isso como transparente. Um heartbeat a cada 15s distingue "salão quieto" de "conexão morta" (watchdog de 30s no cliente). Cada aba abre sua própria conexão — sincronização entre abas significa "todas convergem para o mesmo estado do servidor," não uma aba líder compartilhando uma única conexão via `BroadcastChannel` (uma otimização deliberadamente adiada, não perdida: revisitar apenas se o volume de conexões simultâneas por usuário um dia for um problema real, o que não é o caso para uma equipe de restaurante).

Em paralelo, o Heatmap Engine (`src/domain/heatmap/`, `src/services/heatmap.service.ts`) é um módulo próprio, sem nenhuma dependência de `resolution-engine` ou `domain/table-map` — ele lê as mesmas tabelas que o motor de resolução já escreve, mas não conhece nada sobre como uma campanha é resolvida. A única exceção documentada: a camada "Campanha atual" não tem agregação própria — reaproveita o preview de status do Mapa de Mesas (`domain/table-map/status.ts`, ADR-020), composto só na camada de UI, para nunca duplicar a lógica de especificidade/prioridade que já existe.

**Consequências:** Uma experiência de tempo real que funciona de verdade hoje, sem nenhuma peça de infraestrutura nova — ao custo de uma latência mínima de até 2s (o intervalo de polling) em vez de push instantâneo, imperceptível numa demonstração e aceitável em produção para este caso de uso. Se um dia o volume de empresas/conexões simultâneas justificar um WebSocket de verdade, a superfície do hook cliente (`useLiveConnection`) já está isolada o bastante para trocar `EventSource` por `WebSocket` sem tocar em nenhum componente que o consome — a mudança fica contida a um arquivo.

---

## ADR-026: Time Machine reconstrói o passado a partir de `RedirectLog`, não de um histórico de atribuições que não existe

**Status:** Aceita · **Fase:** 6

**Contexto:** O briefing pediu "voltar no tempo" e mostrar "qual campanha estava ativa" numa mesa num instante passado. `CampaignAssignment` não tem `deletedAt` nem versionamento — uma vez que uma atribuição é removida ou trocada, não sobra nenhum registro de que ela existiu (além de um `AuditLog` que, para atribuições em lote, nem registra quais cartões específicos foram afetados — ver o comentário da rota de bulk assignment). Fingir uma reconstrução exata do estado de atribuições do passado seria inventar uma precisão que o produto não tem — o mesmo tipo de escolha que já rejeitamos ao definir "Conversão" de forma estrita (ADR de Fase 6, ver `RELATORIO_FASE_6.md`) em vez de contar todo redirecionamento como conversão.

**Decisão:** `time-machine.service.ts`'s `getSnapshotAt` reconstrói, para cada mesa, a última campanha que ela **realmente serviu** até o instante pedido — lida direto de `RedirectLog.campaignId`, que é gravado por toque e nunca muda depois. Isso é uma aproximação honesta (quase sempre coincide com a atribuição real do momento) em vez de uma reconstrução perfeita que não existe. A consulta é limitada a 3000 linhas mais recentes por empresa (`SNAPSHOT_SCAN_LIMIT`) — um limite documentado, não escondido: uma mesa raramente tocada numa operação muito grande pode não aparecer no snapshot se muitos outros toques aconteceram depois dela e antes do instante pedido.

**Consequências:** O Time Machine é honesto sobre o que sabe e o que não sabe, consistente com o padrão de honestidade de métricas já estabelecido no produto. O custo: não é uma reconstrução perfeita de "qual era a atribuição ativa" — se essa precisão um dia for necessária (ex.: auditoria de compliance), a solução correta é uma tabela de histórico de atribuições dedicada (candidata natural para a Fase 8, junto com o event sourcing de verdade), não forçar mais precisão de `RedirectLog`, que nunca foi desenhado para isso.

---

## ADR-027: O Command Center de `/dev/ceo` tem seu próprio par de rotas somente-leitura, escopadas fixas à empresa de demonstração

**Status:** Aceita · **Fase:** 6

**Contexto:** O Command Center reaproveita `TableMapView` inteiro (Live Mode, Heatmap, Time Machine, Ghost Mode) dentro de `/dev/ceo` — uma área que nunca teve autenticação real (gated só por `NODE_ENV !== "production"`, lendo hoje apenas `dev-status.json`). Mas toda rota de API que o Live Mode/Heatmap/Time Machine chama (`requireAuthContext()`) resolve a empresa a partir da sessão Clerk de quem está logado — não a partir de um parâmetro. Embutir `TableMapView` sem mudança nenhuma faria essas chamadas resolverem para a empresa real de quem estiver logado (ou falharem com 401 se ninguém estiver), nunca para a empresa "Bella Vista" do seed — o Command Center mostraria dados errados ou nada.

**Decisão:** `TableMapView` ganhou um prop opcional `liveApiBase` (vazio por padrão, preservando 100% o comportamento atual do dashboard real) que os hooks de Live Mode/Heatmap/Time Machine usam como prefixo de URL. O Command Center passa `liveApiBase="/api/dev/demo"`, um pequeno conjunto de rotas espelho (`/api/dev/demo/live/stream`, `/api/dev/demo/heatmap`, `/api/dev/demo/table-map/time-machine`, `/api/dev/demo/table-map/assignments`) que chamam exatamente os mesmos serviços (`listRecentEvents`, `getHeatmapCounts`, `getSnapshotAt`, `listAssignmentsForStatus`) só resolvendo a empresa via `getDemoCompany()` (um slug fixo, `"bella-vista"`, nunca aceito de fora) em vez de `requireAuthContext()`, e recusando-se a existir em produção (`NODE_ENV === "production"` → 404). O Command Center nunca ganha rotas de escrita próprias — `canEditLayout`/`canAssign` ficam `false`, então arrastar uma campanha continua exigindo o dashboard real e autenticado.

**Consequências:** A arquitetura de domínio/serviço é 100% reaproveitada — nenhuma lógica de agregação, formatação de evento ou reconstrução histórica existe duas vezes. A única duplicação é a casca fina de cada rota (resolver `companyId` de um jeito ou de outro), o mínimo necessário para uma tela de demonstração sem sessão poder ler dados reais com segurança. O custo: um segundo pequeno conjunto de rotas para manter em sincronia se a forma de resposta de alguma delas mudar — mitigado por elas chamarem literalmente a mesma função de serviço, então uma mudança de formato aparece nos dois lados automaticamente.

---

## ADR-028: Ghost Mode Evolution confirma mudanças em massa antes de aplicar; mesa única continua instantânea

**Status:** Aceita · **Fase:** 6

**Contexto:** A Fase 5 tornou toda atribuição de campanha (mesa única, grupo selecionado, zona inteira, empresa inteira) igualmente instantânea — sem confirmação. Isso é seguro para uma mesa (baixo risco, fácil de desfazer visualmente), mas arriscado para uma mudança que afeta uma zona inteira ou a empresa inteira: um arraste acidental de alguns pixels a mais poderia reatribuir centenas de mesas sem que o gerente percebesse a extensão do que acabou de fazer.

**Decisão:** Uma mudança em massa (grupo de mesas marcado, zona, ou empresa) passa por um "Preview Inteligente" (`GhostModePreviewDialog`) antes de ser efetivada — mostra a contagem e os nomes das mesas afetadas, mais uma estimativa de impacto honesta e verificável (toques reais das últimas 24h nessas mesas exatas, reaproveitando a mesma rota `/api/heatmap` da camada "Aproximações", não um número inventado). Uma mesa única continua com o comportamento instantâneo da Fase 5. `bulkAssignCampaignToCards` passou a usar `createManyAndReturn` em vez de `createMany`, devolvendo os IDs das atribuições realmente criadas, para o botão "Desfazer" (que aparece no toast de sucesso de toda atribuição, mesa única ou em massa) conseguir remover exatamente esse lote — nunca um filtro amplo por campanha/cartões que arriscaria apagar uma atribuição que já existia antes.

**Consequências:** Uma mudança de grande impacto nunca acontece sem o gerente ver, antes de confirmar, exatamente o que vai mudar — sem adicionar fricção a uma mesa única, o caso mais comum. O custo: uma chamada de rede extra (a estimativa de impacto) antes de toda confirmação em massa, e uma dependência a mais entre o Ghost Mode e o Heatmap Engine — aceitável, já que ambos são módulos de leitura, sem acoplamento de escrita entre si.

---

## ADR-029: ROI Mode é opcional e nunca estima com dado parcial — três campos em `Company`, um em `Campaign`

**Status:** Aceita · **Fase:** 7

**Contexto:** O pedido explícito da Fase 7 foi transformar toques/conversões em dinheiro estimado — "Você ganhou aproximadamente R$ 18.400 em receita influenciada pelo NFC este mês" — a partir de três parâmetros que só o empresário sabe (ticket médio, taxa de retorno estimada, valor de um novo cliente). Nada disso existe hoje no produto, e não há integração de gasto de anúncio para calcular "ROI da campanha" ou "custo por avaliação" de verdade.

**Decisão:** Três campos nulos por padrão em `Company` (`roiAvgTicket`, `roiReturnRate`, `roiNewCustomerValue`) — nulos até o empresário configurar em Configurações, nunca com um valor-padrão inventado. `domain/analytics/roi.ts`'s `computeRoiSummary` só calcula `estimatedRevenue` quando os três estão presentes; caso contrário, `configured: false` e a UI mostra "configure o ROI Mode" em vez de um número. A fórmula (`interações × ticket_médio × taxa_de_retorno`) é exposta na própria UI, nunca uma caixa-preta. Para "custo por avaliação"/"ROI da campanha", `Campaign` ganhou um campo opcional `estimatedCost` (auto-declarado pelo empresário, já que não existe integração de gasto de anúncio) — sem ele, esses dois números ficam honestamente como `null`, nunca calculados contra um custo que não existe.

**Consequências:** ROI Mode é genuinamente opcional — uma empresa que nunca configura os três campos continua vendo o resto do Analytics Enterprise normalmente, só sem a seção de receita estimada. O custo: o "ROI da campanha" completo (receita menos custo, dividido pelo custo) só existe para campanhas cujo dono se deu ao trabalho de declarar um custo — a maioria não vai, e a UI precisa deixar isso claro em vez de esconder a limitação.

---

## ADR-030: Analytics Enterprise em 5 motores decididamente separados — e um limite estrutural real descoberto ao construí-los

**Status:** Aceita · **Fase:** 7

**Contexto:** O briefing da Fase 7 pediu explicitamente "Analytics Engine, Insights Engine, Forecast Engine, Ranking Engine, Export Engine — todos desacoplados". Ao desenhar as agregações reais, um limite estrutural importante apareceu: uma campanha (WhatsApp, Instagram, Google Reviews direto, etc.) redireciona o cliente para fora do produto instantaneamente — ela nunca passa pelo fluxo de estrelas (`RatingEvent`). Ou seja, **nenhuma campanha consegue, honestamente, "gerar uma avaliação"** neste modelo de dados hoje; só o fluxo padrão (sem campanha ativa no momento do toque) gera avaliações. Um insight como "a campanha X gerou 42 avaliações extras" seria, portanto, uma alegação que os dados não sustentam.

**Decisão:** Cinco arquivos de serviço próprios — `analytics-engine.service.ts` (KPIs, funil, comparativos, ROI, timeline executiva), `insights-engine.service.ts`, `forecast-engine.service.ts`, `ranking-engine.service.ts`, `export-engine.service.ts` — cada um com sua própria responsabilidade e suas próprias consultas ao Postgres, todos lendo `RedirectLog`/`RatingEvent`/`Visit`/`AuditLog` (nunca uma tabela de eventos nova). "Desacoplado" aqui significa responsabilidade única e substituível independentemente, não zero conhecimento mútuo: o Insights Engine importa `getRanking` do Ranking Engine para sua comparação de zonas (reaproveitar uma consulta já correta, não duplicá-la) — a única dependência deliberada entre os cinco. Toda comparação de **campanha** usa **toques** (quão usada ela é), nunca avaliações; toda comparação de **zona/mesa/funcionário** usa **conversões** (`RatingEvent.redirectedGoogle=true`), que É atribuível a um `cardId` real. "Funcionário" continua sendo apenas um `NFCCard` tagueado `"equipe"` (ver ADR-019) — nenhuma entidade nova.

**Consequências:** Nenhum insight, ranking ou KPI deste produto afirma algo que os dados não provam — o mesmo padrão de honestidade já estabelecido para "Conversão" (Fase 6) e o Time Machine (ADR-026), agora estendido a todo o Analytics Enterprise. O custo: "melhor campanha" significa "mais usada", não "mais lucrativa" — uma nuance que a UI precisa comunicar (rótulos e `hint`s explícitos), já que "melhor" sozinho seria ambíguo o bastante para parecer uma alegação diferente da que os dados sustentam.

---

## ADR-031: Exportação usa `exceljs` e `@react-pdf/renderer` — nenhum headless browser

**Status:** Aceita · **Fase:** 7

**Contexto:** "Exportações Enterprise" pediu CSV, Excel e um PDF que pareça um relatório profissional enviado a um investidor ou diretor. Gerar um PDF "bonito" costuma significar renderizar HTML/CSS num navegador headless (Puppeteer + Chromium) — a mesma classe de armadilha de infraestrutura já evitada no ADR-025 (WebSocket real exigiria um servidor dedicado): Chromium em uma function serverless da Vercel exige uma camada extra (`@sparticuz/chromium` ou similar), aumenta o tempo de cold start, e é um ponto a mais de falha para uma funcionalidade que precisa ser confiável.

**Decisão:** `exceljs` para o `.xlsx` (biblioteca madura, gera um workbook real com múltiplas abas e formatação, sem depender de nenhum motor de renderização) e `@react-pdf/renderer` para o PDF — components React (`Document`/`Page`/`View`/`Text`) compilados para PDF em Node puro, sem Chromium. O acento visual do PDF usa um hex fixo (`#4F46E5`, uma aproximação da cor de marca `oklch(0.549 0.214 279)`) já que PDF não consome variáveis CSS — documentado no próprio arquivo do template (`services/export/analytics-report-pdf.tsx`), não escondido.

**Consequências:** Exportação funciona hoje, em qualquer ambiente serverless, sem infraestrutura adicional — o mesmo compromisso de "sem infraestrutura exótica" do ADR-025. O custo: o layout do PDF é o que o modelo de flexbox do `@react-pdf/renderer` permite (mais simples que HTML/CSS completo) — suficiente para um relatório executivo de texto/tabelas, não para gráficos vetoriais complexos dentro do PDF (os gráficos do dashboard em si continuam só na tela, via recharts).

---

## ADR-032: Event Bus com `EventLog` sem foreign keys, tipo de evento como `string`, e replay que nunca duplica a trilha de auditoria

**Status:** Aceita · **Fase:** 8

**Contexto:** A Fase 8 pediu um Event Bus interno com 10 eventos de domínio nomeados, "preparado para Kafka no futuro sem reescrever produtores", e um Event Replay capaz de "reproduzir uma campanha, uma sequência de toques, reconstruir analytics". Três decisões de schema/contrato determinam se isso é honesto ou só aparenta ser: como `EventLog` se relaciona com `Company`/`Organization`, como o tipo do evento é armazenado, e o que "replay" realmente faz com um evento já gravado.

**Decisão:** `EventLog.companyId`/`organizationId` são strings indexadas simples, **sem** `@relation`/`onDelete` — o propósito de um log de eventos é sobreviver e se desacoplar do estado atual das entidades que descreve; uma FK rígida trabalharia contra isso (e um `onDelete: Cascade` apagaria a própria trilha de auditoria que deveria sobreviver à entidade). `EventLog.type` é `String`, não um enum do Postgres — a lista de 10 eventos vive só em `domain/events/types.ts` (`DomainEventType`), então um evento novo nunca exige uma migração de schema, só uma mudança de código. `publishEvent` primeiro grava em `EventLog` (Postgres, durável — a fonte da verdade) e só depois tenta rotear para filas (best-effort); nunca lança para quem chamou. O Event Bus é publicado a partir da camada de ROTA (não de dentro dos `.service.ts`), no mesmo ponto onde `recordAudit` já era chamado — convenção verificada no código existente antes de escrever a primeira linha nova, não inventada. As duas exceções deliberadas são o Resolution Engine e `rating.service.ts`/`feedback.service.ts`, que são fluxos públicos sem `ctx` de autenticação: ali o evento nasce dentro do próprio serviço/engine, dentro de um `after()`, o mesmo padrão non-blocking já usado para `RedirectLog`.

Event Replay separa duas operações que pareciam uma só: `reconstructSequence` (somente leitura — devolve a sequência gravada, para investigação/reconstrução, nunca reprocessa nada) e `replayToQueues` (efeito colateral real — reenfileira eventos já existentes). A segunda **nunca cria uma segunda linha em `EventLog`** para o mesmo acontecimento (isso duplicaria a trilha de auditoria de um evento que já é real); em vez disso, `replayExistingEvent` reaproveita o `id` original como `jobId` do BullMQ, o que dá deduplicação de fila "de graça" e faz a claim de idempotência do worker decidir corretamente se o efeito colateral (ex.: um webhook) deve rodar de novo.

Por fim, uma organização sozinha nunca satura o Queue Engine compartilhado: `routeToQueues` aplica um rate limit por `companyId` (fila `queueRouting`, 500 eventos/min, generoso o bastante para nunca incomodar uso real) antes de enfileirar — nunca antes de gravar em `EventLog`, então um evento "descartado" do roteamento nunca é um evento perdido, só um evento que aguarda um Replay manual depois do pico passar.

**Consequências:** O contrato de evento pode evoluir (novo tipo, novo campo em um payload existente via o campo `version`) sem migração de schema nem quebra de um consumidor antigo. O custo: não há constraint do banco garantindo que `type` seja um dos 10 valores válidos — essa garantia vive inteiramente no TypeScript (`DomainEventType`) e depende de todo publicador passar por `publishEvent`, nunca escrever em `EventLog` diretamente.

---

## ADR-033: Queue Engine sobre BullMQ + drenagem por tempo limitado — o mesmo tipo de honestidade do ADR-025, agora para filas em serverless

**Status:** Aceita · **Fase:** 8

**Contexto:** BullMQ exige um `Worker` de processo persistente consumindo a fila continuamente — uma function serverless da Vercel não sustenta isso entre invocações, a mesma tensão arquitetural já resolvida para WebSocket vs. SSE no ADR-025. Sem resolver isso, "filas de produção com retry/backoff/dead-letter" seria uma peça de infraestrutura real com nenhum jeito real de rodar no único ambiente de deploy que este produto tem hoje.

**Decisão:** Um padrão de "drenagem por tempo limitado" (`lib/workers/drain.ts`): os 6 Workers (`analytics`/`webhooks`/`whatsapp`/`emails`/`exports`/`heavy`) sobem, processam o que houver disponível por ~45s, e encerram de forma limpa — nunca ficam pendurados além do tempo de execução de uma function serverless. Um Vercel Cron (`vercel.json`) aciona `/api/queues/process` a cada minuto, protegida por um `CRON_SECRET` em bearer token; sem o segredo configurado, a rota se recusa a rodar. Dead-letter não existe nativamente no BullMQ (um job com tentativas esgotadas só fica no estado "failed" da própria fila) — um listener de `QueueEvents` em modo "failed" verifica se `attemptsMade >= attemptsAllowed` e move o job para uma fila `<nome>-dead` dedicada, mais fácil de inspecionar/reprocessar. Idempotência de job usa o cliente REST do Upstash já existente (`SET NX EX`, TTL de 24h) — não o `ioredis`/BullMQ — porque é a mesma primitiva simples já usada pelo rate limiter, e funciona mesmo em um deploy que só tem a API REST configurada. Um segundo entrypoint, `lib/workers/run-workers.ts`, existe para uma futura hospedagem não-serverless (Railway/Fly/uma VM) com Workers de verdade, sempre ativos — documentado com uma ressalva honesta: rodá-lo via `tsx` puro não resolve o alias `@/` sem `tsconfig-paths` ou um passo de build, uma limitação real descoberta testando, não hipotética.

O worker de `webhooks` faz a única chamada HTTP de saída de todo o produto contra uma URL configurada pelo próprio cliente (`Company.webhookUrl`) — por isso é o único worker envolto em um Circuit Breaker (`lib/circuit-breaker.ts`, CLOSED/OPEN/HALF_OPEN por processo) e assinado com HMAC-SHA256 (`Company.webhookSecret`) mais um timeout de 10s. Os workers de `whatsapp` e `emails` são stubs deliberadamente honestos: logam exatamente o que seria enviado e um campo `aviso` explícito de que nenhuma integração real (API do WhatsApp Business, Resend/SendGrid) existe neste produto — fingir o envio seria inventar uma capacidade que não existe.

**Consequências:** O produto tem filas de produção reais, hoje, sem nenhuma peça de infraestrutura além do que a Vercel já oferece (Cron + functions). O custo: a latência de processamento não é "instantânea" como um Worker sempre ativo teria — um job pode esperar até ~1 minuto (o intervalo do Cron) antes de ser pego; aceitável para analytics/webhooks/e-mail assíncronos, documentado como o motivo pelo qual `run-workers.ts` existe para quando/se um deploy não-serverless fizer sentido.

---

## ADR-034: Observability Engine honesto — OpenTelemetry e Sentry existem no código, nenhum coletor real está configurado

**Status:** Aceita · **Fase:** 8

**Contexto:** "Observability Enterprise" pediu OpenTelemetry, Correlation/Request/Trace/Span ID, logs estruturados, Sentry preparado, e métricas preparadas para Prometheus/Grafana. Nenhuma conta real (Honeycomb, Grafana Cloud, Sentry, um Jaeger self-hosted) existe para este produto neste ambiente — a mesma situação da detecção de MCPs de design na Fase 4.5 ("nenhum conector detectado, documentado, não fingido").

**Decisão:** O SDK do OpenTelemetry roda de verdade (spans reais, `NodeSDK`, iniciado em `instrumentation.ts` via o hook oficial do Next.js, só no runtime Node), mas exporta para um `ConsoleSpanExporter` — spans aparecem no log do processo, provando o rastreamento ponta a ponta sem exigir conta em nenhum serviço externo. Trocar para um coletor real depois é uma linha (`OTLPTraceExporter`, já disponível como dependência transitiva), não uma migração. Sentry segue a mesma honestidade: `sentry.server.config.ts`/`sentry.edge.config.ts`/`instrumentation-client.ts` só chamam `Sentry.init` quando `NEXT_PUBLIC_SENTRY_DSN` existir — sem DSN, é um no-op completo, não um SDK "ligado" fingindo funcionar. O DSN usa o prefixo `NEXT_PUBLIC_` deliberadamente: ao contrário de um token de autenticação, um DSN do Sentry é seguro para expor no cliente por design, então uma única variável serve os três runtimes. `next.config.ts` não foi envolvido em `withSentryConfig` — isso ligaria o build a um `SENTRY_AUTH_TOKEN`/org/projeto para upload de source maps que também não existe aqui; a inicialização em runtime já cobre captura de erro e trace, e ligar o wrapper de build é uma mudança de uma linha no dia em que uma conta Sentry real existir.

Correlation ID/Request ID propagam via `AsyncLocalStorage` (`lib/observability/correlation.ts`) em vez de um parâmetro extra em toda assinatura de função — `withCorrelation` cria o contexto uma vez, todo `log.*`/span dentro dele herda o mesmo ID automaticamente. O logger estruturado (`lib/observability/logger.ts`) é escopado só aos módulos NOVOS desta fase (Event Bus, Queue Engine, Worker Engine, Chaos Engine) — não uma migração retroativa de todo `console.error` já existente no produto, que seria um diff enorme e desproporcional em fases já entregues e funcionando.

Duas métricas honestas em vez de uma inventada: o Mission Control pedia "traces ativos", mas um `ConsoleSpanExporter` só exporta spans já FINALIZADOS — não existe, sem um coletor real, um jeito honesto de saber quantas requisições estão "em voo" agora. Em vez de fingir esse número, `lib/observability/trace-metrics.ts` conta quantos spans **começaram** nos últimos ~2 minutos (buckets por minuto no Redis) — rotulado exatamente assim na UI, nunca como "ativo agora". O contador de conexões SSE (`lib/observability/sse-metrics.ts`) é o inverso: uma métrica genuinamente em tempo real (incrementada/decrementada no próprio ciclo de vida do `ReadableStream` de `/api/live/stream`), sem essa ressalva.

**Consequências:** Todo o Observability Engine funciona de ponta a ponta neste sandbox sem exigir nenhuma conta externa, e vira produção real trocando exportadores/DSN, não reescrevendo código. O custo: sem um coletor real, ninguém pode hoje consultar um trace específico por Trace ID fora do log do processo — a Fase 8 entrega a instrumentação, não um backend de observabilidade hospedado.

---

## ADR-035: Chaos Mode com duplo bloqueio de produção, e por que o custo em produção é zero

**Status:** Aceita · **Fase:** 8

**Contexto:** Um Chaos Mode que simula Redis fora do ar, fila travada, worker lento, timeout externo e falha de webhook só tem valor se for impossível de acionar em produção por engano — e só é aceitável no Resolution Engine (o caminho mais crítico de todo o produto) se o custo de checá-lo for zero quando desligado.

**Decisão:** Duas camadas independentes de bloqueio, nunca uma só: `isChaosActive`/`setChaosFlag` (`lib/chaos/flags.ts`) checam `NODE_ENV === "production"` a cada chamada e retornam `false`/no-op incondicionalmente lá, mesmo que a flag exista no Redis por engano; a rota que expõe o toggle (`/api/dev/chaos`) também se recusa a responder em produção, de forma redundante com a primeira camada. As duas únicas integrações reais são: `resolution-engine/cache.ts` (simula `redisDown`) e os processadores de fila (`maybeApplyChaos`, simula `workerSlow`/`timeout`/`webhookFailure`). No caminho crítico do Resolution Engine, o gate `process.env.NODE_ENV !== "production"` vem **antes** de qualquer leitura do Redis — em produção essa linha é uma comparação de string e nada mais, então o Chaos Mode custa exatamente zero no redirecionamento real; só em desenvolvimento ativo (testando o próprio Chaos Mode) essa checagem soma uma leitura extra ao Redis. `queueStalled` é checado dentro de `drain.ts` — interrompe a drenagem de jobs sem afetar o restante do processo.

**Consequências:** É possível provar ao vivo, na tela, que o produto degrada graciosamente (redirecionamento continua funcionando com "Redis fora do ar" ligado; um webhook falha e cai em dead-letter com "falha de webhook" ligado) — o tipo de demonstração que nenhuma alegação em texto substitui. O custo: as 5 simulações cobrem os módulos que a Fase 8 construiu, não infraestrutura mais ampla (não simula, por exemplo, o próprio Postgres fora do ar).

---

## ADR-036: API Pública v1 — autenticação por escopo, paginação por cursor, idempotência com replay de resposta, e um único envelope de erro

**Status:** Aceita · **Fase:** 9

**Contexto:** A Fase 9 pediu "uma API nível Stripe," não endpoints soltos — o que significa que autenticação, paginação, idempotência e formato de erro precisam ser um único contrato consistente em toda rota `/api/v1/**`, decidido uma vez, nunca reinventado rota a rota. Ao mesmo tempo, a API pública nunca poderia duplicar a lógica de negócio já madura das Fases 1-8 (validação, invalidação de cache, RBAC) — só expor um transporte novo sobre ela.

**Decisão:** Toda rota v1 é uma função fina que só sabe sua própria lógica, envolvida por `withApiV1` (`lib/api-v1/handler.ts`) — o único ponto que resolve autenticação, escopo, rate limit, idempotência, log de requisição e o envelope de erro. Cinco decisões de design sustentam isso:

1. **Autenticação por `ApiKey`, nunca por sessão.** Uma chave representa a empresa inteira (servidor-a-servidor), com `scopes` explícitos (`cards:read`, `campaigns:write`, etc. — ver `domain/api-v1/scopes.ts`) checados por `requireApiKey` antes de qualquer handler rodar. O valor completo (`nfc_live_...`) só existe no momento da criação; a partir daí só o hash SHA-256 é comparado (mesmo padrão Stripe/GitHub).
2. **Paginação por cursor, nunca offset** (`lib/api-v1/pagination.ts`) — `{ data, has_more, next_cursor }`. Listas que a camada de serviço interna não pagina (`campaigns`, `feedback`, `events`) consultam o Prisma diretamente na rota v1 em vez de forçar cursor pagination num contrato interno que nunca precisou dela — uma segunda consulta pequena e honesta, não uma reescrita do serviço existente.
3. **Idempotência com REPLAY de resposta** (`lib/api-v1/idempotency.ts`), não só deduplicação de efeito colateral como o `claimIdempotencyKey` de fila da Fase 8: a chave é reivindicada com um placeholder `PENDING` (`SET NX`) antes do handler rodar, fechando a janela de corrida de duas requisições concorrentes com a mesma `Idempotency-Key` (a segunda encontra `PENDING`, não `null`, e devolve 409 em vez de executar a mutação de novo); a resposta bem-sucedida fica guardada 24h e é devolvida literalmente idêntica numa repetição.
4. **Um único envelope de erro** (`lib/api-v1/errors.ts`): `{ error: { code, message, request_id } }`, nunca o formato solto `{ error: "texto" }` das rotas internas. `ForbiddenError` (a classe que os serviços internos lançam tanto para "não existe" quanto para "existe, mas não é desta empresa") vira 403 por padrão — mas `notFoundIfMissing()` traduz explicitamente para 404 nos handlers que fazem uma busca POR ID, porque um desenvolvedor terceiro precisa dessa distinção (um `GET /cards/:id` inexistente é 404, nunca 403), e um `ForbiddenError` de regra de negócio genuína (ex.: limite de plano em `createCard`) precisa continuar 403.
5. **Reaproveitar serviço interno mesmo quando ele exige RBAC completo** — `assignCampaign`/`unassignCampaign` pedem um `AuthContext` de usuário (papel, `accessScopes`). `buildSyntheticAuthContext` (`lib/api-v1/auth.ts`) constrói um contexto "sem restrição" (`role: "OWNER"`, `accessScopes: []`) a partir da `ApiKey`, já que uma chave de API nunca é um usuário restrito por unidade/zona — ela é a empresa. `organizationId` vem de uma consulta real, nunca fabricado, porque `assignCampaign` valida um alvo `ORGANIZATION` contra ele.

Uma nova permissão RBAC, `developers:manage` (`domain/rbac/roles.ts`), restrita a OWNER/ADMIN, controla quem no dashboard pode criar/revogar chaves e gerenciar webhooks — deliberadamente não reaproveitando `settings:write`, já que uma ApiKey alcança mais do que a maioria das configurações.

**Consequências:** Toda nova rota v1 herda automaticamente rate limit, log, idempotência e formato de erro corretos — o custo de errar isso é zero depois que `withApiV1` existe. O custo real: duas famílias de erro (`ForbiddenError` interno vs. o envelope v1) precisam ser traduzidas conscientemente em cada handler que busca um recurso por id — esquecer `notFoundIfMissing` num handler novo faria um "não encontrado" virar 403 em vez de 404 (uma DX pior, nunca uma falha de segurança, já que o dado real continua protegido pelo escopo da chave).

---

## ADR-037: Webhooks Enterprise substitui o par único `Company.webhookUrl`/`webhookSecret` por N `WebhookEndpoint`s, com nomes de evento público desacoplados dos internos

**Status:** Aceita · **Fase:** 9

**Contexto:** A Fase 8 implementou um único par `webhookUrl`/`webhookSecret` por empresa — suficiente para provar o Circuit Breaker e o dead-letter, mas incompatível com "Webhooks Enterprise": um desenvolvedor real quer múltiplos endpoints, cada um assinando só os eventos que lhe interessam (ex.: um endpoint de CRM só quer `feedback.received`, um endpoint de BI quer tudo). Ao mesmo tempo, os 10 eventos do Event Bus (Fase 8) têm nomes internos em português (`FeedbackRecebido`) — expô-los diretamente como o contrato público de webhook acoplaria para sempre o nome de um evento interno ao contrato que um cliente externo depende.

**Decisão:** `Company.webhookUrl`/`webhookSecret` foram removidos (nenhuma migração de dados necessária — sem `prisma/migrations/` ainda, mesma situação de toda fase anterior) e substituídos por `WebhookEndpoint` (N por empresa, cada um com sua própria `url`/`secret`/lista de `events`) e `WebhookDelivery` (histórico real, uma linha por tentativa). `domain/api-v1/webhook-events.ts`'s `PUBLIC_WEBHOOK_EVENT_MAP` traduz cada `DomainEventType` interno para um nome público estável em inglês (`FeedbackRecebido` → `"feedback.received"`) — `WebhookEndpoint.events` só guarda nomes públicos, nunca os internos. Dois dos 10 eventos (`ZonaAtualizada`/`MesaAtualizada`) mapeiam para `null` de propósito: ainda não são um contrato público desta fase, e um evento sem nome público nunca é entregue a nenhum endpoint, mesmo que a fila os roteie.

A entrega em si (`lib/webhooks/delivery.ts`) é a MESMA função usada pelo worker automático (`lib/workers/processors.ts`) e pelo replay manual do Dashboard de Desenvolvedor — nunca duas implementações que poderiam divergir sobre o que conta como sucesso. `WebhookDelivery` tem `@@unique([endpointId, eventId])`: quando um job de fila entrega para vários endpoints e SÓ UM falha, o retry do BullMQ reprocessa o job inteiro, mas o worker pula endpoints que a constraint já marca como `SUCCESS` — sem essa unicidade, um retry parcial duplicaria entregas bem-sucedidas. Cada endpoint tem seu próprio Circuit Breaker (`webhook:<endpointId>`, não `webhook:<companyId>`) — um endpoint ruim de um cliente nunca atrasa a entrega para outro endpoint da mesma empresa.

**Consequências:** Um cliente pode ter quantos endpoints quiser, cada um assinando só o que precisa — o modelo de dados certo para "webhooks enterprise" de verdade. O custo consciente: rotear `card.tapped`/`redirect.resolved` (os dois eventos de maior volume do produto — todo toque gera os dois) para a fila `webhooks` significa que uma empresa que assina esses dois eventos especificamente vai receber um volume alto de chamadas — um trade-off aceito porque o modelo de assinatura por evento é exatamente o mecanismo que evita isso ser forçado em quem não assina.

---

## ADR-038: SDK oficial (`@nfc-os/sdk`) é real e completo, mas não publicado no npm

**Status:** Aceita · **Fase:** 9

**Contexto:** "SDK JavaScript" e "SDK TypeScript" foram pedidos como algo que um desenvolvedor terceiro instala e usa fora deste produto — mas este ambiente não tem uma conta/organização npm nem um pipeline de CI de publicação configurado. Publicar um pacote aqui seria, na melhor das hipóteses, uma alegação que ninguém consegue verificar, e na pior, uma tentativa real de `npm publish` falhando silenciosamente ou publicando em um lugar errado.

**Decisão:** `packages/sdk` é um pacote real e completo — cliente HTTP tipado (`NFCOSClient`), erros tipados (`NFCOSApiError` com `.code`/`.requestId`/`.status`), autopaginação via `async function*`, suporte a `Idempotency-Key`, um recurso por área da API (`cards`, `campaigns` com açúcar `.activate()`/`.pause()`, `zones`, `branches`, `organizations`, `analytics`, `events`, `feedback`, `webhooks`) — mas marcado `"private": true` em seu `package.json`, nunca publicado. Zero dependência de runtime além de `fetch` nativo (funciona em Node 18+ e no navegador sem alteração), e zero import de qualquer coisa interna deste app (`@/...`) — fala só o contrato HTTP público, exatamente o que um consumidor de fora do monorepo teria. O Playground público em `/developers` importa este mesmo pacote via o alias `@nfc-os/sdk` (mesmo padrão de `packages/ui`, ver ADR-022) para os exemplos de código, e o README do pacote documenta com honestidade que publicar de verdade, quando uma conta npm existir, é uma mudança de configuração (`npm publish` + remover `"private"`), não uma reescrita.

**Consequências:** Todo o valor de engenharia de um SDK real (tipagem, DX, autopaginação, idempotência) existe e é testável hoje, dentro deste monorepo ou copiado para fora dele. O custo: ninguém pode rodar `npm install @nfc-os/sdk` ainda — a mesma classe de honestidade já usada para OpenTelemetry/Sentry (Fase 8) e detecção de MCPs (Fase 4.5): a capacidade existe no código, a distribuição real depende de uma conta que este ambiente não tem.

---

## ADR-039: Preparação para White Label (Fase 10) — o que já existe, o que falta, nada implementado ainda

**Status:** Aceita (preparação, não implementação) · **Fase:** 9

**Contexto:** A Fase 9 pediu explicitamente para deixar a arquitetura da Fase 10 (White Label: domínio customizado, favicon, login com marca própria) "praticamente plug-and-play," sem implementá-la agora. Antes de planejar qualquer coisa nova, uma auditoria do schema encontrou algo que merece registro sob Zero Dívida Silenciosa: `Company.domain String? @unique` já existe desde uma fase anterior — indexado, único, mas **sem nenhum código em todo o produto que o lê, escreve ou expõe numa UI**. Um campo de preparação genuíno, esquecido sem uso, não um bug, mas exatamente o tipo de coisa que ficaria como dívida silenciosa se não fosse documentado agora.

**Decisão:** Duas ações, ambas deliberadamente pequenas:

1. **Documentar o estado real de `Company.domain`** — existe, é único, não é lido em lugar nenhum. A Fase 10 é quem decide como usá-lo (provavelmente: `middleware.ts` resolve o `Host` header contra este campo para identificar a empresa antes de qualquer coisa de Clerk rodar, num domínio customizado apontando para este produto).
2. **Adicionar `Company.faviconUrl` (`String?`, nulo por padrão)** — mesmo padrão exato de `logoUrl` (nulo até a Fase 10 construir upload + um `<link rel="icon">` dinâmico que o lê). Uma coluna aditiva, sem leitor, sem escritor, sem UI — preparação no mesmo espírito do `domain` já existente, não uma feature nova sendo implementada às escondidas.

O que a Fase 10 vai encontrar pronto, sem precisar desenhar do zero:
- **Multi-tenancy por `companyId`** já é a fronteira de isolamento de toda consulta (desde a Fase 1) — um domínio customizado só precisa resolver para um `companyId`, nunca reestruturar como dados são particionados.
- **Branding parcial já existe:** `logoUrl`/`primaryColor` (usados no fluxo público de avaliação desde o MVP) e agora `faviconUrl`.
- **O padrão de resolução por host já tem um precedente arquitetural direto:** o próprio Resolution Engine (Fase 1) resolve um identificador opaco (`uniqueCode`) para uma `Company` via cache em camadas — resolver um `Host` header para uma `Company` via `domain` é a mesma forma de problema, podendo reaproveitar `cachedOrLoad`/o padrão de invalidação de cache já maduro em `lib/resolution-engine/cache.ts`, não inventar um novo.

O que a Fase 10 ainda vai precisar desenhar (fora do escopo desta preparação): verificação de propriedade de domínio (DNS TXT ou similar) e provisionamento de certificado SSL — nenhum dos dois tem um precedente neste produto, e ambos dependem de decisões de infraestrutura de hospedagem (Vercel Domains API ou equivalente) que só fazem sentido quando a Fase 10 realmente começar.

**Consequências:** A Fase 10 começa sabendo exatamente o que já existe (`domain`, `logoUrl`, `primaryColor`, `faviconUrl`) e o que precisa desenhar (resolução de host, verificação, SSL, branding de login) — sem precisar de uma auditoria de schema própria para descobrir um campo esquecido. O custo: dois campos adicionados nesta fase (`faviconUrl` novo, `domain` apenas documentado) continuam sem nenhum efeito observável até a Fase 10 escrever o código que os lê — um risco baixo e aceito, o mesmo padrão de toda coluna aditiva-e-nula deste produto.

---

## ADR-040: `BrandProvider` centraliza branding em runtime — mas só onde é novo; `AppSidebar` continua recebendo props como sempre recebeu

**Status:** Aceita · **Fase:** 10

**Contexto:** "Nada de cores espalhadas, tudo centralizado" pede um único ponto de verdade para logo/cores em runtime. Ao mesmo tempo, `AppSidebar` (Fase 4.5) já funciona recebendo `logoUrl` por prop, e reescrevê-lo para consumir um contexto novo só para "ficar mais limpo" seria tocar código estável sem uma razão técnica — exatamente o tipo de reescrita que a regra permanente deste projeto proíbe.

**Decisão:** `BrandProvider`/`useBrand()` (`components/white-label/brand-provider.tsx`) é o único ponto de verdade para todo consumidor NOVO de branding — variáveis CSS (`--brand-primary`, `--brand-secondary`, `--brand-hover`, `--brand-pressed`, `--brand-on-primary`) calculadas uma vez via `buildBrandColorSet` (`domain/white-label/color.ts`) e aplicadas via um `<div style={...} className="contents">` (zero impacto de layout, zero flicker — recebe o `BrandConfig` já resolvido no servidor, nunca busca de novo no cliente). Usado em exatamente dois lugares nesta fase: o layout do dashboard (marca da própria empresa autenticada) e as telas de login/cadastro (marca resolvida por `Host`). `AppSidebar` e qualquer outro componente já estável continuam recebendo `logoUrl`/cores por prop exatamente como antes — migrá-los para `useBrand()` é uma limpeza de baixo risco para uma fase futura, não uma reescrita justificada agora.

Uma segunda decisão, de permissão: branding (`Company.logoUrl`/`primaryColor`/`secondaryColor`/`faviconUrl`/`loginHeadline`/`loginBackgroundUrl`/`domain`) continua atrás de `settings:write` — a MESMA permissão que já protegia editar logo/cor em Configurações, não uma nova. Diferente da API Pública (Fase 9, `developers:manage`): uma `ApiKey` alcança qualquer dado dentro de seus escopos em toda a empresa, um risco qualitativamente maior que "trocar a cor do dashboard," que nunca expõe nem altera dado de cliente.

**Consequências:** Todo consumidor novo de marca (Theme Studio, telas de login, Brand Motion System) lê de um único lugar, nunca recalcula sua própria fórmula de cor. O custo: `AppSidebar` e outros componentes antigos continuam com duas fontes de verdade coexistindo (prop direta vs. `useBrand()`) até uma limpeza futura — documentado aqui para não ser esquecido, não escondido.

---

## ADR-041: Tela de login com marca própria nunca duplica autenticação — só estiliza a moldura do Clerk

**Status:** Aceita · **Fase:** 10

**Contexto:** "Login com marca própria... mantendo a segurança do Clerk, nunca duplicar autenticação" é uma restrição explícita. Construir um formulário de login próprio (mesmo que só visualmente diferente) reintroduziria toda a superfície de risco que usar o Clerk deveria eliminar — senha em trânsito por código deste produto, gestão de sessão própria, etc.

**Decisão:** `BrandedAuthScreen` (`components/white-label/branded-auth-screen.tsx`) é puramente decorativo: fundo, logo e mensagem ao redor do componente `<SignIn>`/`<SignUp>` do Clerk, que continua sendo o único responsável por autenticar. A única customização real do Clerk em si é `appearance.variables.colorPrimary`, a API oficial e documentada do próprio Clerk para isso — nunca um CSS override por fora ou uma tentativa de recriar o formulário. `clerkAppearanceFor(brand)` devolve `undefined` quando não há marca própria resolvida, deixando o Clerk usar o tema padrão do NFC OS sem nenhuma customização extra.

**Consequências:** Toda a superfície de segurança de autenticação (senha, MFA, sessão, tokens) continua 100% dentro do Clerk, inalterada — White Label nesta tela é inteiramente cosmético. O custo: a customização visual do formulário do Clerk em si fica limitada ao que a API `appearance` do Clerk expõe (hoje, a cor de destaque) — não há como, por exemplo, mudar o layout interno dos campos do Clerk sem entrar em território de sobrescrever componentes internos dele, o que não foi feito.

---

## ADR-042: `DomainResolver` roda nas páginas de login, nunca no middleware — Edge Runtime não sustenta o Prisma, descoberto batendo de frente com o build

**Status:** Aceita · **Fase:** 10

**Contexto:** O pedido original desenhava um `DomainResolver` chamado do middleware, "antes do resto do sistema carregar." A primeira implementação seguiu exatamente isso — e o build de produção falhou de verdade (`UnhandledSchemeError` tentando importar `node:crypto`/`node:fs`/`node:path` através do cliente do Prisma), porque o Middleware deste Next.js roda exclusivamente no runtime Edge, que não tem as APIs de Node que o Prisma exige. Este não é um limite hipotético listado por precaução — é um erro real de build, corrigido antes de seguir em frente (ver Achados do Architect Review em `RELATORIO_FASE_10.md`).

**Decisão:** `resolveBrandByHost` (`lib/white-label/resolve-brand.ts`) é chamado diretamente de dentro das páginas `/sign-in` e `/sign-up` (Server Components normais, runtime Node, lendo o próprio `Host` via `headers()`) — nunca do `middleware.ts`, que voltou a fazer só o que já fazia (proteção de rota via Clerk). O resolvedor classifica o `Host` em três categorias (`domain/white-label/host.ts`): domínio raiz do produto (sem marca própria), subdomínio `{slug}.{domínio-raiz}` (resolve por `Company.slug`, sempre disponível, zero configuração), ou domínio customizado (resolve por `Company.domain`, e SÓ quando `domainVerifiedAt` está preenchido — nunca um domínio reivindicado mas não comprovado). Cacheado por Host (`cachedOrLoad`, TTL de 120s, reaproveitando o helper genérico do Resolution Engine da Fase 1) — a mesma garantia de latência O(1) por lookup independente do número de tenants que o próprio Resolution Engine já prova em produção, a resposta direta ao Franchise First Review: 1, 50, 500 ou 5.000 empresas fazem exatamente a mesma consulta indexada por `slug`/`domain`, nunca uma varredura.

Branding permanece por `Company`, não por `Organization` — uma decisão deliberada, não uma limitação esquecida: nada nesta fase foi pedido explicitamente sobre uma franquia de 500 unidades precisar compartilhar UMA marca entre múltiplas empresas (`Company` rows). Se esse precisar existir no futuro, o caminho natural é a API Pública (Fase 9): configurar a mesma marca em N empresas via `PATCH /api/v1/organizations` num script, ou uma futura herança de marca ao nível de `Organization` — nenhum dos dois construído agora, porque nenhum foi pedido.

**Consequências:** O produto tem um `DomainResolver` real, cacheável, e que escala por construção — mas ele mora onde o Next.js permite rodar Prisma, não onde o pedido original presumia. O custo: branding pré-autenticação só aparece nas duas telas que realmente precisam dele (login/cadastro); qualquer outra página pública futura que queira o mesmo precisa chamar `resolveBrandByHost` diretamente também, nunca esperar um header que o middleware não pode mais fornecer.

---

## ADR-043: Assets Inteligentes via rotas dinâmicas (`/api/brand/*`), não a convenção de arquivo `icon.tsx`/`opengraph-image.tsx` do Next.js

**Status:** Aceita · **Fase:** 10

**Contexto:** O Next.js tem uma convenção de arquivo oficial para favicon/OG dinâmicos (`app/icon.tsx`, `app/opengraph-image.tsx`) usando `ImageResponse` (`next/og`). Ela é a forma "canônica" documentada, mas neste ambiente não foi possível confirmar com certeza que esses arquivos especiais suportam leitura de `Host` por requisição (alguns metadata routes em versões passadas do Next.js foram tratados como estáticos/gerados uma vez) sem um teste real contra dois domínios diferentes de verdade — algo que este sandbox não tem como fazer.

**Decisão:** Em vez de assumir, `/api/brand/icon`, `/api/brand/og` e `/api/brand/manifest` são Route Handlers explícitos (`runtime="nodejs"` nos dois primeiros, que usam `ImageResponse`) — comportamento por-requisição garantido, porque é exatamente assim que todo outro Route Handler deste produto já funciona, sem nenhuma ambiguidade de convenção especial. `metadata.icons`/`openGraph.images`/`manifest` no layout raiz apontam para essas URLs fixas; a lógica de "qual empresa" vive inteiramente dentro de cada rota, lendo `Host` a cada chamada. O favicon estático (`src/app/favicon.ico`) foi removido de propósito (arquivado em `.archive/`, não perdido) — mantê-lo ao lado de um `<link rel="icon">` dinâmico arriscaria o navegador preferir o arquivo estático genérico em alguns cenários, e um `<link>` explícito tem prioridade sobre a convenção implícita `/favicon.ico` em todo navegador moderno. Sem `faviconUrl`/`logoUrl` configurados, o ícone/OG geram um distintivo com a inicial do nome da empresa sobre a cor de marca — nunca um ícone genérico sem identidade, mesmo antes de a empresa subir um arquivo.

**Consequências:** Favicon/OG/manifest funcionam corretamente por Host hoje, comprovado (build de produção limpo, as três rotas aparecem no manifesto de rotas). O custo: se o Next.js confirmar no futuro que a convenção de arquivo suporta o mesmo comportamento dinâmico, migrar para ela é possível, mas não obrigatório — a abordagem atual já entrega o resultado pedido sem essa dependência de uma convenção não totalmente verificável aqui.

---

## ADR-044: QR/Impressão White Label — contraste seguro sempre garantido, sem canvas/`sharp`, mockups físicos em 2D ilustrado (nunca 3D)

**Status:** Aceita · **Fase:** 10

**Contexto:** "QR Code White Label" pediu cores da marca com "contraste seguro," e "NFC White Label" pediu mockups para mesa/balcão/vitrine/porta/quarto/cartão PVC que o cliente visualiza "antes de imprimir." Nenhuma biblioteca de imagem (`sharp`, `canvas`) está instalada neste produto — adicionar uma para compor logo+QR em um único PNG seria uma dependência nativa nova só para este recurso.

**Decisão:** `ensureScannableDark` (`domain/white-label/color.ts`) escurece progressivamente a cor da marca até atingir contraste ≥ 7:1 contra branco (mais rígido que o AA de texto, porque um leitor de QR é mais sensível a contraste do que um olho humano) — nunca aceita a cor pedida sem checar, nunca inventa uma cor sem relação com a marca original. Os PDFs de impressão (`services/export/print-asset-pdf.tsx`, 5 formatos com dimensões físicas reais — CR80 para o cartão PVC, por exemplo) usam `@react-pdf/renderer` puro, sem canvas: `<Image src={logoUrl}>` busca a URL remota do logo nativamente (react-pdf resolve URLs http(s) sozinho), e o QR entra como uma segunda `<Image>` com sua própria cor — a mesma filosofia "sem infraestrutura exótica" do ADR-025/ADR-031, agora aplicada a impressão.

Os mockups do Theme Studio (mesa/balcão/vitrine/porta/quarto/cartão) são ilustrações 2D em CSS (gradientes, formas, sombras) compondo o QR/logo REAIS sobre uma superfície estilizada — deliberadamente NUNCA renders 3D fotorrealistas. Um render 3D de verdade exigiria um motor de renderização (Three.js client-side, ou um serviço de renderização de imagem no servidor) — infraestrutura desproporcional ao pedido real ("consegue visualizar antes de imprimir"), que uma ilustração 2D honesta já satisfaz.

**Consequências:** QR codes com a cor da marca nunca saem ilegíveis por escolha de cor, e os PDFs de impressão saem no tamanho físico correto, prontos para uma gráfica de verdade. O custo: os mockups físicos são ilustrações estilizadas, não fotos realistas de uma mesa/porta/quarto de verdade — suficiente para o empresário confirmar "isso combina com a minha marca," não para substituir uma prova física impressa antes de um pedido grande.

---

## ADR-045: Primeiro CSP do produto, em modo `report-only` — e HSTS real, sem `preload` (que exige um passo manual de produção)

**Status:** Aceita · **Fase:** 10

**Contexto:** A checklist de segurança da Fase 10 pediu verificar CSP e "HSTS preparação." Uma auditoria real (não presumida) confirmou que este produto nunca teve nenhum Content-Security-Policy em nenhuma fase anterior — um achado sob Zero Dívida Silenciosa, documentado aqui. White Label piora o motivo de precisar de um: `logoUrl`/`faviconUrl`/`loginBackgroundUrl` são URLs que cada empresa escolhe livremente, renderizadas via `<img>`/`background-image` em telas públicas (login) — exatamente o tipo de entrada de terceiro que um CSP existe para conter.

**Decisão:** O CSP nativo do Clerk (`clerkMiddleware`'s opção `contentSecurityPolicy`) foi ligado em `reportOnly: true` — o navegador reporta violações sem bloquear nada. Deliberadamente não-bloqueante nesta fase: introduzir um CSP pela primeira vez, numa aplicação deste tamanho, sem conseguir testar contra um navegador real rodando cada tela existente neste sandbox, arriscaria quebrar algo imprevisível em produção sem aviso — o padrão seguro e amplamente recomendado de introduzir CSP é sempre relatório antes de bloqueio. `img-src` inclui `https:` amplamente (não um allowlist de domínios específicos, já que cada empresa escolhe sua própria URL de logo/favicon/fundo de login). HSTS (`Strict-Transport-Security`, `max-age` de 2 anos + `includeSubDomains`) foi ligado de verdade via `next.config.ts`, sem o flag `preload` — `preload` exige submissão manual a hstspreload.org contra o domínio real de produção, um passo que só faz sentido fora deste sandbox.

**Consequências:** O produto ganha visibilidade real sobre violações de CSP (via o relatório do navegador) sem risco de quebrar nada em produção agora, e HSTS funcionando de verdade sobre HTTPS. O custo: o CSP ainda não bloqueia nada — a próxima fase que tocar segurança deve revisar os relatórios de violação de um ambiente de produção real e decidir quando apertar para bloqueante, um passo que exige dados reais, não algo que se decide no código sozinho.

---

## ADR-046: Preparação (não implementação) para as Fases 11, 12 e 13

**Status:** Aceita (preparação) · **Fase:** 10

**Contexto:** A Fase 10 pediu para deixar a arquitetura pronta para a Fase 11 (Smart Campaign Playbooks, "pensando em IA futura... um AI Campaign Copilot posteriormente") e a Fase 12 (ambiente de demonstração parecendo produção), sem implementar nenhuma das duas, e para registrar uma Fase 13 futura (AI Copilot & Marketplace OS) sem projetá-la.

**Decisão — Fase 11 (Smart Campaign Playbooks / futuro AI Copilot):** nenhum código de IA foi escrito, por instrução explícita. A auditoria arquitetural relevante é o que já existe e por que já serve: os Insights Automáticos (Fase 7, `domain/analytics/insights.ts`) já produzem objetos estruturados com evidência numérica anexada — exatamente a forma de dado que um futuro "AI Campaign Copilot" consumiria como contexto, sem precisar de acesso direto ao banco. A API Pública v1 + SDK (Fase 9) já expõem `analytics/kpis`, `analytics/rankings`, `events`, e `campaigns` (leitura E escrita, incluindo `campaigns.activate()`) — o conjunto exato de operações que um agente precisaria para "ler o estado do negócio" e "agir criando/ativando uma campanha," pela mesma superfície que qualquer integração externa usa, nunca um caminho especial. Ou seja: a Fase 11 pode nascer como um consumidor da API v1 (interno ou externo), não como uma reescrita de acesso a dados — a preparação real já aconteceu nas Fases 7 e 9, esta fase só reconhece isso.

**Decisão — Fase 12 (Demo Environment como produção):** nenhum ambiente `/demo/*` novo foi construído. A preparação real: a empresa de demonstração "Bella Vista" (seed) agora é uma candidata natural a também ganhar sua própria configuração de White Label (subdomínio, cores, favicon) quando a Fase 12 desenhar o ambiente completo — o Theme Studio e o `DomainResolver` desta fase já funcionam para qualquer `Company`, incluindo a de demonstração, sem nenhum código adicional.

**Decisão — Fase 13 (registro apenas):** adicionada ao `ROADMAP.md` como fase futura, não projetada: AI Campaign Copilot, Marketplace, Plugins, Integrações, Agentes especializados, Automações inteligentes — a continuação natural do que a Fase 9.5 (Marketplace & Integrações, registrada na Fase 9) já apontava, agora com o componente de IA explicitamente nomeado.

**Consequências:** Nenhuma linha de código de IA existe neste produto ainda — nada foi implementado sob o pretexto de "preparação." O que existe é a confirmação, por auditoria, de que a arquitetura já construída (Analytics estruturado + API pública com escopos de escrita) é o alicerce correto para essas fases nascerem sem uma reescrita, quando forem explicitamente aprovadas.

---

## ADR-047: Branding White Label calcula cor de forma agnóstica a tema — mas nenhuma tela escura foi construída ou verificada, porque o produto inteiro nunca teve dark mode ligado

**Status:** Aceita (achado + limite honesto) · **Fase:** 10

**Contexto:** O pedido original da Fase 10 incluiu "temas claro e escuro" na identidade completa por empresa. Uma auditoria real (Zero Dívida Silenciosa) encontrou que este produto **nunca teve dark mode de verdade ligado em nenhuma fase**: `globals.css` tem um bloco `.dark { ... }` completo desde a Fase 4.5 (ADR-023, quando a cor de marca violeta-índigo foi definida tanto para claro quanto para escuro), mas `src/app/layout.tsx` sempre envolveu o produto em `<ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>` — a classe `.dark` nunca é aplicada ao `<html>`, em nenhuma tela, desde antes desta fase existir. Não é uma regressão da Fase 10; é uma condição pré-existente que esta fase encontrou ao tentar cumprir literalmente "temas claro e escuro."

**Decisão:** O `BrandProvider`/`buildBrandColorSet` (`domain/white-label/color.ts`) calculam as variáveis CSS de marca (`--brand-primary`, `--brand-secondary`, `--brand-hover`, `--brand-pressed`, `--brand-on-primary`) a partir do hex bruto salvo em `Company` — nunca dependem do token `.dark`/claro do design system, então tecnicamente já funcionariam sob um tema escuro se um dia ele for religado (o cálculo de contraste/legibilidade é absoluto, não relativo a um tema). Mas nenhuma tela escura de fato foi construída, testada ou aparece no Theme Studio: construir e validar visualmente uma variante escura de login/dashboard para um dark mode que não existe em nenhuma outra tela do produto seria trabalho cosmético isolado, não uma entrega coerente — e ligar dark mode de verdade no produto inteiro (parte de "identidade" desta fase) é uma mudança transversal (cada componente, cada tela, revisão de contraste em todo o `packages/ui`) do tamanho de uma fase própria, nunca pedida explicitamente como tal.

**Consequências:** A Fase 10 entrega branding completo sob o único tema que o produto realmente usa hoje (claro) — honesto e verificado. O custo: a frase original "temas claro e escuro" não foi cumprida integralmente; fica registrado aqui, no relatório da fase e nos riscos carregados adiante, para não virar uma alegação silenciosa. Se dark mode real for aprovado como seu próprio esforço no futuro, o cálculo de cor de marca desta fase já está pronto para ele sem retrabalho — só falta o produto ligá-lo.

---

## ADR-048: Playbooks são um catálogo GLOBAL e declarativo, sobre um vocabulário FIXO de 7 gatilhos e 4 ações — nunca uma linha de código nova por playbook

**Status:** Aceita · **Fase:** 11

**Contexto:** O pedido pediu uma "Biblioteca de Playbooks Inteligentes" com 7 exemplos nomeados (Happy Hour Boost, Google Review Recovery, Instagram Momentum, VIP Table Recovery, Silent Zone Rescue, Lunch Rush Optimization, Weekend Accelerator), com a exigência explícita "nunca hardcode, tudo declarativo." Ao mesmo tempo, cada playbook precisa de uma lógica de avaliação genuinamente diferente (comparar hora do dia, comparar janelas de tempo, medir ociosidade) — o risco óbvio era construir 7 funções especiais, uma por nome de playbook, o oposto do que "declarativo" pede.

**Decisão:** Dois enums fecham o vocabulário: `PlaybookTriggerType` (7 valores: `ZONE_TIME_PERFORMANCE`, `RATING_DROP`, `SOCIAL_MOMENTUM`, `VIP_TABLE_IDLE`, `ZONE_SILENT`, `LUNCH_WINDOW_UNDERUSED`, `WEEKEND_FORECAST_UP`) e `PlaybookActionType` (4 valores: `ASSIGN_CAMPAIGN_TO_SCOPE`, `CREATE_AND_ASSIGN_CAMPAIGN`, `BOOST_CAMPAIGN_PRIORITY`, `PAUSE_CAMPAIGN`). Cada `PlaybookTriggerType` tem exatamente UMA função avaliadora pura em `domain/playbooks/triggers.ts` (mesmo padrão de `RuleType`/`ruleConfigSchemaFor` do Rule Engine, Fase 3) — o que diferencia "Happy Hour Boost" de "Lunch Rush Optimization" (ambos usam gatilhos de janela de horário) é só o `triggerConfig` (JSON: `windowStartHour`/`windowEndHour`/`minSampleSize`/`minDeltaPercent`) e o `actionConfig` (JSON: tipo de campanha, modelo de mensagem, regra de tempo a anexar) de cada linha de `Playbook` — dados, semeados uma vez (`prisma/seed.ts`), nunca código. Um playbook novo dentro do vocabulário existente (ex.: "Terça de Massas") nasce como uma linha de `INSERT`, nunca um deploy.

`Playbook` é um catálogo GLOBAL (sem `companyId`), não por empresa — a "biblioteca" pedida é uma coleção compartilhada de receitas, o mesmo conceito de um template, não uma configuração por tenant (que `PlaybookRecommendation.companyId` já resolve, por instância gerada). `CREATE_AND_ASSIGN_CAMPAIGN` só constrói campanhas dos tipos `WHATSAPP`/`GOOGLE_REVIEWS` — os DOIS únicos tipos cujo dado de configuração (`Company.whatsapp`/`Company.googleReviewUrl`) é garantido existir (campos obrigatórios desde a Fase 1), nunca uma URL de Instagram/cardápio inventada; `BOOST_CAMPAIGN_PRIORITY`/`PAUSE_CAMPAIGN` só agem sobre uma campanha que o próprio gatilho encontrou de verdade (`TriggerFireResult.targetCampaignId`), nunca uma suposta.

**Consequências:** Adicionar um oitavo playbook amanhã, dentro do vocabulário existente, é uma linha de seed — zero código novo. O custo real e aceito: um playbook que precise de um `PlaybookTriggerType`/`PlaybookActionType` genuinamente novo (não coberto pelos 7+4 atuais) exige código novo em `domain/playbooks/triggers.ts`/`execution-engine.service.ts`, exatamente como um `RuleType` novo exigiria hoje — "declarativo" aqui significa "sem código por INSTÂNCIA", não "sem código para sempre, para qualquer gatilho imaginável".

---

## ADR-049: AutoPilot Seguro — dois portões fixos (confiança ≥75% + teto diário) protegem qualquer nível que aja sozinho, nunca um "ligado/desligado" simples

**Status:** Aceita · **Fase:** 11

**Contexto:** A Autonomy Review desta fase exige responder, para toda automação: o sistema age sozinho? o usuário entende por quê? existe Undo? existe limite de segurança? existe log completo? O pedido descreve 4 níveis (Manual/Recomendado/Semi-automático/Automático) e, para o Automático, apenas "executar playbooks seguros; registrar tudo; permitir rollback" — sem definir o que torna um playbook "seguro" nem que limite protege contra um AutoPilot mal calibrado recomendando (e executando) demais.

**Decisão:** Duas travas, nunca uma só: (1) `Playbook.safeForAutomation` (boolean, dado — hoje `true` para Happy Hour Boost/Instagram Momentum/Silent Zone Rescue/Lunch Rush Optimization/Weekend Accelerator; `false` para Google Review Recovery/VIP Table Recovery, que mexem com reputação/relacionamento e pedem julgamento humano); (2) confiança mínima de 0.75 (`MIN_CONFIDENCE_FOR_AUTOMATION`, `automation-engine.service.ts`) — mais alta que qualquer limiar usado só para EXIBIR uma recomendação. As duas precisam ser verdadeiras antes de qualquer auto-execução, em qualquer nível. Um terceiro limite, temporal: no máximo 5 auto-execuções por empresa por dia (`MAX_AUTO_EXECUTIONS_PER_DAY`) — ultrapassado isso, a recomendação fica `PENDING` para aprovação manual, nunca descartada.

O nível Semi-automático nunca executa na hora — agenda com uma janela de 15 minutos (`SEMI_AUTOMATIC_DELAY_MS`) antes de rodar de verdade, sempre visível e cancelável na tela (mesmo mecanismo de "executar depois" do Scheduler Inteligente) — a resposta literal a "nunca executar silenciosamente" para o nível que ainda não é totalmente automático. O nível Automático executa na hora, mas SEMPRE com `triggeredBy="AUTOPILOT"` gravado (nunca ambíguo com uma ação humana), o mesmo evento `PlaybookExecutado` no Event Bus de uma execução manual, e a mesma `undoExecution` disponível depois — a autonomia real do nível mais alto é aceita explicitamente pelo pedido ("executar sozinho... permitir rollback"), não suavizada aqui, mas cercada pelas duas travas acima.

**Consequências:** Nenhum playbook de julgamento reputacional (Google Review Recovery, VIP Table Recovery) jamais executa sozinho, em nenhum nível — `safeForAutomation=false` é permanente até uma decisão humana futura mudar isso no catálogo. O custo: o teto de 5/dia é um número escolhido, não derivado de dado real de produção (não existe histórico de "quantas auto-execuções são seguras por dia" ainda) — documentado como um ponto de partida conservador, ajustável quando houver uso real para calibrar contra.

---

## ADR-050: A fila "playbooks" só escuta eventos de comportamento real do cliente — nunca um evento que a própria execução de playbook produz

**Status:** Aceita · **Fase:** 11

**Contexto:** O Architect Review desta fase pediu, explicitamente, caçar "loops infinitos de automação" antes da entrega — um risco real e não hipotético neste desenho: aplicar um playbook cria/atualiza uma `Campaign` e uma `CampaignAssignment`, e essas ações JÁ publicam `CampanhaCriada`/`CampanhaAtualizada` no Event Bus (Fase 8). Se a avaliação de gatilhos escutasse esses mesmos eventos, aplicar "Happy Hour Boost" poderia reavaliar gatilhos, potencialmente gerar OUTRA recomendação sobre a campanha recém-criada, cuja aplicação geraria mais um evento — um loop que nunca se prova impossível só lendo o código com calma, precisa ser impedido estruturalmente.

**Decisão:** A nova fila `"playbooks"` (Queue Engine, Fase 8) está inscrita, em `lib/event-bus/subscriptions.ts`, SÓ nos três eventos que refletem uma ação de um CLIENTE de verdade — `RedirecionamentoResolvido` (um toque), `FeedbackRecebido`, `AvaliacaoPublicada` — nunca em `CampanhaCriada`/`CampanhaAtualizada`/`CampanhaEncerrada`, os únicos três eventos que uma execução de playbook pode ela mesma produzir. Os três eventos de SAÍDA do próprio motor de playbooks (`RecomendacaoGerada`/`PlaybookExecutado`/`PlaybookDesfeito`) alimentam só a fila `"analytics"` (auditoria/histórico), nunca `"playbooks"` — a própria definição estrutural de "nenhuma saída deste motor pode virar uma entrada dele mesmo". Uma segunda proteção, independente: `createRecommendationIfNotConflicting` (`playbook-engine.service.ts`) nunca cria uma nova recomendação para um escopo (zona/mesa/empresa) que já tem uma `PENDING` ou uma `APPLIED` dentro da janela de duração do playbook que a aplicou — de QUALQUER playbook, não só o mesmo, fechando também o caso de "dois playbooks disputando a mesma mesa" (Architect Review, "playbooks conflitantes"). Uma terceira: `BOOST_CAMPAIGN_PRIORITY`/`PAUSE_CAMPAIGN` nunca podem ser agendados como "repetir" (`REPEATABLE_ACTION_TYPES` só inclui as duas ações idempotentes de atribuição/criação) — repetir um aumento de prioridade indefinidamente seria, por si só, um loop de crescimento sem limite.

**Consequências:** Uma reavaliação de gatilhos só pode ser causada por um evento que se origina fora do sistema de playbooks — nunca por sua própria ação. O custo: gatilhos de AUSÊNCIA de comportamento (`ZONE_SILENT`/`VIP_TABLE_IDLE`) não têm nenhum evento para reagir por definição (silêncio não publica nada) — cobertos pela varredura periódica de `/api/playbooks/evaluate` (Cron, a cada 15 min) em vez do Event Bus, um complemento deliberado, não uma falha do desenho orientado a evento.

---

## ADR-051: O Command Center ganha sua ÚNICA rota de escrita — uma exceção estreita e documentada a ADR-027, não uma violação silenciosa dele

**Status:** Aceita · **Fase:** 11

**Contexto:** ADR-027 (Fase 6) decidiu, explicitamente: "O Command Center nunca ganha rotas de escrita própria." O pedido desta fase, porém, pede uma coluna "Próximas melhores ações" no Command Center "com botão de execução imediata" — e o roteiro do Demo Premium (item 10) tem como momento central "o playbook é aplicado... KPIs reagem", que não existe sem uma aplicação de verdade. As duas decisões, lidas juntas, colidem de verdade — não dava para simplesmente honrar as duas ao pé da letra.

**Decisão:** Em vez de silenciosamente contrariar ADR-027, ele é ampliado de forma estreita e nomeada: `/api/dev/demo/playbooks/[id]/apply` é a ÚNICA rota de escrita que `/dev/ceo` já teve. Protegida pelas mesmas três camadas que toda a árvore `/dev/ceo` já usa desde a Fase 2/6 (nunca um gate novo, criado só para isto): `NODE_ENV === "production"` → 404 (o mesmo gate que já torna esta árvore inexistente em qualquer build de produção real, inclusive previews do Vercel, já que `next build` roda com `NODE_ENV=production`); a empresa é sempre a fixa do seed (`getDemoCompany()`, nunca aceita de fora, mesmo padrão de todo `/api/dev/demo/*`); e a ação é 100% reversível pela MESMA `undoExecution` de uma execução manual do dashboard real, chamada pela mesma rota `/api/playbooks/executions/:id/undo`. `canEditLayout`/`canAssign` do Mapa de Mesas embutido continuam `false` — a exceção é cirúrgica (só aplicar um Playbook), não uma reabertura geral de escrita no Command Center.

**Consequências:** O roteiro de demonstração (insight → playbook → Preview Inteligente → aplicar → KPIs reagem) existe de verdade, sem fingir uma aplicação que não aconteceu. O custo, aceito e registrado: `/dev/ceo` deixa de ser 100% somente-leitura pela primeira vez desde a Fase 6 — mitigado pelas três camadas de proteção idênticas ao resto da árvore, nunca um risco novo introduzido, só uma superfície nova sob o mesmo risco já confiado.

---

## ADR-052: Dev Runtime — um bypass de autenticação permanente e explícito, nunca a heurística "keyless" interna do Clerk

**Status:** Aceita · **Fase:** 12

**Contexto:** Da Fase 9 à Fase 11, toda verificação interativa dependeu de um harness descartável: esvaziar o `matcher` de `middleware.ts` e remover `<ClerkProvider>` de `layout.tsx` à mão, sempre restaurado depois. A regra permanente "Self-Healing Development" desta fase pede eliminar isso de vez. Uma investigação real do `@clerk/nextjs@7.9.1` instalado (leitura direta do código-fonte da dependência, não suposição) encontrou que o Clerk já tem um modo "keyless" para desenvolvimento — mas ele decide sozinho, por uma heurística interna (`isDevelopmentEnvironment() && !isAutomatedEnvironment()`), se deve ativá-lo, e essa heurística não é controlável nem auditável por este projeto.

**Decisão:** Uma variável de ambiente própria e explícita, `DEV_RUNTIME=1` (nunca automática, nunca inferida), com um único ponto de decisão: `isDevRuntimeEnabled()` (`lib/dev-runtime/config.ts`), checado em exatamente três lugares, todos PERMANENTES (nunca mais editados a cada fase): (1) `getAuthContext()` (`lib/auth.ts`) nunca chama `auth()` do Clerk nesse modo — resolve direto para um `User` REAL já semeado (`getDevRuntimeAuthContext`, `lib/dev-runtime/auth.ts`), nunca um objeto fabricado, preservando RBAC/escopo genuínos; (2) `middleware.ts` exporta um passthrough (`NextResponse.next()`) em vez de `clerkMiddleware(...)`, decidido uma vez no carregamento do módulo; (3) `layout.tsx` renderiza os filhos sem `<ClerkProvider>`. Os dois portões de segurança de sempre continuam: `NODE_ENV !== "production"` (nunca ativável numa build real) e a variável precisa ser ligada explicitamente. Verificado contra um erro de build/runtime real, não hipotético: com o Dev Runtime ativo, `/dashboard` parou de lançar o erro do Clerk e passou a falhar exatamente no próximo limite genuíno do sandbox (conexão Postgres — `SASL: SCRAM-SERVER-FIRST-MESSAGE`), confirmado pelo stack trace mostrando `getDevRuntimeAuthContext → prisma.user.findFirst`, nunca o Clerk.

**Consequências:** Nenhuma fase futura precisa editar `middleware.ts`/`layout.tsx` para testar interativamente — a partir de agora, `DEV_RUNTIME=1` no `.env.local` é suficiente, e os dois arquivos nunca mais carregam um comentário "TEMP". O custo: o Dev Runtime resolve o problema de AUTENTICAÇÃO, não o de INFRAESTRUTURA — sem um Postgres/Redis reais configurados (a limitação deste sandbox específico, não deste mecanismo), páginas que dependem deles continuam falhando nesse ponto, honestamente, exatamente como sempre falharam. Ver ADR-054 para por que isso não foi resolvido com um banco embarcado.

---

## ADR-053: Scenario Engine — cada cenário do Demo OS é uma sequência de ações reais contra os motores existentes, nunca um estado de UI fabricado

**Status:** Aceita · **Fase:** 12

**Contexto:** "Zero Fake Demo" exige que nenhuma tela finja dados — os dados de demonstração precisam nascer dos mesmos motores reais do produto. Ao mesmo tempo, o Demo OS pede 7 cenários nomeados ("Happy Hour", "Restaurante lotado" etc.) que precisam ligar vários sistemas ao mesmo tempo, de forma repetível, sob demanda — o oposto de "esperar tráfego real acontecer".

**Decisão:** `services/scenario-engine.service.ts` implementa cada cenário como uma função que executa AÇÕES REAIS: cria linhas genuínas de `RedirectLog`/`Visit`/`RatingEvent` (com `createdAt = agora`, para a Live Mode SSE já existente — Fase 6 — perceber e propagar sozinha, sem nenhum caminho de renderização paralelo), publica eventos genuínos no Event Bus (`publishEvent`, Fase 8), e chama funções de serviço reais (`evaluatePlaybooksForCompany` da Fase 11, `setChaosFlag` da Fase 8, `setAutoPilotLevel` da Fase 11) — nunca escreve num estado de React desconectado do banco. O único cenário sem efeito de servidor ("Franquia") é honestamente descrito como puramente client-side (troca de `BrandProvider`), não disfarçado de chamada de API. Todas as mutações atingem exclusivamente a empresa fixa de demonstração (`getDemoCompany()`), nunca aceita de fora — o mesmo princípio de isolamento de toda superfície `/api/dev/demo/*` desde a Fase 6 (ADR-027), reaplicado aqui a uma superfície nova.

Como `/demo` é deliberadamente PÚBLICA e alcançável em produção (ao contrário de `/dev/*`, sempre bloqueada por `NODE_ENV`), duas proteções adicionais, reais: um limite de taxa por IP dedicado (`demoScenario`, 10/min — `lib/rate-limit.ts`) nas rotas `/api/demo/scenarios/*`; e o cenário "Falha de Redis" reaproveita `setChaosFlag`, que JÁ é auto-protegido contra produção em duas camadas independentes (`isChaosActive`/`setChaosFlag` retornam/no-opam incondicionalmente quando `NODE_ENV === "production"`, mesmo se alguém conseguisse chamar a rota) — nenhum gate novo precisou ser inventado, o mecanismo da Fase 8 já era seguro o bastante para ser exposto publicamente.

**Consequências:** Cada cenário produz um efeito genuíno e observável nas MESMAS telas que já leem essas tabelas (Live Mode, Heatmap, Analytics, Playbooks) — nunca uma segunda fonte de verdade. O custo: rodar um cenário deixa dados sintéticos permanentes na empresa de demonstração (o mesmo já aceito desde o seed original, Fase 6/7) — sem um mecanismo de limpeza automática, um uso público intenso do Demo OS cresce essa tabela ao longo do tempo, um ponto de atenção operacional registrado, não um bug.

---

## ADR-054: Nenhum banco embarcado/em memória foi construído para o Live Sandbox — o gargalo real era autenticação, não persistência

**Status:** Aceita (decisão de escopo) · **Fase:** 12

**Contexto:** O pedido de Live Sandbox lista "banco em memória" como exemplo de infraestrutura permanente de desenvolvimento. Uma avaliação honesta antes de escrever qualquer código: este produto usa `String[]` (arrays nativos) em pelo menos 4 modelos (`NFCCard.tags`, `Campaign.tags`, `WebhookEndpoint.events`, `ApiKey.scopes`) e enums do Postgres em mais de 15 — nenhum dos dois tem suporte nativo equivalente em SQLite, e um banco embarcado Postgres-compatível de verdade (ex.: PGlite/WASM) exigiria um adaptador Prisma não oficial, nunca testado contra Prisma 7 neste projeto, para uma dependência nova e experimental.

**Decisão:** Não construir um banco embarcado agora. A investigação real (ADR-052) mostrou que o bloqueio que de fato forçava editar arquivos a cada fase era SEMPRE autenticação (Clerk), nunca a ausência de Postgres em si — nenhuma fase anterior jamais "consertou" a falta de banco neste sandbox, e nenhuma alegou o contrário. Resolver o problema real (autenticação, ADR-052) entrega o essencial de "Self-Healing Development" sem a instabilidade de uma dependência experimental. "Redis fake"/"filas fake" também não precisaram ser construídos: `getQueue()`/`cachedOrLoad`/o rate limiter JÁ degradam graciosamente sem Redis desde a Fase 1/8 — o Dev Runtime não duplica isso, só reconhece e documenta que já existe.

**Consequências:** Um desenvolvedor com um Postgres real (local, Docker, ou uma conta de nuvem gratuita) configurado em `DATABASE_URL` já tem, com `DEV_RUNTIME=1`, uma experiência de desenvolvimento completa sem tocar Clerk. O custo, honesto: NESTE sandbox específico, sem um Postgres real alcançável, páginas que dependem de dados continuam falhando no mesmo ponto de sempre — o Dev Runtime prova que o código chega até lá, não que o sandbox ganhou um banco de dados. Se um banco embarcado for pedido explicitamente no futuro, o caminho é PGlite + um adaptador Prisma customizado, avaliado e testado como seu próprio esforço — não decidido por escassez de tempo numa fase que pedia várias outras coisas ao mesmo tempo.

---

## ADR-055: Dev Command Center v2 compõe o Reliability Engine da Fase 8, nunca o recalcula

**Status:** Aceita · **Fase:** 12

**Contexto:** `getReliabilitySnapshot()` (Fase 8) já calcula saúde de Redis/filas/cache/eventos/spans, consumido hoje pelo Mission Control e pelo Painel de Saúde. O pedido desta fase para o Dev Command Center v2 pede TUDO isso mais webhooks, playbooks/AutoPilot e "cenário atual" — o risco óbvio era reimplementar as métricas já existentes numa segunda função.

**Decisão:** `services/command-center.service.ts`'s `getCommandCenterSnapshot(companyId)` chama `getReliabilitySnapshot()` como está e SÓ adiciona os três painéis que genuinamente não existiam em lugar nenhum: `getWebhookHealth` (agregando `WebhookDelivery` por status, Fase 9), `getPlaybookAutomationSummary` (Fase 11: nível de AutoPilot + contagens de recomendação), e `getLastScenario` (Fase 12, lido de uma chave Redis best-effort gravada por `runScenario`). Cada sub-leitura nova segue o MESMO padrão de degradação graciosa já estabelecido pelo Reliability Engine (try/catch com fallback zerado, nunca uma exceção que derruba o snapshot inteiro). O Event Explorer (`/dev/command-center/events`) e o Visual Event Flow reaproveitam o `EventLog`/`replay.service.ts` já existentes (Fase 8), só adicionando `listRecentEventLogs`/`getEventWithCorrelation` — duas funções de LEITURA novas, nunca uma segunda tabela de eventos.

**Consequências:** Qualquer mudança futura em como o Reliability Engine calcula saúde de fila/cache se propaga automaticamente para o Command Center v2, nunca diverge. O custo: os novos painéis (webhooks/playbooks/cenário) são escopados à empresa fixa de demonstração, mesmo padrão de toda `/dev/ceo/*` desde a Fase 6 (ADR-027) — não uma visão multi-tenant de verdade, o que seria escopo não pedido para uma ferramenta de engenharia interna.

---

## ADR-056: Cron Jobs na Vercel rodam 1x/dia no plano Hobby — achado real no primeiro deploy, não uma suposição

**Status:** Aceita · **Fase:** Gate Final de Entrega

**Contexto:** O primeiro deploy real desta fase (o primeiro que este produto já teve, contra infraestrutura de verdade) falhou de imediato: `vercel.json` tinha `/api/queues/process` a cada minuto (`* * * * *`, ADR-033) e `/api/playbooks/evaluate` a cada 15 minutos (`*/15 * * * *`, Fase 11) — a Vercel recusou o deploy com a mensagem "Hobby accounts are limited to daily cron jobs." O plano gratuito da Vercel permite Cron Jobs, mas cada um só pode rodar no máximo 1x por dia — um limite de plataforma real, descoberto batendo de frente com um deploy de verdade, não uma suposição de código.

**Decisão:** Os dois crons foram ajustados para rodar uma vez por dia, em horários distintos (`0 6 * * *` e `0 7 * * *`) — nunca removidos, porque o Worker Engine (Fase 8) e o Playbook Engine (Fase 11) continuam precisando de ALGUM acionador externo em ambiente serverless (nenhum dos dois sustenta um processo sempre ativo). Isso é uma degradação real e aceita, não escondida: em produção/demo e staging nos planos gratuitos, filas e reavaliação de Playbooks só são processadas por Cron uma vez por dia — o resto do tempo, a aplicação continua funcionando normalmente (o Resolution Engine nunca dependeu de fila para redirecionar, e a avaliação de Playbook por EVENTO real via `EVENT_SUBSCRIPTIONS`/fila `"playbooks"` continua rodando conforme o tráfego chega, Fase 12 ADR-050 — só a VARREDURA periódica de ausência de evento é que fica 1x/dia).

**Consequências:** O deploy funciona nos planos gratuitos dos dois ambientes. O custo, registrado: filas com jobs pendentes podem esperar até ~24h para serem drenadas num Hobby plan (em vez de ~1min); Playbooks que dependem só da varredura periódica (zona silenciosa, mesa VIP idle) só são reavaliados 1x/dia. Se o produto for para produção de verdade com clientes reais, a Vercel Pro (ou um acionador de Cron externo, ex.: cron-job.org apontando para as mesmas rotas protegidas por `CRON_SECRET`) resolve isso sem nenhuma mudança de código — as rotas já são as mesmas, só quem aciona muda.

---

## ADR-057: `/dev/**` e o Chaos Engine ganham um gate próprio (`ALLOW_DEV_TOOLS`) — `NODE_ENV` não distingue Staging de Produção

**Status:** Aceita · **Fase:** Gate Final de Entrega

**Contexto:** Todo `/dev/**` (Command Center, Reliability, Event Explorer) e o Chaos Engine (`lib/chaos/flags.ts`) eram gateados por `process.env.NODE_ENV === "production"`. Isso parecia certo lendo o código, mas é falso na prática: o Next.js define `NODE_ENV=production` em QUALQUER build implantado (`next build`) — Staging incluído, já que Staging também é um deploy real na Vercel, não `next dev`. Resultado: essas ferramentas eram estruturalmente inacessíveis em QUALQUER ambiente implantado, não só em Produção, tornando impossível testar Event Explorer/Reliability/Chaos Mode contra dados reais sem rodar `next dev` local — o que não teria Redis/Postgres/Vercel de verdade por trás. Confirmado ao vivo nesta fase: `/dev` retornava 404 tanto em `nfc-os-production.vercel.app` quanto em `nfc-os-staging.vercel.app`.

**Decisão:** Criado `lib/dev/gate.ts` com `devToolsEnabled()`: verdadeiro sempre que `NODE_ENV !== "production"` (dev local, sem mudança de comportamento) OU quando a env var nova `ALLOW_DEV_TOOLS` vale exatamente `"true"`. Essa env var é definida SÓ no projeto Vercel `nfc-os-staging` — nunca em `nfc-os-production`, que simplesmente não a declara (ausente = `false`, seguro por padrão). Todos os ~30 pontos que antes checavam `NODE_ENV === "production"` diretamente (`/dev/**`, `/api/dev/**`, `isChaosActive`/`setChaosFlag`, `maybeApplyChaos`) passaram a checar `!devToolsEnabled()`. Staging já era, por natureza, um ambiente dedicado sem cliente real (banco próprio, empresas seed) — exatamente o "ambiente de teste isolado" necessário para Chaos Mode não colocar Produção em risco.

**Consequências:** Event Explorer, Reliability e Chaos Mode agora são genuinamente testáveis contra infraestrutura real (Redis/Postgres/Vercel de Staging), sem nenhum caminho que os ative em Produção — a ausência da env var lá é o próprio gate, não uma checagem que possa ser esquecida. Risco residual, aceito e documentado: se alguém um dia definir `ALLOW_DEV_TOOLS=true` manualmente nas env vars do projeto `nfc-os-production`, o gate abre lá também — por isso o nome da variável é deliberadamente explícito (nunca um valor plausível de aparecer por acidente) e sua presença em Produção deve ser tratada como incidente de configuração, não como uso normal.

---

## ADR-058: Fase 14 (Design System 2.0) reaproveita o NFC OS Design Language existente — não é um redesenho do zero

**Status:** Aceita · **Fase:** 14

**Contexto:** Um chat dedicado a front-end foi aberto com um brief pedindo "criar o Design System 2.0" (Fase B do brief: definir tipografia, cores, radius, sombra, motion do zero), como se o projeto fosse greenfield em design. A auditoria da Fase A (`RELATORIO_AUDITORIA_FRONTEND_FASE_A.md`) encontrou o oposto: a Fase 4.5 já construiu um "NFC OS Design Language" completo (`packages/ui` — 17 componentes premium; `packages/design-tokens` — motion/z-index/breakpoints; `globals.css` — cor OKLCH/radius/sombra/glass, tudo com suporte a `prefers-reduced-motion`), com um manifesto próprio de 8 princípios (`MANIFESTO_DO_DESIGN.md`) cujo Princípio 6 já exige "nenhuma tela inventa seu próprio card." Tratar isto como greenfield seria descartar uma decisão de arquitetura madura e contrariar o próprio manifesto que rege todo trabalho visual do produto. Ao mesmo tempo, o brief do usuário tem um pedido real e válido por trás da linguagem "do zero": o produto não *parece* ter um design system coeso hoje, porque a adoção é inconsistente.

**Decisão:** Apresentado o achado ao usuário via `AskUserQuestion`, que confirmou explicitamente as duas leituras recomendadas: (1) esta trilha vira uma fase formal do roadmap principal (Fase 14, com os ADRs e os 10+3 reviews de sempre — ver Visual Consistency/Luxury Motion/Pixel Polish Review, adicionados em `ROADMAP.md` nesta mesma fase), em vez de uma trilha paralela sem rastreabilidade; (2) a Fase B do brief é reformulada de "criar do zero" para "fechar a lacuna de adoção" — migrar os pontos de duplicação já mapeados (Card/Badge/Dialog/Drawer/Popover/EmptyState raw vs. premium) para os componentes existentes, remover código morto (`PremiumPopover`, `skeletons.tsx` — zero uso em produto), corrigir os hex hardcoded encontrados (`brand-preview-panels.tsx`, `mission-control-view.tsx`), e só então decidir sobre dark mode (tokens prontos desde a Fase 4.5, nunca ligados — ADR-047). Novo componente só é criado onde a auditoria confirmou um buraco real (ex.: `Spinner` compartilhado, hoje inexistente; o `RecommendationCard` que hoje reimplementa botões em vez de compor o `Button` do shadcn). A ordem de páginas do brief (Landing → Login → Dashboard → Command Center → Playbooks → Analytics → Table Map → White Label → Developer Center → Demo OS → resto) foi mantida como pedida, mesmo a auditoria apontando que a Landing (prioridade #1) tem 0% de adoção hoje enquanto páginas "meio-termo" como Dashboard/Analytics/Settings têm o dano visual mais visível (os dois sistemas lado a lado no mesmo arquivo).

---

**Consequências:** A Fase 14 entrega migração e consistência, não um sistema paralelo — qualquer tela migrada herda automaticamente o que `packages/ui` já acerta (motion, `prefers-reduced-motion`, glass, tokens de cor). O custo: a "sensação de sistema novo" que o brief original pedia (uma repaginação visual radical) foi explicitamente descartada como direção — se o usuário quiser isso no futuro, é uma decisão nova e nomeada, não uma leitura implícita deste ADR. Risco residual documentado: `packages/ui` não tem `package.json`/workspace real (é só alias de path, ver ADR-022) — nada impede tecnicamente uma tela futura de voltar a importar shadcn raw; a Fase 14 não resolve isso estruturalmente, só corrige os casos já encontrados.

---

## ADR-059: Catálogo Visual Oficial — shadcn MCP + Magic UI MCP como fonte curada, um vencedor por categoria, nunca `motion` como segunda biblioteca de animação

**Status:** Aceita · **Fase:** 14 · Parcialmente substituída pelo ADR-077 (efeitos visuais da home, da loja e da entrada; o catálogo segue valendo para o Admin)

**Contexto:** Um segundo brief do usuário, ainda dentro da Fase 14, redefiniu a ordem de trabalho: antes de migrar qualquer página (o plano original do ADR-058), primeiro explorar `shadcn MCP` + `Magic UI MCP` a fundo e congelar um catálogo oficial — um componente vencedor por categoria (layout/motion/inputs/feedback/data/overlays/backgrounds), para que nenhuma tela futura escolha um componente diferente "porque parecia bonito na hora". Isso não contradiz o ADR-058 (que já apontava Fase C/D como o lugar certo para uso de MCP) — só adianta e formaliza esse trabalho antes de tocar a Landing, como Etapa 1-5 de um processo próprio ("Arsenal Visual Oficial"). Dois problemas técnicos reais apareceram durante a exploração, não hipotéticos: (1) `components.json` tinha `"registries": {}` vazio — o Magic UI MCP instalado via `npx @magicuidesign/cli@latest install claude` registra um servidor MCP global que exige reiniciar a sessão para aparecer, o que não era prático nesta sessão; a alternativa padrão e documentada pelo próprio Magic UI (registrar `"@magicui": "https://magicui.design/r/{name}.json"` em `components.json`) resolveu isso sem depender de um segundo servidor MCP — o shadcn MCP já instalado consegue consultar `@magicui` como só mais um registry, exatamente como o brief pediu ("shadcn MCP como orquestrador"). (2) Todo componente Magic UI baixado importa de `"motion/react"` — o pacote **`motion`**, sucessor/rebrand do `framer-motion`, mas um pacote npm DIFERENTE do `framer-motion@13.2.0` já instalado no projeto. Rodar o `add` do shadcn CLI sem intervenção instalaria `motion` como uma SEGUNDA biblioteca de animação (confirmado: apareceu em `package.json` após a instalação real) — exatamente o tipo de duplicação que o Manifesto e o próprio brief da Fase B proíbem ("misturar estilos incompatíveis"). Um terceiro problema menor, mesma classe: `@magicui/bento-grid` importava `ArrowRightIcon` de `@radix-ui/react-icons`, uma segunda biblioteca de ícones (o produto usa `lucide-react` exclusivamente, `components.json.iconLibrary: "lucide"`).

**Decisão:** (1) `@magicui` registrado como registry em `components.json`, junto do `@shadcn` já existente — nenhum registry de terceiro não verificado (ex. Aceternity, cuja URL de registry shadcn-compatível não pôde ser confirmada) foi adicionado; onde a auditoria de componentes encontrou um efeito só disponível lá (Aurora Background de página inteira), a decisão foi construir um componente próprio em `packages/ui` sobre os tokens de marca existentes, nunca adicionar uma URL não verificada (ver `CATALOGO_VISUAL_OFICIAL_NFC_OS.md §7`). (2) Regra permanente de instalação, válida para todo componente Magic UI futuro: todo import `from "motion/react"` é reescrito para `from "framer-motion"` (a API do `motion/react` é a mesma do `framer-motion` para os hooks/componentes usados por esses componentes — `motion`, `AnimatePresence`, `useMotionValue`, `useSpring`, `useScroll`, `useTransform`, todos já presentes em `framer-motion@13.2.0`) e o pacote `motion` é removido logo em seguida (`npm uninstall motion`). Confirmado nesta fase: `tsc --noEmit` e `eslint` limpos após a correção, `package.json` sem nenhuma dependência nova. (3) `ArrowRightIcon` trocado por `ArrowRight` de `lucide-react`, `@radix-ui/react-icons` removido. (4) O catálogo em si segue a regra "um vencedor por categoria" à risca — quando dois componentes pareciam competir pela mesma função (ex. `ripple`/`ripple-button` do Magic UI vs. o `.brand-ripple` já existente da Fase 10, ou `@shadcn/empty` vs. o `EmptyState` já existente da Fase 4.5), o já existente e já adotado venceu — nunca o novo só por ser novo. `globe`/`icon-cloud` (WebGL/3D) foram avaliados e não instalados por não terem caso de uso real hoje, não por incompatibilidade técnica.

**Consequências:** 19 componentes reais (17 Magic UI + `Spinner`/`HoverCard` do próprio shadcn) entram no projeto com impacto de bundle zero (nenhuma dependência nova sobrevive à correção) e um único sistema de motion (`framer-motion`) em todo o código, novo e antigo. O plano de execução do ADR-058 (migrar duplicação por página) não muda de conteúdo, só de posição: a Fase B passa a ser "montar e instalar o catálogo" (concluída nesta entrada), e a migração real por página (antes chamada Fase B) acontece dentro da Fase E, guiada por `PLANO_SUBSTITUICAO_COMPONENTES.md` — um documento novo que cruza os achados da Fase A com este catálogo, linha por página. Custo aceito: qualquer componente Magic UI instalado manualmente no futuro (fora deste fluxo) precisa lembrar da mesma correção de import — não há um lint automático prevenindo alguém de reintroduzir `motion/react` sem querer; documentado aqui e no catálogo como o procedimento permanente, não automatizado.

---

## ADR-060: Dev Runtime precisa esconder `<UserButton/>` também — não só pular `<ClerkProvider/>` — achado só possível com um banco real conectado

**Status:** Aceita · **Fase:** 14

**Contexto:** Pela primeira vez desde a Fase 12, este ambiente teve um `DATABASE_URL` real conectado (Supabase, empresa de demonstração Bella Vista já semeada) ao mesmo tempo que `DEV_RUNTIME=1`. Isso permitiu, pela primeira vez, navegar de verdade até `/dashboard` renderizado — e ele quebrava por completo: `src/app/dashboard/layout.tsx:32` renderiza `<UserButton/>` do Clerk incondicionalmente, que exige `<ClerkProvider/>` — removido de propósito neste modo (ADR-052). O Dev Runtime da Fase 12 resolveu corretamente o lado do SERVIDOR (`getAuthContext()` nunca chama `auth()`), mas nunca foi verificado contra um componente CLIENTE do Clerk de verdade, porque nenhuma sessão anterior tinha chegado tão longe — o bloqueio de sempre era a ausência de Postgres, nunca esse.

**Decisão:** `dashboard/layout.tsx` agora verifica `isDevRuntimeEnabled()` e substitui `<UserButton/>` por um indicador mínimo e honesto (as iniciais do e-mail do usuário semeado, `title` mostrando "Dev Runtime — {email}") — nunca um menu fake com "Sair"/"Perfil" que não funcionaria (Zero Fake Demo aplica-se aqui também). `/sign-in` e `/sign-up` continuam genuinamente impossíveis de renderizar neste modo — `<SignIn/>`/`<SignUp/>` SÃO a própria UI de autenticação, não há um "modo Dev Runtime" coerente para elas (diferente de `<UserButton/>`, que é só um menu de conveniência) — documentado como limitação honesta, não corrigido.

**Consequências:** `/dashboard` e toda a árvore autenticada agora renderizam de ponta a ponta neste ambiente, verificado com dados reais (não hipotético) — Cartões, Equipe (incluindo o modal "Convidar membro"), Configurações e Analytics todos confirmados via screenshot contra a Bella Vista real. Custo: `/sign-in`/`/sign-up` continuam fora do alcance de verificação visual neste sandbox — quem precisar testá-las precisa de chaves reais do Clerk (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`/`CLERK_SECRET_KEY`) ou rodar contra um ambiente com Clerk configurado.

---

## ADR-061: Dark mode ligado de verdade — o `forcedTheme="light"` da Fase 4.5/ADR-047 é revogado

**Status:** Aceita · **Fase:** 14

**Contexto:** Desde a Fase 4.5 (ADR-023) o produto carrega um bloco `.dark` completo em `globals.css`, mas `layout.tsx` sempre travou `forcedTheme="light"` — a Fase 10 tentou entregar "temas claro e escuro" para White Label e documentou honestamente, em ADR-047, que isso não tinha sido feito (nenhuma tela escura jamais construída/testada). O usuário pediu explicitamente, nesta fase, para julgar se dark mode é necessário para o produto parecer "empresa de bilionária" — e é: Linear, Vercel, Raycast e Arc são dark-mode-first ou fortemente dark-mode; é tabela de estacas para o posicionamento premium que todo o Fase 14 mirou.

**Decisão:** `forcedTheme` removido de `layout.tsx`; `ThemeProvider` passa a usar `defaultTheme="light"` (comportamento inicial idêntico ao de antes — ninguém é surpreendido) com `enableSystem={false}` mantido de propósito (uma ferramenta de trabalho não deveria trocar de tema sozinha por causa do SO de quem está usando — só quando a pessoa escolhe). Toggle oficial: `AnimatedThemeToggler` (Magic UI, View Transitions API com reveal circular) embrulhado em `src/components/theme-toggle.tsx`, que o mantém sempre controlado pelo `next-themes` (`useTheme()`) — nunca deixa o toggler decidir/persistir tema sozinho, `next-themes` continua a única fonte da verdade. Colocado em `SiteHeader` (Landing) e no header do `dashboard/layout.tsx`. Verificado ao vivo, tema escuro completo: Landing (Hero/Como Funciona/Bento Features/Prova Social/Pricing/FAQ/CTA), Dashboard, Mapa de Mesas e Equipe (incluindo o `HoverCard` novo) — **zero ajuste manual de contraste foi necessário em qualquer tela**, porque a Fase 14 já tinha eliminado todo hex hardcoded e todo componente raw em favor de tokens semânticos (`--background`/`--foreground`/`--brand`/etc.) antes deste ADR — a consistência da fase anterior é o que tornou esta fase trivial de executar com segurança.

**Consequências:** Dark mode é um recurso real, alcançável por qualquer usuário, em todo o produto — não mais um bloco de CSS morto. Custo residual, aceito: `--shadow-subtle/elevated/premium` continuam usando `oklch(0 0 0 / …)` (sombra preta) em ambos os temas — em dark mode a sombra em si fica quase invisível contra um fundo já escuro, mas isso é o comportamento correto/esperado de UI escura (bordas e glow fazem o trabalho de profundidade que sombra fazia no claro, não uma sombra mais escura) — não é um bug, não foi "consertado" com um segundo valor de sombra por tema. Páginas brand-aware do cliente final (`/r/[code]`, `/feedback`, telas de login com marca própria) permanecem deliberadamente fora do alcance do toggle — a cor ali é sempre a da EMPRESA cliente, nunca a decisão de tema de quem visita.

---

## ADR-062: Billing real via Stripe — plano nunca muda fora do webhook; loja de cartões físicos é um fluxo de pagamento único, deliberadamente desacoplado de `Company`

**Status:** Aceita · **Fase:** 15

**Contexto:** Até esta fase, `Company.plan` nunca era escolhido — todo cadastro caía no default do banco (`STARTER`) e nenhum gateway de pagamento existia no projeto (nenhum pacote Stripe, nenhuma rota de checkout/webhook). Os 3 planos (Starter R$39, Pro R$89, Business R$199) já tinham preço/limite/features definidos em `lib/plans.ts` — faltava só a cobrança de verdade por trás. Em paralelo, foi pedida uma loja pública de cartões NFC físicos, com um fluxo de compra avulsa (sem exigir conta no SaaS) que captura para onde o comprador quer que o cartão redirecione.

**Decisão:** Stripe (escolha do usuário, confirmada explicitamente) em dois modos de checkout independentes:
1. **Assinatura** (`/api/billing/checkout`, modo `subscription`) — usado no onboarding (`/onboarding/plan`, inserido como etapa obrigatória depois de criar a empresa, antes do dashboard) e em Configurações (`BillingPortalButton`, abre o Stripe Billing Portal para upgrade/downgrade/cancelamento). `Company.plan`/`stripeCustomerId`/`stripeSubscriptionId`/`stripeSubscriptionStatus` só são escritos pelo webhook (`/api/stripe/webhook`, eventos `checkout.session.completed`/`customer.subscription.updated`/`.deleted`) — nunca otimisticamente no momento do clique. `customer.subscription.deleted`/`unpaid` rebaixa a empresa para `STARTER` automaticamente, nunca deixa uma empresa presa num plano pago sem cobrança ativa.
2. **Pagamento único** (`/api/store/checkout`, modo `payment`) — a loja pública (`/loja`). Sem `requireAuthContext()` de propósito: um comprador da loja pode nunca vir a ter conta no SaaS. Cada pedido vira um `StoreOrder` (novo model, deliberadamente sem relação com `Company`) já na hora do checkout (`PENDING_PAYMENT`), com `destinationUrl`/nome/e-mail do comprador — o webhook só marca `PAID` depois; `FULFILLED`/`CANCELED` são atualizados manualmente por quem opera o envio, já que não existe integração de fornecedor/logística nesta fase (decisão do usuário: construir vitrine+checkout agora, resolver fabricação/fulfillment depois, fora do código).

**Consequências, e o que fica deliberadamente em aberto:** Sem `STRIPE_SECRET_KEY`/Price ids configurados, toda rota de cobrança recusa explicitamente (503) — nunca finge cobrar nem deixa escolher um plano sem pagar. **Atualização de 10/09/2026:** com uma conta Stripe real conectada (modo teste, chaves fornecidas pelo usuário), o fluxo inteiro foi exercitado ao vivo em Produção — assinatura completa via cartão de teste, webhook confirmando e gravando `plan`/`stripeCustomerId`/`stripeSubscriptionId` corretamente, Billing Portal mostrando a assinatura/fatura/forma de pagamento reais, e uma sessão de checkout único da loja criada com sucesso. Deixa de ser uma limitação — está provado funcionando, não só compilando. Pergunta em aberto, não decidida unilateralmente: hoje nada IMPEDE uma empresa de acessar `/dashboard` sem nunca ter passado por `/onboarding/plan` ou sem assinatura ativa (o gate é só um passo a mais no fluxo de cadastro, não uma trava de acesso) — bloquear de verdade o acesso sem assinatura afetaria toda empresa/seed já existente sem `stripeSubscriptionId`, uma decisão de produto que precisa ser tomada explicitamente antes de implementar. Também em aberto: nenhum plano tem trial gratuito. **Atualização de 11/09/2026 (ADR-065):** a pergunta sobre "(em breve)" em multi-unidade foi investigada a fundo — o backend (Fases 4/10) de fato nunca teve trava de plano, mas também nunca teve UI nenhuma no Dashboard para o cliente usar, então o rótulo "em breve" era, na prática, mais honesto do que parecia. Fechado com `/dashboard/unidades`, agora sim gated ao plano Business. Domínio personalizado (`/dashboard/branding`) já tinha UI própria desde a Fase 10 — esse rótulo já estava simplesmente errado; removido junto nesta mesma revisão.

---

## ADR-063: Painel Admin (`/admin`) — área do dono da marca, gate de acesso temporariamente removido a pedido explícito

**Status:** Aceita, com pendência de segurança conhecida e registrada · **Fase:** 16

**Contexto:** O produto precisava de uma área operacional para quem é dono/opera o SaaS (não uma empresa cliente) — mexer no conteúdo da home/loja (vídeo, fotos, preço), ver as empresas cadastradas e avançar pedidos da loja. Diferente de `/dashboard` (multi-tenant, uma empresa por sessão), `/admin` é de escopo global: qualquer mudança lá afeta o site inteiro.

**Decisão:** Layout e sidebar completamente separados de `/dashboard` (`src/app/admin/layout.tsx`, `src/components/admin/`). Acesso original: `isSuperAdmin()` (`lib/super-admin.ts`) checando o e-mail do usuário Clerk logado contra a allowlist `SUPER_ADMIN_EMAILS`, com `notFound()` (não redirect) para quem está fora — mesmo padrão de `lib/dev/gate.ts`, ninguém fora da lista deveria nem saber que a rota existe. Três páginas: Visão geral (KPIs reais via Prisma — nunca hardcoded), Empresas (lista real, sem ação de escrita ainda — ver auditoria de 10/09/2026), Pedidos (avança `StoreOrder.status`), Conteúdo (`SiteSettings`, overrides de vídeo/preço/imagem sobrescrevendo os defaults de `store-products.ts`/hero).

**Mudança de 10/09/2026, a pedido explícito do dono do produto:** o gate de `isSuperAdmin()` foi removido do layout para destravar o acesso enquanto o login via Clerk não é confirmado funcionando para o e-mail `ilanpnh@gmail.com`. **Isso deixa `/admin` publicamente acessível sem login** — e a auditoria da mesma data encontrou que as páginas nunca tiveram checagem própria (sempre dependeram inteiramente do layout), então hoje qualquer pessoa com o link vê e-mail/pedido de cliente real e pode alterar conteúdo do site. As rotas de escrita (`/api/admin/orders/[id]`, `/api/admin/site-settings`) continuam exigindo `isSuperAdmin()` — só a leitura ficou aberta.

**Consequências:** Pendência de segurança conhecida, não escondida — marcada em `admin/layout.tsx`, no ROADMAP e nesta ADR. Reverter é trivial (reintroduzir a checagem removida) assim que o login completar; o risco real está na janela de tempo em que a rota fica exposta, não na dificuldade da correção.

---

## ADR-064: Ponte Loja → SaaS — provisionamento manual de `NFCCard` a partir de um `StoreOrder` pago

**Status:** Aceita, superada pela Fase 18 · **Fase:** 17

**Contexto:** A Fase 15 construiu a loja e o `StoreOrder`, mas nunca fechou o círculo: pagar na loja não criava nenhum `NFCCard` — o pedido ficava `PAID` para sempre, sem nunca virar um cartão de verdade no sistema. Descoberto ao simular o fluxo completo de compra de 20 cartões.

**Decisão:** `/api/admin/orders/[id]/provision` (POST), acionado manualmente pelo Admin: resolve o `companyId` do pedido (já gravado, ou por match de e-mail contra um `User` existente), cria N `NFCCard`s via `createCard`, e — só se o destino escolhido diferir do `googleReviewUrl` já configurado — cria uma `Campaign`/`CampaignAssignment` inicial via `buildSyntheticAuthContext`. Idempotente por `provisionedAt`/`provisionedCardIds`.

**Consequências:** Resolvia o problema só para compradores que já tinham conta com o mesmo e-mail — um comprador 100% novo (o caso mais comum de quem só quer o cartão físico) ficava preso pedindo "crie uma conta com o mesmo e-mail" sem nenhum caminho automático. Esse gap específico é o que a Fase 18 (ADR-065) fecha.

---

## ADR-065: Motor de Ativação — `Company.accountType`, checkout único, checklist de produção, Centro de Operações, portal `/meu-cartao`

**Status:** Aceita · **Fase:** 18

**Contexto:** Um mapeamento profundo de todos os 5 fluxos do produto (documento de engenharia publicado em 10/09/2026) identificou o Fluxo 2 (cliente sem SaaS) como o elo mais frágil: nenhum comprador 100% novo conseguia ter seu cartão avulso realmente funcionando sem intervenção manual fora do fluxo desenhado — a mesma limitação já registrada na ADR-064. Em paralelo, o dono do produto relatou confusão real usando o fluxo Cartão→Mapa de Mesas→Campanha ao simular a compra de 20 cartões.

**Decisão, em 7 sub-fases:**
1. **Fundação de dados** — novo enum `AccountType` (`GUEST`/`CUSTOMER`) em `Company`; checklist de produção granular no `StoreOrder` (`stockConfirmedAt`/`nfcWrittenAt`/`qcPassedAt`/`packagedAt`/`shippedAt`/`deliveredAt`/`trackingCode`/`carrier`) além do `status` resumido já existente; `NFCCard.editToken` para o portal leve; estoque de chips (`SiteSettings.blankChipStock`).
2. **Empresa convidada automática** — `services/store-order.service.ts`'s `provisionStoreOrder()` roda sozinho no webhook do Stripe assim que um pagamento é confirmado (não mais um clique manual): se nenhum `companyId`/`User` correspondente existir, cria uma `Company GUEST` sem login, sem plano real, só para o cartão físico ter onde existir.
3. **Checkout único** — `/api/billing/checkout` aceita um add-on opcional de cartões físicos na mesma sessão Stripe (`mode: subscription` combinando um preço recorrente com um item avulso via `price_data`) — uma cobrança, um `StoreOrder` (`orderType: CARD_PLUS_SAAS`), nunca dois checkouts desconectados.
4. **Rastreamento no lugar certo** — checklist granular na página de acompanhamento sem login (`/loja/sucesso`) e um banner no `/dashboard` para quem já tem conta, cada um com a mensagem certa para o tipo de empresa.
5. **Centro de Operações** — `/admin/pedidos` virou um quadro Kanban de 6 colunas (derivadas da checklist, nunca um campo próprio) com drag-and-drop, seleção múltipla e um widget de estoque.
6. **Portal `/meu-cartao/[editToken]`** — cliente `GUEST` troca o próprio destino sem conta, com um CTA de upgrade — fecha o ponto de atrito mais grave do Fluxo 2.
7. **Upgrade sem duplicar** — `claimGuestCompany()` (mesmo espírito de `resolveOrClaimUser`) promove uma `Company GUEST` existente para `CUSTOMER` no onboarding, em vez de criar uma segunda empresa.

**Bug crítico encontrado e corrigido nesta fase:** toda `Campaign` criada por `createCampaign()` nascia com `status: DRAFT` (default do schema), e o motor de resolução só considera campanhas `ACTIVE` como candidatas (`resolution-engine/data.ts`). Isso significa que, desde a Fase 17, **nenhum cartão físico provisionado jamais redirecionava para o link escolhido na compra** — caía sempre no fallback de avaliação Google, silenciosamente, sem nenhum erro visível. Corrigido chamando `updateCampaign(..., { status: "ACTIVE" })` logo após a criação, tanto no provisionamento quanto no portal `/meu-cartao`. Agora coberto por teste de regressão (`resolve.test.ts`).

**Revisão noturna adicional (11/09/2026)**, pedida explicitamente para checar consistência de fluxo/UX (incluindo a ótica de um usuário idoso/não-técnico) antes de ir para produção, encontrou e corrigiu: um parâmetro `skipPlanLimit` morto em `createCard()` (o provisionamento real usa outro caminho, que nunca checava esse limite); `billing_address_collection` faltando no checkout combinado (inconsistente com a loja avulsa); um botão de ação em lote no quadro do Admin que sempre falhava na coluna "Embalar"; falta de botão de copiar no link `/meu-cartao` (a única cópia do link, sem e-mail de confirmação); falta de indicação visual de "webhook falhou" no quadro; mensagem de rastreio sem o nome da transportadora; copy da loja desatualizada sobre como trocar o destino. A mesma revisão também encontrou que **`Branch`/`Zone` nunca tiveram uma tela própria no Dashboard desde que o modelo existe (Fase 4)** — só API pública, apesar de `lib/plans.ts` anunciar "múltiplas unidades" como diferencial do plano Business (a pergunta em aberto da ADR-062 fica assim respondida: o backend nunca teve trava de plano, mas o cliente também nunca teve UI para usar). Fechado com `/dashboard/unidades`, gated explicitamente ao plano Business.

**Também desta revisão:** primeira suíte de testes automatizados do projeto (Vitest, `vitest.config.ts`, `npm run test`) cobrindo lógica pura de alto risco — RBAC (`roles.test.ts`), motor de resolução (`resolve.test.ts`, incluindo o regression test do bug acima), checklist/quadro de produção, `plans.ts`, `slugify.ts` — e o primeiro workflow de CI (`.github/workflows/ci.yml`, roda type-check/lint/test em todo push/PR).

**Consequências e o que fica deliberadamente em aberto:** Sem integração real com Correios/transportadora (rastreio e transportadora são digitados manualmente pelo Admin) — decisão de escopo, não um bug. O campo de "link de destino" no checkout continua exigindo que o comprador saiba o que é uma URL, sem opções pré-definidas (Google/Instagram/WhatsApp) — identificado como o maior ponto de atrito para um usuário menos técnico, registrado como recomendação, não implementado nesta fase. Nenhuma instrução física aponta do cartão/embalagem para o link `/meu-cartao`. `SENTRY_DSN` continua vazio (`.env.example`) — o código de observabilidade existe e funciona, falta só a conta/projeto Sentry real do usuário.

## ADR-066: Painel Admin — gate `isSuperAdmin()` reativado, fechando o ciclo da ADR-063

**Status:** Aceita · **Fase:** 19.1

**Contexto:** A ADR-063 documentou a remoção temporária do gate de acesso do `/admin`, a pedido explícito do dono do produto, enquanto o login via Clerk não estava confirmado funcionando para `ilanpnh@gmail.com`. Isso deixou `/admin` publicamente acessível (leitura) por 3 dias — pendência de segurança conhecida e registrada, nunca escondida. A Fase 19 (transformação do painel em Centro de Operações) toca exatamente essa área; reconstruir a experiência visual sem fechar o próprio acesso seria entregar uma vitrine premium atrás de uma porta destrancada.

**Decisão:** `src/app/admin/layout.tsx` volta a chamar `isSuperAdmin()`/`notFound()` antes de renderizar qualquer coisa — exatamente o gate original da ADR-063, revertido sem modificação. `isSuperAdmin()` (`lib/super-admin.ts`) ganhou uma extensão permanente na mesma fase: sob Dev Runtime (`isDevRuntimeEnabled()`, dois portões — `NODE_ENV !== "production"` E `DEV_RUNTIME=1` — nunca verdadeiro em produção real), retorna `true` direto, sem depender do Clerk. Isso não é uma reintrodução da brecha antiga: os dois portões do Dev Runtime garantem que isto só vale em desenvolvimento local, nunca no deploy real (onde `NODE_ENV` é sempre `"production"`) — e resolve o problema de fundo que motivou a ADR-063 (testar `/admin` interativamente sem depender do Clerk primeiro), no mesmo espírito de "Self-Healing Development" (ADR-052), em vez de deixar o gate removido indefinidamente.

**Pré-condição operacional:** a reativação só é segura em Produção depois que `SUPER_ADMIN_EMAILS` (Vercel) incluir o e-mail real do dono (`ilanpnh@gmail.com`) — confirmado fora do código, já que o valor é um segredo que não pode ser lido programaticamente. O deploy desta mudança para Produção foi sequenciado depois dessa confirmação.

**Consequências:** `/admin` deixa de ser acessível sem login, fechando a pendência registrada na ADR-063. `<UserButton/>` no header do admin ganhou o mesmo guard condicional já usado em `dashboard/layout.tsx` (ADR-060) — sem isso, quebraria sob Dev Runtime por depender de `<ClerkProvider/>`, que esse modo deliberadamente não monta.

**Achado real do build desta mesma fase, não uma suposição:** `/admin`, `/admin/pedidos` e `/admin/conteudo` (nenhum usa `searchParams`/segmento dinâmico) estavam sendo classificados como estáticos pelo Next e pré-renderizados UMA VEZ no build — o gate acima rodaria só naquele momento, nunca por requisição real, e todo KPI ficaria congelado na data do deploy. Corrigido com `export const dynamic = "force-dynamic"` em `admin/layout.tsx` (cascateia para toda página em `/admin/**`), mesmo padrão já usado em `/demo` e `dashboard/table-map` para o mesmo problema.

## ADR-067: Quadro de Produção — 8 etapas (Fase 19.3), `printedAt` como único campo novo

**Status:** Aceita · **Fase:** 19.3

**Contexto:** O quadro de 6 colunas da Fase 18 (`AGUARDANDO_ESTOQUE/PRONTO_GRAVAR/GRAVADO_TESTAR/EMBALAR/ENVIADO/ENTREGUE`) conflava duas etapas físicas distintas numa só: "Embalado" e "Enviado" aconteciam juntos ao arrastar um cartão pra coluna "Enviado" (o mesmo clique gravava `packagedAt` e `shippedAt`+rastreio). O dono do produto pediu um quadro fiel à linha de produção real: Pago → Separação → Impressão → Programação NFC → Qualidade → Embalagem → Expedição → Entregue.

**Decisão:** Em vez de tratar isso como 8 conceitos novos, mapeado sobre o que já existia:
- **Pago** e **Separação** são os antigos `AGUARDANDO_ESTOQUE`/`PRONTO_GRAVAR` renomeados — nenhum campo novo (`stockConfirmedAt` já significa "material separado/disponível").
- **Programação NFC**, **Qualidade**, **Embalagem**, **Entregue** são as colunas antigas renomeadas, mesmos campos (`nfcWrittenAt`/`qcPassedAt`/`packagedAt`/`deliveredAt`).
- **Impressão** é a única etapa genuinamente nova — `StoreOrder.printedAt DateTime?`, nova migration aditiva, `markPrinted()` em `store-order.service.ts`.
- **Expedição** deixa de ser aplicada junto com Embalagem — vira sua própria entrada de coluna (`shippedAt`, ainda exigindo o diálogo de rastreio/transportadora em `confirmShipment`), enquanto Embalagem (`packagedAt`) passa a ser um clique simples como qualquer outra etapa.

`domain/store-order/board.ts`, `domain/store-order/checklist.ts` (novo passo "Impresso" na timeline do cliente/dashboard, reaproveitando as mesmas funções puras — nunca uma segunda checklist), `orders-board.tsx`, `/api/admin/orders/[id]/checklist`, `/api/admin/orders/bulk` atualizados juntos. Suíte de testes (`board.test.ts`) reescrita para o novo modelo, 68 testes passando.

**Consequências:** Nenhuma migração destrutiva — todo pedido existente simplesmente aparece na coluna equivalente (quem tinha `packagedAt` sem `shippedAt` cai em "Embalagem", quem já tinha os dois cai em "Expedição", nunca perdendo lugar no quadro). Ação em lote continua bloqueada para a entrada de "Expedição" (mesma razão de antes: exige rastreio individual), agora liberada para "Impressão" como qualquer outra etapa simples.

## ADR-068: Empresas como CRM — Health Score explicável (Fase 19.4)

**Status:** Aceita · **Fase:** 19.4

**Contexto:** A ficha de empresa do Admin (`/admin/empresas/[id]`, ferramenta de suporte da Auditoria Nível Bilionário) mostrava usuários/cartões/campanhas em tabelas cruas, sem nenhum sinal agregado de "esta conta está saudável ou em risco de churn". O pedido era um Health Score real — nunca um número opaco ou fabricado (Zero Fake Demo, Explainability First).

**Decisão:** `computeHealthScore()` (`src/domain/company/health-score.ts`) — função pura, 0–100, soma de 4 fatores sempre retornados junto com o total, nunca só o número final:
- **Atividade recente (0–40)** — toques + avaliações + feedbacks dos últimos 30 dias, contra um piso de 60/mês (~2/dia) assumido como "uso saudável mínimo" para um estabelecimento pequeno/médio — teto documentado no código, não escondido.
- **Avaliações positivas (0–25)** — % de notas 4-5 estrelas nos últimos 90 dias; sem nenhuma avaliação no período, pontuação neutra (13, não 0 nem 25) — ausência de dado não é o mesmo que dado ruim.
- **Campanhas ativas (0–20)** — binário: existe pelo menos 1 campanha `ACTIVE` hoje.
- **Recência (0–15)** — dias desde o último evento real; nunca teve nenhum, zero.

Dado buscado por `getCompanyOperationsSnapshot()` (`services/company.service.ts`), que também calcula receita estimada (`PLANS[plan].priceMonthly × meses desde a criação` + soma de `StoreOrder` pagos vinculados à empresa — rotulado explicitamente "estimativa, não histórico exato", ver limitação financeira da ADR-066) e um heatmap de atividade por zona × dia (`buildZoneActivityHeatmap()`, `domain/company/activity-heatmap.ts` — lógica nova, o heatmap existente do Mapa de Mesas agrega por `cardId`, não por zona, e não existia agregador algum "atividade por zona" no produto).

`HeatmapCard` e `AvatarStack` (`@nfc-os/ui`) entram em uso pela primeira vez no produto — existiam desde a Fase 6/7 sem nenhuma tela consumindo.

**Verificado com dado real, não hipotético:** Bella Vista (empresa mais ativa do Staging, 589 toques/30d, 78 avaliações/90d, 10 campanhas ativas) — score 90; Nova Steakhouse (zero atividade, zero cartões) — score 13, sem erro de divisão por zero, sem heatmap fantasma (a lista de zonas vem vazia, o card simplesmente não renderiza, nunca um heatmap com dado fabricado).

**Consequências:** Nenhuma migração de schema — todo dado já existia (`RedirectLog`/`RatingEvent`/`PrivateFeedback`/`Campaign`/`StoreOrder`, todos já indexados por `companyId`). A fórmula do Health Score é uma primeira versão documentada, não uma verdade estatística validada — os pesos (40/25/20/15) e o piso de atividade (60/mês) são julgamento de produto, registrados aqui para poderem ser revisados com dado real de churn no futuro, nunca tratados como definitivos.

## ADR-069: Estoque — dias restantes em vez de contagem crua (Fase 19.5)

**Status:** Aceita · **Fase:** 19.5

**Contexto:** `admin/conteudo` mostrava `blankChipStock` como um número cru ("12 unidades"), sem nenhuma leitura de urgência — o pedido original de estoque industrial (SKU/fornecedor/lead time) foi cortado do escopo desde o plano aprovado da Fase 19 por não existir modelo de dado nenhum para isso (registrado no Contexto do plano). O que já é real e vale construir: o contador global existe, e `NFCCard.createdAt` já registra todo consumo.

**Decisão:** `computeStockForecast(currentStock, cardsCreatedInWindow)` (`src/domain/inventory/stock.ts`) — função pura, sem I/O: `dailyConsumption = cardsCreatedInWindow / 14`; se `dailyConsumption <= 0`, retorna `daysRemaining: null` (nunca `Infinity` nem um número fabricado — "sem consumo recente para estimar duração" é o que a UI mostra nesse caso); caso contrário, `Math.floor(currentStock / dailyConsumption)` — arredonda pra baixo deliberadamente, nunca promete um dia a mais do que o estoque cobre. `admin/conteudo/page.tsx` busca `prisma.nFCCard.count()` dos últimos 14 dias (consumo é global, não por empresa — mesma natureza do contador) em paralelo com `getSiteSettings()`, e renderiza um `KpiCard` (reaproveitado, nenhum componente novo) com "N dias" como valor principal e a contagem crua + taxa diária como `hint` — a pergunta que importa ("quanto tempo até faltar?") na frente, o dado bruto ainda visível para quem quiser conferir a conta (Explainability First).

**Verificado com dado real de Staging, não sintético:** com `blankChipStock = 0` e consumo real de 3.8 cartões/dia, a tela mostrou "0 dias" — nem `null`, nem erro, nem um número negativo — exatamente o comportamento do caso de teste "estoque já zerado com consumo contínuo".

**Consequências:** Nenhuma migração — `blankChipStock`/`NFCCard.createdAt` já existiam. Estoque crítico já entra no Radar de Atenção (Fase 19.2/ADR anterior) via limiar simples (`stock < lowStockThreshold`); esta fase não muda essa regra, só enriquece a mesma tela com a leitura de dias. SKU/fornecedor/lead-time continuam fora de escopo, registrados no plano da Fase 19 como fase futura planejada, não projetada.

## ADR-070: Financeiro — snapshot honesto de MRR/ARR, evento `PlanoAlterado` (Fase 19.6)

**Status:** Aceita · **Fase:** 19.6

**Contexto:** O pedido original de "gráficos financeiros" (MRR/ARR ao longo do tempo, cohort, churn) esbarra num limite real de dado, já registrado no plano aprovado da Fase 19: `Company` só guarda o plano ATUAL — nenhuma tabela jamais registrou quando uma empresa trocou de plano no passado. Fabricar uma curva de tendência a partir disso violaria Zero Fake Demo. A versão honesta e ainda assim valiosa: um snapshot do que é verdade agora, mais a infraestrutura para que dentro de alguns meses exista uma tendência real.

**Decisão, em duas partes:**

1. **Snapshot de hoje** — `computeRevenueSnapshot()` (`src/domain/finance/revenue-snapshot.ts`, função pura, testada) soma `PLANS[plan].priceMonthly` só das empresas `accountType: CUSTOMER` (nunca `GUEST` — ver ADR-065, uma empresa GUEST nunca teve uma assinatura de verdade) com `stripeSubscriptionStatus === "active"` — uma empresa `past_due`/`canceled`/nunca assinada não entra no MRR, mesmo com um `plan` atribuído. ARR é MRR × 12 (projeção explícita, rotulada como tal, nunca chamada de "receita anual real"). Nova página `/admin/financeiro`: MRR, ARR projetado, receita física da loja em 30 e 90 dias (mesmo cálculo de `admin/pedidos`/`admin`, generalizado), e a distribuição de planos via `RankingList` (`@nfc-os/ui`, primeiro uso fora de Analytics) — só entre quem paga hoje, cada barra correspondendo a uma linha real do banco, nunca um valor de exemplo.
2. **Início do histórico real** — novo evento de domínio `PlanoAlterado` (Event Bus, Fase 8) publicado em `api/stripe/webhook/route.ts` toda vez que `Company.plan` muda de verdade (comparado com o valor anterior, buscado antes do `update`): no checkout inicial, numa troca feita pelo cliente no Portal de Cobrança da Stripe, ou num downgrade automático por cancelamento/inadimplência. Sem fila assíncrona associada ainda (`EVENT_SUBSCRIPTIONS.PlanoAlterado = []`) — existe só para `EventLog` acumular, a partir de hoje, o dado que faltava para um gráfico de tendência de MRR real dentro de alguns meses. Nunca um histórico fabricado retroativamente.

**Achado real corrigido no caminho (Zero Silent Debt):** o KPI "Empresas no SaaS" do Centro de Operações (`admin/page.tsx`, Fase 19.2) contava `Company.count()` sem filtro — incluindo empresas `GUEST`, que o próprio comentário do enum `AccountType` já promete que "nunca aparecem como cliente ativo do SaaS" (ADR-065). Corrigido para `count({ where: { accountType: "CUSTOMER" } })`, agora consistente com a contagem usada em `/admin/financeiro`.

**Verificado com dado real de Staging:** as 5 empresas `CUSTOMER` existentes têm `stripeSubscriptionStatus: null` (nenhuma passou por um checkout Stripe real neste ambiente) — a página mostra honestamente "R$ 0,00" e "0 de 5 empresas clientes com assinatura ativa", nunca um valor fabricado para preencher a tela. A lógica de soma/agrupamento por plano está coberta por 4 testes unitários (`revenue-snapshot.test.ts`) que exercitam múltiplas combinações de status/plano, já que o ambiente de Staging não tinha uma assinatura ativa real para validar o caminho não-vazio ao vivo.

**Consequências:** Nenhuma migração de schema. Nenhum gráfico de tendência nesta fase — documentado como limitação conhecida, não escondido; a proposta é revisitar isto como sub-fase futura assim que `EventLog` acumular alguns meses de eventos `PlanoAlterado` reais.

## ADR-071: Central do Cliente — agregação por empresa, sem model de Ticket novo (Fase 19.7)

**Status:** Aceita · **Fase:** 19.7

**Contexto:** O pedido original de uma "Central de Tickets" esbarra no mesmo limite já registrado no plano aprovado da Fase 19: o produto não tem model de Ticket (thread, SLA, prioridade) — só `PrivateFeedback` (mensagem avulsa). Construir uma fila de tickets de verdade é um projeto de dado novo, maior que uma sub-fase de agregação. A versão honesta: uma segunda aba na ficha da empresa (`/admin/empresas/[id]`) juntando o que já é real — pedidos, feedback, timeline de eventos — sem fingir que existe uma fila de suporte que não existe.

**Decisão:**

1. **Abas na ficha da empresa** — `CompanyDetailTabs` (`company-detail-tabs.tsx`, client, mesmo padrão de `PedidosTabs`) separa "Visão geral" (CRM da Fase 19.4, sem mudanças) de "Central do cliente" (nova): Pedidos da loja (`StoreOrder` filtrado por `companyId`, mesmos `STATUS_LABEL`/`STATUS_TONE` de `admin/pedidos` — nunca uma segunda paleta de status), Feedback privado (`listFeedback()`, serviço já existente da Fase 3) e Timeline (`listRecentEvents()`, já por-empresa desde a Fase 6/ADR-025) dos últimos 30 dias. Header e KPIs (Health Score/Receita/Usuários) continuam fixos acima das abas — contexto de identidade nunca some ao trocar de aba.
2. **Achado real que reduziu o escopo do pedido**: o plano assumia que o campo `resolved` de `PrivateFeedback` "não tinha toggle de escrita" — falso. O `/dashboard` já resolve/reabre feedback via `PATCH /api/feedback/[id]` → `setFeedbackResolved()` (Fase 3), só nunca exposto no Admin (que não tem `requireAuthContext()` para escopar por empresa sozinho). Em vez de duplicar a lógica de update, `FeedbackList` (`components/dashboard/feedback-list.tsx`) ganhou dois props opcionais e retrocompatíveis — `apiBasePath` (default `/api/feedback`) e `showExport` (default `true`) — e uma nova rota fina `PATCH /api/admin/feedback/[id]` (gated por `isSuperAdmin()`) resolve o `companyId` do próprio registro e chama o **mesmo** `setFeedbackResolved()`. Zero lógica de negócio nova.
3. Cada linha de pedido na Central não replica as ações do Kanban (avançar etapa, reembolsar) — um link "Ver na Central de Pedidos" leva para `/admin/pedidos`, onde essas ações já vivem. Nada espalhado, nada duplicado.

**Verificado com dado real de Staging (Bella Vista, empresa mais ativa)**: aba Central mostrou 0 pedidos (honesto — nenhum `StoreOrder` vinculado a esta empresa), 28 feedbacks privados reais com nota/mensagem, e a timeline dos últimos 30 dias com toques/avaliações/trocas de campanha reais. Testado ao vivo o toggle "Resolvido" pela nova rota admin — persistiu após reload da página, revertido depois para não deixar efeito colateral no dado de Staging.

**Consequências:** Nenhuma migração de schema, nenhum model de Ticket. Fica registrado como possibilidade futura (não uma promessa desta fase): se o produto crescer a ponto de precisar de thread/SLA/prioridade de verdade, isso é um projeto de dado novo à parte — não uma extensão incremental de `PrivateFeedback`.

## ADR-072: Modo Executivo — wallboard full-bleed via route group, sem sidebar (Fase 19.8, encerra a Fase 19)

**Status:** Aceita · **Fase:** 19.8

**Contexto:** Última sub-fase da Fase 19 — o plano é explícito: "é composição do que já foi construído, não feature nova". O Admin inteiro vive sob um único `admin/layout.tsx` que sempre renderiza sidebar/header — não existe em Next.js App Router uma forma de uma página filha "sair" do layout do pai sem reestruturar a árvore de rotas.

**Decisão, em três partes:**

1. **Route group `(sidebar)`** — `admin/layout.tsx` (gate `isSuperAdmin()`, aplicado a TODA rota em `/admin/**`, sem exceção) ficou mínimo; todo o chrome antigo (sidebar/header/Command+K/UserButton) virou `admin/(sidebar)/layout.tsx`. Um route group é transparente na URL — `page.tsx`/`pedidos/`/`empresas/`/`conteudo/`/`financeiro/` movidos para dentro dele continuam respondendo em `/admin`, `/admin/pedidos` etc., idênticos a antes. `admin/executivo/page.tsx` nasce como irmã do grupo, não dentro dele — herda só o gate de segurança do layout pai, nunca a sidebar. Zero duplicação do gate: existe em um único lugar.
2. **Zero duplicação de dado/regra de negócio** — as queries e o cálculo dos KPIs/Radar de Atenção de `admin/page.tsx` (Fase 19.2) viraram `getAdminOverviewSnapshot()` (`services/admin-overview.service.ts`); o mesmo para `admin/financeiro/page.tsx` (Fase 19.6) → `getFinanceSnapshot()` (`services/finance.service.ts`). `admin/executivo/page.tsx` chama as duas funções — a mesma fonte de verdade da tela normal, nunca uma segunda cópia das mesmas queries Prisma.
3. **`WallboardMetric`** (`components/admin/wallboard-metric.tsx`) — tile novo (não uma extensão do `KpiCard`, que é `value: string | number`, sem espaço para o `NumberTicker` animado que um wallboard pede), ainda construído sobre `PremiumCardShell` (nunca uma superfície de card própria). `prefers-reduced-motion`: quando ativo, `startValue` do `NumberTicker` vira o próprio valor final — a mola não tem o que animar, sem precisar tocar no componente `NumberTicker` compartilhado (usado também no marketing, onde a animação é sempre desejada). `WallboardClock` é o único outro componente novo — um relógio simples, prova visual de que a tela não travou.

**Por que `className="dark"` na wallboard, não `data-theme`:** o design system usa `@custom-variant dark (&:is(.dark *))` (Tailwind v4) — qualquer descendente de um elemento `.dark` recebe a paleta escura, mesmo que o `<html>` esteja em tema claro. Isso deixa o Modo Executivo sempre escuro, independente da preferência de tema de quem abriu o link (uma parede de sala de operação não deveria mudar de cor por causa do SO de um visitante), sem duplicar nenhum componente: `PremiumCardShell`/`KpiCard`/`AnalyticsCard`/`InsightCardList`/`RankingList` são todos reaproveitados direto, só re-tematizados. `bg-noc-surface`/`--noc-border` (tokens dedicados a telas tipo Mission Control desde a Fase A) continuam existindo desde então sem uso em `/admin` — usados aqui pela primeira vez fora de `/dev/ceo/mission-control`, o precedente direto que confirmou o padrão inteiro (full-bleed, `bg-noc-surface text-white`, sem layout de app).

**Achado real corrigido no caminho (Zero Silent Debt):** `admin/pedidos/page.tsx` tinha um `<h1>` dizendo "Centro de Operações" — um resquício de copiar a estrutura de `admin/page.tsx` na Fase 18, nunca corrigido. Renomeado para "Pedidos da loja", igual ao rótulo já usado no sidebar desde a Fase 19.1.

**Verificado ao vivo em Staging via Dev Runtime**: navegação de ida e volta `/admin` ↔ `/admin/executivo` funcionando (sidebar desaparece/reaparece corretamente); todas as 5 rotas movidas (`/admin`, `/admin/pedidos`, `/admin/empresas/[id]` com as duas abas da Fase 19.7, `/admin/conteudo`, `/admin/financeiro`) continuam idênticas a antes da reestruturação; wallboard renderizou os 6 KPIs + ARR com `NumberTicker` animando de 0 até o valor real, Radar de Atenção com os mesmos 2 alertas reais do Centro de Operações normal, Timeline conectando via SSE ("Ao vivo"), relógio manual ticando.

**Consequências:** Nenhuma migração de schema. Fase 19 (NFC OS Command Center) encerrada — 19.1 a 19.8 completas, em produção.

## ADR-073: Entitlements por plano + Central de Suporte (Fase 20)

**Status:** Aceita · **Fase:** 20

**Contexto:** Auditoria pedida pelo dono do produto (13/09/2026) antes da primeira venda real encontrou dois buracos: (1) os três planos (Starter/Pro/Business) só diferiam por limite de cartões (`canCreateCard`) e por uma única página travada na unha (`dashboard/unidades`) — todo o resto do produto (Analytics completo, Campanhas, Playbooks, Mapa de Mesas, Equipe, API/Webhooks, Branding com domínio próprio) estava liberado pra qualquer plano, inclusive Starter, apesar da copy de vendas prometer diferenciação; (2) não existia nenhum canal do dono de uma empresa cliente para falar com a NFC OS — só o caminho contrário (Central do Cliente do Admin, Fase 19.7).

**Decisão, em duas partes:**

1. **Entitlements por plano** — `PlanFeature` (`lib/plans.ts`): oito capacidades (`campaigns`, `table_map`, `analytics_full`, `csv_export`, `automation`, `multi_branch`, `white_label`, `api_access`), cada uma um `Set` explícito por `PlanType` (nunca uma hierarquia implícita "Pro inclui tudo do Starter + X", que quebraria silenciosamente se um plano precisasse remover algo no futuro — mesmo espírito de `domain/rbac/roles.ts`). `AuthContext` (`lib/auth.ts`) ganhou `plan`, resolvido na MESMA query que já buscava `organizationId` — zero round trip extra, e agora toda rota autenticada pode checar `requirePlanFeature(ctx, feature)` (mesmo formato de `requirePermission`) sem buscar a empresa de novo. Limite de equipe (`teamLimitForPlan`/`canInviteTeamMember`) ficou separado do `Set` de features — é numérico, não binário (Starter tem 1 usuário, não zero).
   - **Enforcement em duas camadas, nunca só uma**: server-side real (`requirePlanFeature` nas rotas de escrita — criar campanha, aplicar recomendação, ligar AutoPilot, criar API key/webhook, exportar CSV; limite de convite dentro do próprio `team.service.ts::inviteMember`, mesmo padrão de `card.service.ts::createCard`) e UI (`PlanUpsell`, componente novo reaproveitando o bloco que já existia hardcoded em `unidades/page.tsx` desde a Fase 18 — nunca esconde o item do menu, sempre mostra o que falta com CTA de upgrade; cadeado no item do sidebar, visibilidade aspiracional em vez de sumir com a opção).
   - **Downgrade nunca quebra o que já existe**: um plano rebaixado não deleta cartões/membros acima do novo limite (mesma filosofia já estabelecida por `canCreateCard`) — só bloqueia criar mais. Uma `ApiKey`/`WebhookEndpoint` já emitida continua funcionando mesmo se a empresa sair do Business depois (só a CRIAÇÃO de uma nova é bloqueada) — quebrar uma integração de terceiro já em produção seria pior que a perda de receita do gate.
   - **Régua final**: Starter = essencial (captura de avaliação + redirect Google, sem campanha customizada); Pro = campanhas, Mapa de Mesas, Analytics Enterprise, CSV, Playbooks, equipe até 5; Business = tudo + múltiplas unidades, marca própria, API/Webhooks, equipe ilimitada.
   - Analytics é o único recurso split por ABA, não por página inteira — "Visão geral"/"Feedbacks privados" continuam no Starter (retirar isso removeria valor já entregue a quem já paga, sem ganho comercial nenhum); só "Enterprise" (KPIs executivos/funil/ROI/rankings) é Pro+, e as 7 queries daquela aba nem rodam quando o plano não inclui a feature.
2. **Central de Suporte** — novo model `SupportRequest` (sem thread/SLA/prioridade, mesma decisão já tomada pra `PrivateFeedback` na Fase 19.7: uma fila de tickets completa é projeto à parte). Nova página `/dashboard/suporte` (formulário + histórico, disponível a QUALQUER plano — pedir ajuda não é uma feature paga) publica em `SupportRequest`; a Central do Cliente do Admin (Fase 19.7) ganha uma seção nova mostrando os chamados daquela empresa com um seletor de status (`OPEN`/`IN_PROGRESS`/`RESOLVED`). Chamados abertos há mais de 24h sem resposta viram um novo tipo de insight no Radar de Atenção (`buildAttentionRadar`, `services/admin-overview.service.ts`) — nunca uma tabela que só existe se alguém lembrar de olhar.

**Verificado ao vivo em Staging via Dev Runtime, nos três planos** (usuários reais semeados, um por tier): Starter — sidebar com cadeado em 6 itens, `/dashboard/campaigns`/`/dashboard/table-map`/aba Enterprise mostrando `PlanUpsell` corretamente, convite de equipe bloqueado com 403 e mensagem amigável (empresa já tinha 2 membros pré-existentes acima do novo limite de 1 — confirmando que downgrade não quebra o que já existe). Pro — mesmos itens destravados, Unidades/Desenvolvedores/Branding continuam com cadeado. Central de Suporte testada ponta a ponta: formulário cria o chamado, aparece na Central do Cliente do Admin, troca de status via Select persiste após reload.

**Consequências:** Migração aditiva (`SupportRequestStatus` enum + `SupportRequest`), aplicada em Staging e Produção. Nenhuma regressão nos planos que já eram Business hoje — continuam com tudo liberado, exatamente como antes desta fase.

## ADR-074: Fluxo de venda cruzada plano ↔ cartão físico (Fase 21)

**Status:** Aceita · **Fase:** 21

**Contexto:** Auditoria do funil de conversão (13/09/2026) encontrou dois becos-sem-saída, apesar do checkout combinado (assinatura + cartão físico numa única sessão Stripe) já existir e funcionar desde a Fase 18 (`POST /api/billing/checkout`, aceita `cardProductId` opcional, cria `StoreOrder{orderType:"CARD_PLUS_SAAS"}`): (1) clicar "Assinar Pro" na home levava a um `/sign-up` genérico que esquecia o plano escolhido, forçando escolher de novo em `/onboarding/plan` — onde o único aviso sobre precisar de um cartão físico era um bloco "(opcional)" em texto simples, nunca um link; (2) comprar um cartão avulso na Loja (convidado, sem conta) nunca mencionava a existência de um plano — a própria copy da Loja dizia o oposto ("sem precisar assinar o software") — e `/loja/sucesso` não tinha nenhuma menção a upgrade, deixando a única pista escondida dentro de `/meu-cartao/[editToken]`, um clique além de onde o comprador realmente estava.

**Decisão:** Nenhum checkout novo — só conectar os dois pontos de entrada reais (home e Loja) ao que já existe, carregando a intenção do visitante (`?plan=`/`?cardProductId=`) através de 4 saltos via query params (`pricing.tsx` → `/sign-up` → `/onboarding` → `/onboarding/plan`), sempre validados contra `PLANS`/`STORE_PRODUCTS` antes de entrar na URL, nunca em `localStorage` (evita estado que se perde num refresh). Nenhum passo auto-submete — é sempre pré-seleção visual, clique explícito continua obrigatório (ação paga).

- **`plan-selector.tsx`**: o add-on de cartão físico deixa de ser "(opcional)" escondido — quem chega sem nenhum cartão já vê o pacote "Mais popular" pré-selecionado (`hasExistingCards ? null : "pack-20"`, verificado via `prisma.nFCCard.count()` direto na página); quem já é um convidado promovido (`claimGuestCompany`, sempre tem ≥1 cartão) começa em "Nenhum". O plano vindo por parâmetro ganha o badge "Recomendado para você", sobrepondo o `highlighted` estático do plano quando são planos diferentes.
- **Loja → assinatura**: um link de texto dentro do `PurchaseDialog` ("Assine com este cartão incluso →") desvia o visitante do checkout avulso (`/api/store/checkout`, `mode:"payment"`, sem `Company`/`User`) direto pro fluxo combinado, carregando o produto já escolhido — zero duplicação de lógica Stripe.
- **`/loja/sucesso`**: convidados agora veem um bloco de upgrade real, explicando que o cadastro com o MESMO e-mail já promove a empresa automaticamente (`claimGuestCompany`, até aqui 100% invisível na UI) — nunca precisa comprar o cartão de novo.
- **`UpgradePitchCard`** (`components/upgrade-pitch.tsx` + `lib/upgrade-pitch.ts`) — um só texto/lista de features (derivado de `PLANS`, nunca retipado à mão), reaproveitado em `/loja/sucesso` (novo) e `meu-cartao-form.tsx` (retrofit, que também teve seu link corrigido de `/onboarding/plan` — que bateria de volta pro `/onboarding` vazio pra quem não tem sessão — para `/sign-up?plan=STARTER`, o caminho que de fato aciona `claimGuestCompany`).

**Escopo deliberadamente fora**: misturar assinatura em `/api/store/checkout` (rota pública sem `Company`/`User` — forçar isso quebraria a compra-só-do-cartão, uma vantagem competitiva hoje); qualquer "carrinho" persistido no backend (tudo stateless via URL); pré-preencher o e-mail no `<SignUp>` do Clerk (não verificado se a versão instalada suporta — cai num texto explicativo, nunca bloqueia).

**Achado real corrigido no caminho**: pluralização errada ("cartãos" em vez de "cartões") na primeira versão da copy do add-on, pega em teste ao vivo antes do deploy.

**Verificado ao vivo em Staging via Dev Runtime**: `/onboarding/plan` com `?plan=BUSINESS&cardProductId=pack-20` mostrou o pacote certo pré-selecionado e o badge "Recomendado para você" no Business (não no Pro, que é o `highlighted` padrão — confirma que o override funciona independente do destaque estático); sem parâmetro nenhum, uma empresa com 51 cartões reais mostrou "Nenhum" pré-selecionado e a contagem certa; o link `/loja` (antes texto solto) confirmado como link de verdade; o link de upsell dentro do `PurchaseDialog` da Loja gerou a URL exata esperada (`/sign-up?plan=STARTER&cardProductId=pack-20`); `/loja/sucesso` e `/meu-cartao/[editToken]` testados com um pedido `GUEST` real semeado propositalmente (removido depois do teste) — o bloco de upgrade renderizou com o e-mail certo e o link certo nos dois. `/sign-up` em si não é testável via Dev Runtime (o `<ClerkProvider>` nunca monta nesse modo, `useSession` exige — limitação preexistente, não uma regressão desta fase); a correção de string aplicada ali é simples o bastante para confiar na verificação de tipo (`tsc`).

**Consequências:** Nenhuma migração de schema, nenhum checkout novo. Toda a mudança é fiação de UI/parâmetros sobre infraestrutura que já existia e já funcionava.

## ADR-075: Remoção da decisão por nota e do que o site prometia sobre isso (Pulse, C1)

**Status:** Aceita · **Fase:** 22 (Pulse Starter First, ciclo C1)

**Contexto:** A auditoria de 25/09/2026 encontrou que o fluxo público de avaliação ramificava por sentimento: `services/rating.service.ts` entregava o link do Google só para 4 ou 5 estrelas (`GOOGLE_REDIRECT_THRESHOLD = 4`) e mandava as demais para um formulário privado, sem link do Google. O site anunciava isso ("Avaliações de 1 a 3 estrelas nunca chegam ao Google"), o texto do onboarding repetia a faixa, e havia depoimentos com nome e resultado sem prova de cliente real. A política do Google para avaliações proíbe selecionar quem pode avaliar ou criar obstáculos para avaliações negativas; um SaaS que repete o mesmo padrão em todos os seus clientes é o caso mais fácil de detectar.

**Decisão:**
- **Mesmo caminho para todos.** `createRating` devolve sempre `{ ratingEventId, googleReviewUrl }`, qualquer que seja a nota. A tela pós-nota (`rating-flow.tsx`) mostra os mesmos dois botões, na mesma ordem e com o mesmo texto: "Avaliar no Google" e "Falar com a gente". A nota vira dado interno.
- **Impossível ramificar por construção.** `domain/rating/public-result.ts` não recebe a nota como argumento.
- **Guarda automática.** `domain/rating/sem-ramificacao-por-nota.test.ts` lê o código do fluxo público e falha se aparecer limiar, comparação relacional com a nota, ou os resultados `outcome: "google" | "feedback"`; e lê o site e falha se voltar a promessa de filtro ("nunca chegam ao Google", "1 a 3 estrelas", "só as boas", "avalie e ganhe"). Verificado com controle negativo: as expressões pegam o código e os textos antigos.
- **"Falar com a gente" aberto a todos.** A página `/feedback` deixa de ser "Sentimos muito por isso" (só fazia sentido para nota baixa) e passa a um texto neutro.
- **Copy e depoimentos.** Hero, FAQ, título do site, texto do onboarding e descrições internas reescritos para descrever o que o produto faz hoje. A seção de depoimentos foi removida até existir depoimento real com autorização; o componente sai do repositório (o histórico do Git preserva o texto).
- **Páginas legais.** `/termos` e `/privacidade` em versão preliminar (aviso explícito no topo), descrevendo os dados que o produto realmente trata; o texto das regras de uso proíbe filtrar avaliações e oferecer benefício por avaliação. Links no rodapé, no cadastro e na compra.

**Escopo deliberadamente fora:** a pergunta de estrelas em si continua nesta fase (decisão D1 já assumida: remover no ciclo C6, junto com o Retorno, porque a mensagem "Falar com a gente" ainda depende de `RatingEvent` até o schema ganhar `PrivateFeedback.visitId`); as métricas que dependem de estrelas (saúde da conta, radar do admin, funil, insights) só são migradas no ciclo C9; o texto legal ainda precisa de razão social, CNPJ, encarregado e revisão jurídica.

**Verificado:** `tsc`, `eslint` e `vitest` (98 testes) limpos; em Staging via Dev Runtime, o fluxo `/r/[code]` com 1 e com 5 estrelas mostra texto e botões idênticos; "Avaliar no Google" registra o clique e "Falar com a gente" leva ao formulário e ao envio (cartão de teste criado e removido do Staging).

**Consequências:** A interface pública passa a ser compatível com a política. As análises internas continuam usando a nota como dado (não como decisão).

## ADR-076: Endereço do cartão para sempre + QR sob demanda (Pulse, C2)

**Status:** Aceita · **Fase:** 22 (Pulse Starter First, ciclo C2)

**Contexto:** A URL gravada no chip NFC e impressa no QR (`<domínio>/r/<código>`) é permanente: cartão entregue não volta para ser regravado. A auditoria de 26/09/2026 encontrou três problemas: (1) a URL nascia de `NEXT_PUBLIC_APP_URL`, a mesma variável do app, e era montada em pelo menos cinco lugares (`cardPublicUrl` em `lib/qrcode.ts`, duas rotas do Admin com `${process.env.NEXT_PUBLIC_APP_URL}/r/${code}` escrito à mão, o seed e os serviços); nada impedia gravar chips com o endereço provisório `*.vercel.app`; (2) o QR era gerado como PNG em data URL (~8 KB) e **gravado em `NFCCard.qrCodeUrl`** em quatro pontos (`createCard`, `duplicateCard`, provisionamento da loja, seed): inviável com milhões de cartões e, pior, amarrava cada QR ao domínio de quando o cartão foi criado; (3) a tela de cartões embutia esses data URLs no HTML.

**Decisão:**
- **Endereço do cartão é decisão própria.** `NEXT_PUBLIC_CARD_BASE_URL` (com queda para `NEXT_PUBLIC_APP_URL`, para nenhum ambiente existente quebrar). `domain/card-url/classify.ts` (puro) classifica o endereço em `final` (https em domínio próprio), `provisional` (`*.vercel.app` e afins, ou http), `local` ou `invalid`; `lib/card-url.ts` (seguro para o navegador) expõe `cardPublicUrl`, `cardQrPath` e o guarda.
- **Guarda por ambiente.** Com `CARD_URL_REQUIRE_FINAL=1` (ligar em produção antes do primeiro lote), endereço não definitivo **bloqueia** o que sai para o mundo físico: a URL de chip no Admin (`publicUrl: null` + aviso vermelho, cópia recusada), o QR (`/api/qr/[code]` responde 503) e o PDF de impressão (`assertCardUrlReady`). **Não bloqueia** o pagamento nem o provisionamento: o cliente que já pagou não é penalizado por uma configuração nossa. Sem a variável, tudo funciona como antes (staging, desenvolvimento), e o Admin só avisa (âmbar).
- **Radar de Atenção.** Novo alerta `card-url` quando o endereço não é definitivo **e** há pedido pago em produção (sem pedido, ninguém está gravando chip e o alerta seria ruído).
- **QR sob demanda.** `GET /api/qr/[code]` gera PNG ou SVG na hora, sem banco: o QR é função pura do código e do endereço do cartão, e a mesma URL já está impressa no cartão. Tamanhos fixos (128/256/512/1024, não intervalo livre, para o cache não explodir), `download=1` para baixar, cache de 1 h no navegador e 1 dia no CDN (mudança de domínio aparece em até um dia). A tela de cartões usa `<img loading="lazy">` (verificado: com 51 cartões só os visíveis são baixados) e mostra "QR indisponível" se a rota recusar, em vez de imagem quebrada.
- **Um só lugar monta a URL.** `domain/card-url/endereco-unico.test.ts` lê o código-fonte e falha se alguém montar `/r/${…}` fora de `joinCardUrl`, voltar a gravar `qrCodeUrl`/`generateQrCodeDataUrl`, ou ler `process.env.NEXT_PUBLIC_CARD_BASE_URL` fora de `lib/card-url.ts`.
- **Coluna `qrCodeUrl` fica, marcada como legado.** Deixou de ser gravada e lida; remover a coluna é migração de contração e entra na F10, depois do deploy que para de escrevê-la (expandir → trocar → contrair).

**Regra operacional (a que mais custa se quebrada):** depois do primeiro lote, **nunca remover o domínio antigo da Vercel** — ele segue respondendo aos chips já entregues. Mudar o domínio depois disso só troca o que vai nos cartões novos e nos QRs gerados dali em diante. Documentado em `DEPLOY_SETUP.md` e `.env.example`.

**Escopo deliberadamente fora:** cor/identidade do QR (marca Pulse, C3); QR de marca própria do Business (`generateBrandedQr*`) continua como está, só passou a usar `cardPublicUrl` e o guarda; encurtador/redirecionador próprio para trocar o destino do chip sem regravar (o `/r/[code]` já cumpre esse papel).

**Verificado:** `tsc`, `eslint`, `vitest`, `prisma validate` e `next build` (ver o relatório do ciclo); em Staging via Dev Runtime: `/api/qr/<código>` devolve PNG (3,3 KB em 512 px), SVG e download com nome de arquivo, 404 para código malformado e 400 para tamanho fora do contrato; a tela de cartões renderiza os QRs sob demanda e só carrega os visíveis; com um pedido pago de teste (removido depois), o detalhe do pedido mostra o aviso âmbar e o radar mostra o alerta; reiniciando com `CARD_URL_REQUIRE_FINAL=1`, as duas rotas do Admin devolvem `publicUrl: null`, o QR responde 503, o painel mostra o aviso vermelho e "endereço bloqueado" no lugar das URLs. **Não verificado:** decodificação real do QR com leitor (a igualdade entre o texto codificado e a URL está coberta por teste: o SVG muda com o domínio e com o código e é estável com os mesmos); gravação de um chip NFC físico.

**Consequências:** Antes do primeiro lote, a ação humana é definir o domínio final e ligar as duas variáveis em produção. Cartões antigos continuam funcionando (a coluna não foi apagada); os QRs deles passam a sair do endereço atual do cartão.

## ADR-077: Marca Pulse, tokens de design e fim dos efeitos decorativos na home e na loja (Pulse, C3)

**Status:** Aceita · **Fase:** 22 (Pulse Starter First, ciclo C3) · Substitui em parte o ADR-059 (visual da home e da loja)

**Contexto:** O produto ainda se apresentava como "NFC Review Pro" e "NFC OS" em telas, metadados, e-mail, PDF, planilha e nome do produto no Stripe, com paleta violeta/índigo, fonte Geist e efeitos decorativos (fundo aurora, brilho que segue o cursor, varredura de cor no título, feixe na borda do botão, partículas). A marca escolhida é Pulse (logo sobre fundo preto): precisão, calma e um único destaque. O ADR-059 tinha canonizado justamente esses efeitos como "a régua do projeto". **Conflito nomeado e decidido pelo dono (Ilan), em pergunta única neste ciclo:** sóbrio na home e na loja; o catálogo do ADR-059 continua valendo para o Admin e o wallboard.

**Decisão:**
- **Uma fonte do nome.** `lib/brand.ts` (`BRAND`, `pageTitle`, `copyright`) é a única fonte do nome, da frase-âncora e das cores em hex de quem vende o produto (não confundir com `BrandConfig`, a marca da empresa cliente, White Label). Nome trocado em telas, metadados, manifesto, ícone e imagem social do domínio raiz, e-mail transacional (cabeçalho e paleta), PDFs, planilha, Stripe (nome do item), demo e páginas de desenvolvedor.
- **Guarda da marca.** `domain/brand/sem-nome-antigo.test.ts` lê o código (sem comentários) e falha se "NFC OS" ou "NFC Review Pro" voltarem a aparecer em código de interface. Controle negativo verificado.
- **Frase-âncora só afirma o que existe hoje.** `BRAND.tagline` continua "Um toque leva o cliente até a avaliação no Google". "Faça cada cliente voltar" entra quando o Retorno existir (F6); um teste impede que a frase-âncora cite voltar/brinde/retorno antes disso.
- **Paleta.** Grafite `#16191C` (texto e estrutura), grafite médio `#4A4F55`, âmbar `#C9741A` como único acento (`#F2A04D` no escuro), neutros levemente frios. Tokens em hex em `globals.css`, claro e escuro. Botão primário = âmbar com texto grafite (5,0:1; no escuro 8,3:1).
- **`--brand-ink`.** O âmbar puro só dá 3,5:1 sobre branco, insuficiente para texto. Todo `text-brand` (37 usos) e `text-primary` (botão/badge "link") passou a `text-brand-ink` (`#93520D`, 6,1:1 no claro; no escuro é o próprio âmbar). O âmbar puro fica para preenchimento e ícone.
- **Guarda de contraste.** `domain/brand/tokens.test.ts` lê `globals.css` e confere AA (4,5:1) em 16 pares de texto, nos dois modos, e que as cores de `lib/brand.ts` são as mesmas do CSS.
- **Tipografia.** Títulos em Bricolage Grotesque, texto em Instrument Sans, códigos e números em IBM Plex Mono (`next/font`, subconjunto latino, `display: swap`), no lugar de Geist. `h1` a `h3` usam a fonte de títulos.
- **Sem efeitos decorativos na home, loja e entrada.** Saíram: fundo aurora, brilho de cursor, botão magnético, varredura de cor no título, feixe de borda (hero, CTA final, preços, seletor de plano, loja), partículas e ruído (CTA e tela de entrada), contagem animada dos números do bento. Ficou só o fade de entrada, que agora respeita "reduzir movimento" (`BlurFade` renderiza o conteúdo direto). O CTA final virou um bloco escuro chapado com um botão âmbar.
- **Números de exemplo rotulados.** O bento da home mostrava 1.284, 68,0% e R$ 4.820 como se fossem resultado; agora dizem "Exemplo ilustrativo" e "(exemplo)".
- **Wordmark provisório.** `BrandWordmark` (texto "Pulse" + ponto âmbar) no cabeçalho, rodapé e entrada, até o logo final em SVG existir (ação humana). Ícone e imagem social do domínio raiz: grafite com a inicial em âmbar; empresa com marca própria continua com as cores dela.
- **Página de referência.** `/dev/design-system` (atrás do mesmo portão de `/dev`): paleta, contraste calculado, tipografia, botões, badges, cartão, campo e tabela, com o botão de tema.
- **Cores soltas.** QR padrão, filete/borda do PDF de analytics, cores de severidade "neutra" e o mockup do cartão saíram do índigo/azul-ardósia para a paleta.

**Escopo deliberadamente fora:** ticket do brinde (não existe até o C6); texto e estrutura da home (F6); logo final, favicon e imagem social definitivos (dependem do arquivo do logo); nomes públicos da API/SDK (`NfcOsClient`, prefixo das chaves) e o domínio do remetente de e-mail: contratos e configuração externa, decididos com a API pública (F6/F7) e a conta do Resend; as telas de entrada (`/sign-in`, `/sign-up`) não renderizam no Dev Runtime, então só foram verificadas por tipo e build.

**Verificado:** `tsc`, `eslint`, `vitest` (ver relatório do ciclo), `prisma validate` e `next build` limpos. Em Staging via Dev Runtime: home, loja, termos, painel do cliente e a página de referência com a nova paleta em claro e escuro; as três fontes carregadas (`document.fonts`); nenhum elemento com texto em âmbar puro; nenhum canvas na home; sem rolagem horizontal em 375 px. Primeira carga de JS da entrada (`/sign-up`) caiu de 332 kB para 223 kB, e a página da home de 17,2 kB para 10,4 kB. **Não verificado:** pontuação de acessibilidade do Lighthouse (não medida; a meta de 95 do plano segue aberta), contraste de bordas e campos (WCAG 1.4.11; o teste cobre só texto), leitor de tela, iPhone/Android reais.

**Consequências:** Toda tela nova nasce em Pulse pelos tokens. Os componentes de efeito ficaram no repositório sem consumidor (`DiaTextReveal`, `Particles`, `Meteors`, `NoiseTexture`, `AuroraBackground`, `CursorGlow`, `MagneticButton`, `GlassPremiumCard`) e serão apagados na limpeza final (F10) se o Admin não os adotar. Reverter o visual é um commit: a mudança está isolada em tokens e nos componentes citados.

## ADR-078: Retorno, o brinde de próxima visita — modelo de dados e regras puras (Pulse, C4)

**Status:** Aceita · **Fase:** 22 (Pulse Starter First, ciclo C4)

**Contexto:** O material comercial do Starter ("Faça cada cliente voltar") e o documento técnico do Retorno definem o produto: o cliente encosta o celular, ganha um brinde para a próxima visita (sem aplicativo, cadastro ou telefone), volta e resgata com um código mais o PIN da loja, e o dono vê três números (toques, brindes emitidos, clientes que voltaram e resgataram). Nada disso existia no banco nem no código. Também não existia como uma mensagem privada existir sem a pergunta de nota (`PrivateFeedback.ratingEventId` era obrigatório), o que o "Falar com a gente" aberto a todos exige.

**Decisão:**
- **Dados (migração só de expansão, `20260927120000_retorno_fundacao`).** `RewardOffer` (uma por empresa: título, janela, carência, hash do PIN, botão principal, teto diário, pausa) e `Voucher` (código único por empresa, aparelho, cartão, visita, texto guardado na emissão, status, liberação, validade, resgate, anulação). Colunas novas: `Visit.visitorId` (cookie `pv`), `PrivateFeedback.visitId` e `ratingEventId` opcional, `Campaign.origin` (`USER`, `SYSTEM_DIRECT`, `SYSTEM_RETURN`), `Company.subscriptionStatusChangedAt` (para a tolerância e a leitura depois de cancelar, C5), `Company.returnPilotEnabled` (piloto, começa desligado) e `SiteSettings.returnOfferEnabled` (interruptor geral, começa ligado). Limites repetidos como CHECK no banco (janela de 1 a 90 dias, carência de 0 a 365, teto positivo). O redirecionamento inicial do avulso já criado passa a `SYSTEM_DIRECT` (preenchimento idempotente), e o provisionamento novo grava a origem. Aplicada só no **Staging**; a produção espera a sua aprovação, com snapshot antes.
- **Regras puras em `domain/return-offer`** (sem I/O, com testes):
  - **Código**: 6 caracteres de um alfabeto de 28, sem vogais e sem 0, 1, I, L, O (nunca forma palavra, nunca confunde na leitura), sorteio sem viés, mostrado como `K7X-4QM`; aceita minúsculas, espaços e hífen ao digitar.
  - **Janela**: libera no dia seguinte no fuso da empresa e vale N dias corridos contando o dia da liberação (emitido em 25/09 com 14 dias: libera em 26/09, vale até 09/10). Fuso por `Intl`, sem biblioteca; testado com São Paulo, Nova York (horário de verão) e Índia (meia hora).
  - **Vencimento na leitura**: a fase do brinde sempre confere `expiresAt`; um brinde vencido nunca resgata, mesmo que a limpeza periódica não tenha rodado.
  - **A cada toque** (`decideOnTouch`): brinde ativo → só mostra; senão, carência de 30 dias desde a última emissão → espera (diz quando volta); senão, teto diário; senão, emite. Brindes anulados não contam para nada.
  - **PIN**: 4 dígitos, recusa PIN fraco (0000, 1111, 1234, 4321…), limite de 5 falhas por janela deslizante de 10 minutos.
  - **Disponibilidade** (`offerAvailability`): uma função só, na ordem de quem manda (interruptor geral, piloto, plano, pausa do dono, PIN), usada pela tela, pelo painel e pelo serviço.
  - **Recusa de resgate** (`explainRedeemFailure`): código inexistente, já resgatado, vencido, ainda não liberado, anulado.
- **Mensagem sem nota.** Onde o código lia a nota da mensagem (lista do painel, exportação CSV, feed ao vivo), agora tolera a ausência; o contexto da mensagem sem nota vem da visita.
- **Parâmetros dos materiais aplicados:** carência de 30 dias, janela padrão de 14, PIN de 4 dígitos, liberação no dia seguinte, um brinde ativo por aparelho. Decisões D3, D4 e D9 do plano.

**Escopo deliberadamente fora deste ciclo:** serviços, rotas, hash do PIN, limites de taxa, eventos e auditoria, tier efetivo e cobrança (C5); telas públicas e painel (C6, C7); estatísticas (C9). Sem nenhuma dessas peças o Retorno ainda não aparece para ninguém: nada do que existe hoje muda de comportamento.

**Verificado:** `prisma validate`, `migrate deploy` no Staging (10 migrações, banco em dia), `tsc`, `eslint`, `vitest` e cobertura do domínio (`npm run test:coverage`): `return-offer` com 100% das linhas e 98,8% dos ramos. Teste de schema lê `schema.prisma` e a migração e falha se o código único, a configuração única, os limites no banco ou o caráter só de expansão forem afrouxados. **Não verificado:** a migração em produção (não aplicada, por decisão); o resgate simultâneo contra um banco real (é o teste do C5, que já tem o serviço).

**Consequências:** Toda tabela nova nasce vazia e nenhum código antigo depende dela, então reverter é só não usar. Ao aplicar em produção, fazer o snapshot documentado em `DEPLOY_SETUP.md` antes. A coluna `ratingEventId` opcional é compatível com o código antigo (só relaxa uma restrição).

## ADR-079: Retorno, o backend — acesso efetivo, serviços, rotas e proteções (Pulse, C5)

**Status:** Aceita · **Fase:** 22 (Pulse Starter First, ciclo C5, fecha a F3)

**Contexto:** O C4 deixou o modelo de dados e as regras puras. Faltava tudo o que faz o Retorno existir de verdade: emitir o brinde no toque, consultar e resgatar com PIN sem sessão, o dono configurar, o Admin liberar e desligar, e o acesso ao painel depender da assinatura (o plano já apontava dois buracos: o painel abria sem assinatura, e cancelar derrubava a empresa para o plano Starter em vez de restringir o acesso).

**Decisão:**
- **Acesso efetivo** (`domain/billing/effective-tier`, puro): tipo de conta e estado da assinatura do Stripe viram um de cinco estados. Sem assinatura (avulso ou cadastro sem pagar): sem painel. Ativa: tudo. Cobrança atrasada: 7 dias de tolerância com tudo funcionando e aviso, depois só leitura. Cancelada: 90 dias só de leitura (vê os dados, não altera nada, não emite brinde novo), depois bloqueio até reativar. Estado desconhecido cai para leitura, nunca para bloqueio: erra para o lado de não trancar quem paga. `Company.subscriptionStatusChangedAt` (escrito só pelo webhook, e só quando o status muda de fato, para uma troca de plano não reiniciar o relógio de uma cobrança atrasada) é o relógio. `AuthContext.access` traz o resultado na mesma query de sempre.
- **Porteiro do painel atrás de uma variável:** `BILLING_GATE_ENFORCE=1` faz o painel exigir assinatura, redirecionando para a escolha de plano, e mostra o aviso de tolerância ou leitura. Desligado por padrão e nunca no Dev Runtime, para uma regra nova não trancar por surpresa quem já usa. Ligar em produção é um passo do lançamento.
- **Retorno em três camadas de liberação**, numa função só (`offerAvailability`): interruptor geral (Admin, na hora, sem deploy), piloto por empresa (Admin; começa desligado) e plano/assinatura/PIN/pausa. O resgate continua permitido depois de cancelar ou pausar (é uma promessa já feita ao cliente); só o interruptor geral o interrompe.
- **Toque** (`POST /api/visits`, estendida): o cookie `pv` (aleatório, definido pelo servidor, HttpOnly, SameSite=Lax, 400 dias) só nasce se a empresa tem o Retorno de pé; um cartão sem brinde não deixa marca no celular. A emissão roda dentro de uma transação com lock por aparelho (e por empresa quando há teto diário), então toques simultâneos não emitem dois brindes nem passam do teto. Qualquer falha vira "sem brinde": o caminho do cliente até o destino nunca depende do Retorno.
- **Consulta e resgate públicos** (`POST /api/vouchers/lookup`, `/redeem`): sem sessão; quem autoriza o resgate é o PIN. Limite de taxa por IP; falhas de PIN por brinde (5 em 10 minutos) e por empresa (20 em 10 minutos), em Redis com queda para a memória, com o PIN correto também bloqueado durante o bloqueio. Resgate é um único UPDATE condicionado ao estado (emitido, já liberado, dentro da validade): dois resgates simultâneos do mesmo brinde disputam a linha e passa exatamente um.
- **PIN**: 4 dígitos, sem PINs fracos (0000, 1111, 1234…), guardado como scrypt com sal aleatório sobre um HMAC com o segredo do servidor (`RETURN_PIN_SECRET`, obrigatório em produção; sem ele o serviço falha em vez de usar um valor padrão). Sem o segredo, quem tivesse o banco quebraria os 10 mil PINs offline. O valor nunca volta em resposta, nunca vai para a auditoria e nunca para um evento.
- **Texto do brinde sem citar avaliação:** título e descrição que falem de avaliar, review, Google, estrelas ou elogio são recusados no servidor. Oferecer benefício por avaliação é proibido pelo Google.
- **Gestão do dono** (`/api/return/*`): configuração, PIN, lista de brindes, anulação com motivo e os números (toques, emitidos, resgatados e o passivo em aberto). Permissão nova `return:manage` (OWNER, ADMIN); ler é implícito para qualquer papel, como no resto do painel. Recursos `return_offer` e `messages_inbox` nos três planos. Tudo registrado na auditoria; eventos `BrindeEmitido`, `BrindeResgatado`, `BrindeAnulado` sem o código do brinde.
- **Convivência com campanhas** (`decideCardExperience`): o Retorno só entra quando está de pé e nunca atropela o que o dono montou (uma campanha criada por ele, do Pro, sempre vence). O redirecionamento inicial do cartão avulso (campanha do sistema) passa a ceder lugar à tela do Retorno, com o destino da compra como botão principal: é a conversão no lugar ao assinar o Starter, sem recriar cartão nem perder o que o dono escolheu, e reversível pelo interruptor. O motor de resolução agora expõe a origem da campanha.
- **Admin:** dois controles, o piloto por empresa (na ficha da empresa) e o interruptor geral com confirmação (em Conteúdo do site).

**Escopo deliberadamente fora:** as telas do cliente e do atendente (C6), o painel do dono (C7), o cadastro de "Falar com a gente" sem nota (C6), as métricas do dicionário (C9), a venda fora do site e o estoque (J8, registrado), o bloqueio das escritas legadas do painel em modo só leitura (registrado; hoje o cancelamento ainda rebaixa `Company.plan` para Starter pelo webhook, o que segura os limites, e a leitura restrita vale para tudo do Retorno).

**Verificado (saídas reais no relatório do ciclo):** `tsc`, `eslint`, `vitest`, `prisma validate`, `next build`; cobertura do domínio; teste de integração contra o **Staging** com uma empresa de teste (criada e apagada): 200 brindes simultâneos com 200 códigos distintos; **25 resgates simultâneos do mesmo brinde, exatamente 1 sucesso**; brinde não liberado e brinde vencido (ainda ISSUED no banco) nunca resgatam; **12 toques simultâneos do mesmo aparelho, 1 brinde emitido e 11 mostrados, 1 linha no banco**; carência de 30 dias depois do resgate; **teto diário de 5 com 12 aparelhos simultâneos: exatamente 5 emitidos**. Ao vivo pelas rotas reais no Staging (Dev Runtime): título citando avaliação recusado; ativar sem PIN recusado; PIN fraco recusado; toque emite e o segundo toque só mostra o mesmo código; consulta pelo código digitado em minúsculas e com espaço; resgate antes de liberar recusado; erro de PIN com contagem regressiva (4, 3, 2, 1, 0) e, na sexta tentativa, o PIN correto também bloqueado; resgate bem-sucedido, segundo resgate recusado, novo toque cai na carência; anulação; interruptor geral (emissão devolve nada, resgate 503); piloto desligado e ligado; assinatura cancelada há 10 dias: só leitura, alterações recusadas com 402, sem brinde novo. Auditoria e eventos conferidos no banco (sem PIN nem código). Dados de teste apagados e a empresa de demonstração restaurada. **Não verificado:** o cookie no Safari do iPhone real; o comportamento com Redis de verdade (o Staging local usou a memória); o porteiro do painel com `BILLING_GATE_ENFORCE=1` fora do teste unitário; carga.

**Consequências:** Antes do piloto: definir `RETURN_PIN_SECRET` em produção (senão trocar o PIN falha de propósito) e aplicar as duas migrações do Retorno em produção (com snapshot). Trocar o segredo depois de haver PINs invalida todos. Ligar `BILLING_GATE_ENFORCE=1` fica para o lançamento.

## ADR-080: Experiência pública do cartão sem estrelas, com os 16 estados do Retorno (Pulse, C6)

**Status:** Aceita · **Fase:** 22 (Pulse Starter First, ciclo C6, fecha a F4)

**Contexto:** O C5 deixou o Retorno funcionando por trás das rotas, mas a tela pública do cartão (`/r/[code]`) ainda era a `RatingFlow` da ADR-075 (nota de 1 a 5, depois "Avaliar no Google" ou "Falar com a gente"): sem código, sem brinde, sem PIN, sem os 16 estados do plano (seção J4). `PrivateFeedback` também exigia uma `RatingEvent`, então "Falar com a gente" não podia existir sem perguntar nota. E dois achados do plano seguiam abertos: o contador de toques do link pessoal do avulso tendia a mostrar zero, e esse link virava 404 depois que o dono assinava.

**Decisão:**
- **Uma tela, dois modos, nunca uma terceira coisa.** `decideCardExperience` (domínio puro) escolhe entre `RETURN` (o brinde aparece), `CAMPAIGN` (uma campanha do próprio dono, que sempre vence) e `BUTTONS` (só os dois botões — Retorno pausado/sem PIN, fora do piloto, plano sem o recurso, ou interruptor geral desligado). O botão principal e "Falar com a gente" ficam fora de qualquer condicional do estado do brinde: aparecem sempre, na mesma ordem, com o mesmo texto — nenhuma falha do Retorno pode escondê-los. `primaryButtonLabel` deriva o texto do botão do domínio do link ("Avaliar no Google", "Ver no Instagram", "Falar no WhatsApp"…), nunca hardcoded por tipo de campanha.
- **Conversão no lugar ao assinar.** Quando a campanha vencedora é o redirecionamento inicial do avulso (`origin: SYSTEM_DIRECT`) e o Retorno está de pé, a tela do Retorno assume no lugar, com aquele destino como botão principal — sem recriar cartão, sem perder o que o dono escolheu. Desligar o Retorno devolve o redirecionamento direto.
- **Os 16 estados (J4), catalogados e testados.** `domain/return-offer/public-screen.ts` traduz a resposta do servidor em uma de 9 telas (`TouchScreen`) e o texto de cada uma (`screenCopy`), puro e sem I/O; `PUBLIC_STATES` é a lista dos 16, com onde e como cada um é tratado (tela, servidor ou ambiente) — um teste garante que os 16 existem, numerados, sem buraco. A tela React (`card-screen.tsx`, `voucher-panel.tsx`, `redeem-panel.tsx`, `code-entry.tsx`) só desenha o que o domínio decidiu.
- **Código do brinde, copiar e compartilhar.** `useCopy` tenta a área de transferência moderna e cai para `execCommand` (navegador embutido do Instagram/WhatsApp, estado 13); sem nenhuma das duas, mostra "toque e segure para copiar" em vez de falhar em silêncio. "Enviar para mim" usa o menu nativo de compartilhar quando existe, e um link `wa.me` como alternativa.
- **Resgate com o PIN**, na própria tela, com a entrada do PIN escondida e o erro mostrando as tentativas restantes ou o horário do desbloqueio — os mesmos dados que a API já devolvia desde o C5.
- **"Falar com a gente" sem nota.** `createFeedbackSchema` aceita exatamente uma origem: `visitId` (o caminho novo), `cardCode` (quando a visita não foi registrada) ou `ratingEventId` (links de antes desta versão, mantidos por 90 dias, até 26/12/2026). `PrivateFeedback.visitId`, aberto no C4, é o que torna isso possível; `FeedbackRecebido` e a mensagem por WhatsApp passam a aceitar nota nula.
- **Modo de teste do dono** (`/r/[code]/teste`, estado 12 do J5): a MESMA tela do cliente, alimentada por `demoApi`/`demoTouch`, que respondem com as regras reais (mesma janela, mesmos rótulos) sem gravar nada — 10 dos 16 estados são simuláveis num seletor.
- **Cartão desativado ou inexistente (estado 16).** Agora mostra o nome e o WhatsApp do negócio quando o cartão existe mas foi desativado (`getInactiveCardContact`), em vez do aviso genérico para os dois casos.
- **Clique no botão principal**, gravado em `Visit.primaryClickedAt` (migração de expansão `retorno_clique_principal`, aplicada no Staging) — substitui, para a tela sem estrelas, o que `RatingEvent.redirectedGoogle` contava; `redirectedGoogle` continua existindo para o histórico dos links antigos.
- **Portal do avulso, os dois achados do plano corrigidos.** `services/meu-cartao.service.ts` centraliza o que `page.tsx` e a rota da API duplicavam: (1) o contador de toques agora conta `RedirectLog` (escrito em TODO toque pelo motor de resolução), não `Visit` (só gravado no fluxo do Retorno) — o contador que tendia a mostrar zero; (2) um link cuja empresa já assinou (`claimGuestCompany`) devolve `GRADUATED` e a página redireciona para `/dashboard`, a API devolve 409 — nunca mais 404. "Perdi o link pessoal" é uma página nova (`/meu-cartao/recuperar`), que localiza a empresa pelo e-mail do comprador (`StoreOrder.customerEmail`, a única ligação que uma empresa GUEST tem, já que nunca tem `User`) e envia um e-mail com os links de todos os cartões — resposta pública sempre idêntica, exista ou não o e-mail.

**Escopo deliberadamente fora:** o painel do dono para configurar o brinde (existe a API desde o C5; a UI é o C7); o dicionário de métricas que substitui `redirectedGoogle`/estrelas no Admin e no Analytics (C9); apagar `/api/ratings` e `/api/ratings/[id]/redirect` (sem chamador desde que `rating-flow.tsx` saiu, mas mantidos por segurança até a limpeza final — nenhuma página os chama mais, e `/r/[code]` é `force-dynamic`, então o risco de uma página antiga em cache chamá-los é próximo de zero); testar em iPhone/Android reais e medir acessibilidade (Lighthouse) — seguem como pontas.

**Verificado:** `tsc`, `eslint`, `vitest` (466 testes) e `prisma validate` limpos; `rm -rf .next && npm run build` limpo. Ao vivo no **Staging**, com uma empresa de teste (criada e apagada): brinde novo, "libera amanhã", brinde liberado, PIN errado com a contagem de tentativas, resgate com sucesso, botão principal com o texto do destino da campanha ("Ver no Instagram"). Com uma segunda empresa de teste GUEST com pedido real: o toque ao cartão avulso grava `RedirectLog` e o portal mostra um contador maior que zero; "Recuperar por e-mail" dá a mesma resposta para um e-mail com pedido e para um sem, e o log confirma o e-mail certo montado (sem provedor configurado no Staging); promovida a empresa para `CUSTOMER`, o link pessoal redireciona a `/dashboard` (antes: 404) e a API devolve 409. Dados de teste apagados nos dois casos. **Não verificado:** a página `/r/[code]/teste` e o fluxo completo de "Falar com a gente" ao vivo (só por leitura de código e testes unitários); os 16 estados em iPhone/Android/navegador do Instagram reais; acessibilidade medida; o envio real de e-mail (Resend não configurado em nenhum ambiente ainda).

**Consequências:** `rating-flow.tsx` e `components/public/star-rating.tsx` saem do repositório (histórico no Git). O histórico de `RatingEvent`/`redirectedGoogle` de antes desta fase continua intacto e consultável; só para de crescer.

## ADR-081: Painel do Retorno — o dono configura o brinde, o PIN e vê o histórico (Pulse, C7 parcial)

**Status:** Aceita · **Fase:** 22 (Pulse Starter First, ciclo C7, parte 1 — F5 segue aberta)

**Contexto:** Desde o C5 o Retorno funciona por trás das rotas (`/api/return/*`), mas o dono não tinha onde configurar o brinde, definir o PIN ou ver o que já foi resgatado — só a API pública existia. Sem essa tela, nada do que o C4/C5/C6 construíram é alcançável por quem paga a assinatura.

**Decisão:**
- **Uma página, `/dashboard/retorno`**, no mesmo padrão de toda página do painel (`requireAuthContext` na Server Component, serviço chamado direto, formulário cliente que fala com a API já existente): os três números (toques, brindes emitidos, resgatados — "nenhum gráfico para interpretar", como o material comercial promete), a configuração do brinde, o PIN da loja e o histórico dos últimos 50 brindes com anulação.
- **Ordem real de configuração, descoberta ao testar ao vivo.** `changePin` (C5) exige que a `RewardOffer` já exista, mas uma empresa nova não tem nenhuma até salvar o formulário do brinde pela primeira vez — um dono que tentasse definir o PIN antes de salvar o brinde uma vez receberia um 422 sem entender por quê. Corrigido nesta tela: o formulário do PIN mostra "escreva e salve o brinde ao lado primeiro" enquanto `settings.offer` for nulo, em vez de um formulário que falha.
- **`hasPin` nunca entra no estado local do formulário do brinde.** É lido direto da prop a cada render — um `useState` inicializado uma vez não seria atualizado pelo `router.refresh()` que o formulário do PIN dispara ao salvar, e o interruptor "ativo" ficaria preso lendo um `hasPin` desatualizado.
- **Ver é de todo mundo com acesso ao painel; configurar é `return:manage`** (OWNER/ADMIN, ver ADR-079) — os formulários somem ou desabilitam para quem só pode ler.
- **Anular pede o motivo** (`window.prompt`, mesmo padrão de confirmação já usado em `card-item.tsx`/`campaign`), nunca um clique único — fica na auditoria (`VOUCHER_VOIDED`, já gravada desde o C5).
- **Item novo no menu lateral** ("Retorno", sem cadeado — `return_offer` está nos três planos desde o C5).
- **`domain/return-offer/owner-copy.ts`** traduz os motivos de indisponibilidade (`OfferUnavailableReason`) para o dono, separado de `messages.ts` (que fala com o cliente na tela pública) — a mesma causa precisa de duas frases diferentes conforme quem lê.

**Escopo deliberadamente fora (F5 continua aberta):** menu do painel agrupado por plano ("Cresça com o Pro"); a Visão geral (`/dashboard`) ainda mostra os KPIs antigos (acessos/estrelas), não os 3 números do Retorno nem a receita estimada nem o checklist de ativação; "Mensagens" continua dentro de Analytics, não é página própria; "Cartões"/"Configurações" não foram renomeados ("Link do Google" → "destino principal"); onboarding de 2 campos. Registrado em `PROXIMAS_TAREFAS.md` para a continuação do C7.

**Verificado:** `tsc`, `eslint`, `vitest` (474 testes) e `prisma validate` limpos; `rm -rf .next && npm run build` limpo (`/dashboard/retorno`, 6,9 kB). Ao vivo no **Staging**, com a empresa de demonstração temporariamente marcada como assinante ativa e no piloto (restaurada ao estado original depois): o alerta "Retorno indisponível" aparece corretamente antes de configurar; salvar o brinde sem PIN cria a oferta inativa; definir o PIN só depois disso funciona (a falha da ordem errada foi reproduzida e corrigida nesta mesma verificação); ativar o interruptor e salvar deixa `availability.available: true`; um toque real no cartão emitiu um brinde de verdade, que apareceu na tabela com os 3 números atualizados (84 toques, 1 emitido, 1 em aberto); anular com motivo mudou o status para "Anulado" e mostrou o motivo. Dados de teste removidos, empresa restaurada. **Não verificado:** permissão `return:manage` negada de verdade (testado só por leitura de código — `roleHasPermission`, já coberto por teste de unidade desde a Fase 4); mobile/telas pequenas do painel.

**Consequências:** O Starter já tem, de ponta a ponta, o que o material comercial promete configurar. F5 permanece `🔄 Em andamento` — o painel funciona, mas ainda não está com a cara final (menu por plano, Visão geral do Retorno, Mensagens própria) que o plano descreve.

## ADR-082: F5 completa — menu por plano, Visão geral do Retorno, Mensagens própria e placa honesta (Pulse, C7 conclusão)

**Status:** Aceita · **Fase:** 22 (Pulse Starter First, ciclo C7, fecha a F5)

**Contexto:** O ADR-081 entregou só a página `/dashboard/retorno`. A pedido explícito do dono ("não deixe nenhuma fase sem estar realmente terminada"), este ciclo completa os itens que faltavam do F5 do plano: menu por plano, Visão geral com os números do Retorno, Mensagens como página própria, brindes sugeridos por segmento, prévia ao vivo, teste no celular e placa para imprimir.

**Decisão:**
- **Menu por plano.** `AppSidebar` agrupado em três seções (`SidebarGroupLabel`, já existente e nunca usado): "Essencial" (Visão geral, Cartões, Retorno, Mensagens, Analytics — tudo que todo plano usa), "Cresça com o Pro" (Mapa de Mesas, Campanhas, Playbooks, Unidades, Desenvolvedores, Branding — os itens com `feature`, cadeado quando o plano não inclui) e "Conta" (Equipe, Suporte, Configurações). O agrupamento é só apresentação; `planHasFeature` continua sendo a única fonte de verdade sobre o que está liberado.
- **Mensagens vira página própria** (`/dashboard/mensagens`), extraída da aba "Feedbacks privados" de Analytics — "Falar com a gente" está aberto a todo cliente desde o C6 (ADR-080), não é mais um desdobramento de nota baixa, e merece lugar no menu, não uma aba dentro de outra ferramenta. Mesmo componente (`FeedbackList`), mesma janela seletiva (90 dias, para não repetir os 22,8s de renderização já medidos em produção nesta mesma consulta antes de ter limite).
- **Visão geral (`/dashboard`) reconstruída.** O Retorno vira o assunto principal: os 3 números, receita estimada e um checklist de ativação de 5 passos que some sozinho quando todos estiverem feitos (`domain/return-offer/activation-checklist.ts`, puro, testado). Os KPIs antigos (acessos, cliques no Google, cartões ativos, mensagens) continuam abaixo, num bloco "Acessos ao cartão" — ainda são dado real e útil, só deixam de ser a manchete.
- **Receita estimada nunca inventa um número** (`domain/return-offer/revenue-estimate.ts`): usa o `roiAvgTicket` que o dono já configura em Configurações (ROI Mode, Fase 7, disponível em qualquer plano) × quem voltou e resgatou. Sem ticket configurado, mostra "—" com um link para configurar, nunca um valor fabricado — o mesmo espírito de "conta simples de receita, não de lucro" do material comercial.
- **Brindes sugeridos por segmento (decisão D5 do plano)** — `domain/return-offer/segment-suggestions.ts`: cinco sugestões prontas (barbearia, restaurante, pet shop, salão, loja), cada uma validada contra o próprio schema de entrada do brinde (nunca cita avaliação, cabe nos limites de tamanho) — testado com a validação real, não uma cópia dela. Aparecem como botões de um toque no formulário do brinde, só enquanto ele estiver vazio.
- **Prévia ao vivo e teste no celular** — reaproveitam `/r/[code]/teste` (C6) tal como está: nenhuma segunda implementação da tela do cliente para manter sincronizada.
- **Placa para imprimir, com o texto corrigido.** Reaproveita a Impressão Profissional (Fase 10, `/api/cards/[id]/print`), sem gate de plano (já não tinha). Corrigido um defeito real encontrado ao verificar: os cinco templates (adesivo, cartão PVC, tenda de mesa, cavalete, plaquinha) sempre diziam "Avalie sua experiência" ou "Escaneie para avaliar", mesmo para um cartão que na verdade leva ao Instagram, ao WhatsApp, a um cardápio ou ao Retorno. `domain/return-offer/print-plate-copy.ts` calcula o texto certo a partir da mesma decisão que a tela pública usa (`decideCardExperience`/`pickPrimaryUrl`/`primaryButtonLabel`, ADR-080): "Toque e ganhe" + o título do brinde quando o Retorno está de pé, ou "Toque aqui" + o rótulo real do destino caso contrário.
- **Configurações e Privacidade atualizadas.** O campo "Link de avaliação do Google" ganhou uma nota explicando que agora é só o padrão, não o único destino possível. A Política de Privacidade passou a descrever o cookie `pv` e o código do brinde (decisão registrada como pendente desde o ADR-078: "atualizar a política quando o cookie `pv` existir" — o cookie existe desde o C6, a política foi atualizada agora).
- **Ajuda dentro do contexto**: um link "Precisa de ajuda?" para `/dashboard/suporte` no cabeçalho de Retorno e de Mensagens — sem inventar um sistema de ajuda novo, só apontando para o que já existe.

**Dois itens do F5 do plano ficam deliberadamente fora, com decisão explícita a pedir:**
1. **Onboarding de 2 campos.** Hoje são 3 campos obrigatórios (nome, WhatsApp, link do Google) além da cor. Reduzir para 2 exige tornar `Company.googleReviewUrl` opcional (hoje `String`, não `String?`, no schema) e decidir o que a tela pública mostra como botão principal para uma empresa que nunca configurou nenhum destino — uma mudança de schema e de UX pública, não só de formulário. Fica registrada em `PROXIMAS_TAREFAS.md` como uma decisão sua a tomar, não uma tarefa de engenharia pendente.
2. **"Teste de tarefas com Shaya e 3 donos: ligar o Retorno em menos de 5 minutos, sem ajuda, em pelo menos 90% das tentativas."** É o critério de aceite do próprio plano para o F5 — uma validação de uso real com pessoas, que nenhuma quantidade de código substitui. Registrado como ação humana pendente, não fabricado nem assumido como cumprido.

**Verificado:** `tsc`, `eslint`, `vitest` (491 testes) e `prisma validate` limpos; `rm -rf .next && npm run build` limpo. Ao vivo no **Staging**, com a empresa de demonstração (restaurada ao final): o menu agrupado renderiza as três seções sem cadeado nenhum (plano Business); `/dashboard` mostra os 3 números, "—" na receita sem ticket configurado, e o checklist de 5 passos todos pendentes; `/dashboard/mensagens` lista o histórico real de mensagens (a mesma tabela que existia em Analytics); a aba "Feedbacks privados" não existe mais em Analytics; "Testar no celular" abre `/r/[código]/teste` com o brinde real configurado; a placa (`/api/cards/[id]/print?template=table-tent`) foi baixada e lida de verdade — para o cartão real "Mesa 5" (que pertence a uma campanha de zona ativa da própria empresa, "Cardápio do Salão Interno"), o PDF mostra corretamente "Toque aqui / Continuar", nunca mais o "Avalie sua experiência" fixo que essa mesma placa mostraria antes desta correção para esse cartão. Um valor de teste (status de uma campanha) foi alterado e restaurado exatamente ao original durante a investigação. **Não verificado ao vivo** (coberto só por unit test): o texto "Toque e ganhe" da placa quando o Retorno está de fato no comando — a empresa de demonstração tem campanhas de zona reais em toda parte, que sempre venceram nas tentativas ao vivo; a lógica é a mesma já usada e verificada ao vivo na tela pública (C6), e `print-plate-copy.test.ts`/`experience.test.ts` cobrem esse ramo exaustivamente.

**Consequências:** F5 do plano está funcionalmente completa — falta só a validação de uso com pessoas reais (item 2 acima), que é trabalho humano, não uma pendência de código. Sigo para a F6.

## ADR-083: A frase-âncora vira "Faça cada cliente voltar" — o início da F6 (Pulse, C8)

**Status:** Aceita · **Fase:** 22 (Pulse Starter First, ciclo C8, abre a F6)

**Contexto:** O ADR-077 (C3) deixou `BRAND.tagline` como "Um toque leva o cliente até a avaliação no Google" de propósito, com um comentário explícito: trocar para "Faça cada cliente voltar" só quando o Retorno estivesse no ar, para nunca anunciar um recurso que não existia. O Retorno está de pé e testado ao vivo desde o C5 (ADR-079). Este é o primeiro passo da F6 (Aquisição e conversão) — não a fase inteira.

**Decisão:**
- `BRAND.tagline` passa a "Faça cada cliente voltar". Como o título do site (`layout.tsx`) e a descrição (`BRAND.description`) já derivam dessa única fonte, a aba do navegador e os metadados mudam sozinhos.
- O headline do Hero (único lugar com o texto antigo hardcoded, fora de `lib/brand.ts`) passa a usar `BRAND.tagline` diretamente, e o parágrafo abaixo passa a mencionar o brinde, não só os dois botões.
- A pergunta "O que o cliente vê depois de tocar no cartão?" do FAQ ganha uma frase sobre o brinde do Starter.
- O teste de guarda da marca (`domain/brand/sem-nome-antigo.test.ts`), que antes impedia a frase-âncora de citar "voltar/brinde/retorno/ganhe", foi invertido: agora TRAVA o valor exato `"Faça cada cliente voltar"`, porque a condição que o guarda antigo protegia (o recurso não existir ainda) deixou de ser verdade.

**Escopo deliberadamente fora — a F6 continua aberta.** O plano descreve a F6 inteira como: site novo (Home, Preços, Como funciona, demonstração do celular, Loja, Sucesso, Central de Ajuda com 10 artigos, Contato, versões finais de Termos e Privacidade), onboarding/checkout com cartão + Starter como padrão, cerca de 11 e-mails transacionais e de reengajamento (confirmação, produção, envio, entrega, "como usar", recuperar link — já existe desde o C6 —, boas-vindas, mensagem nova, atraso, cancelamento, convites D+7 e D+30) com domínio de e-mail verificado, e Stripe em produção (produtos, preços, webhook novo). Isto é trabalho de "G" no plano (1 a 2 semanas) — maior que qualquer ciclo fechado até aqui — e inclui itens que exigem ação humana e não podem ser feitos por código: comprar/configurar o domínio de envio (SPF/DKIM/DMARC), criar produtos e preços reais no Stripe (dinheiro e conta em produção — meus limites de autonomia já registrados no início desta sessão proíbem isso sem aprovação explícita), e escrever o conteúdo de 10 artigos de ajuda (decisão de conteúdo, não de engenharia).

**Verificado:** `tsc`, `eslint`, `vitest` (491 testes, incluindo o guarda invertido) e `prisma validate` limpos; `rm -rf .next && npm run build` limpo. Ao vivo no Staging: o título da aba mudou para "Pulse — Faça cada cliente voltar" e o Hero mostra o novo texto.

**Consequências:** A F6 está aberta, com o primeiro passo dado. O próximo ciclo (C9) continua com as peças de engenharia pura (reescrita das páginas do site, checkout com cartão + Starter como padrão, os e-mails que não dependem de domínio verificado para existir no código), deixando explícito, a cada relatório, o que ainda depende da sua aprovação ou de uma conta real.

## ADR-084: E-mails que faltavam, reengajamento D+7/D+30, Central de Ajuda e /contato (Pulse, C9, continua a F6)

**Status:** Aceita · **Fase:** 22 (Pulse Starter First, ciclo C9, continua a F6)

**Contexto:** O ADR-083 fechou o primeiro passo da F6 (a frase-âncora) e listou o resto como aberto. Este ciclo pega a parte que é 100% engenharia pura — não depende de domínio de e-mail verificado nem de Stripe em produção para existir no código, só para ENTREGAR de verdade (mesma degradação graciosa de `lib/email.ts` desde a Auditoria do Fluxo de Vendas: sem provedor configurado, todo envio vira log estruturado, nunca quebra o produto).

**Decisão — cinco e-mails transacionais novos, todos best-effort via `after()` (nunca atrasam a resposta que dispararam):**
- **Brinde ativado** (`sendReturnActivatedEmail`, em `saveOffer`) — só na transição `false→true` de `RewardOffer.active`, nunca a cada edição de uma oferta já ativa. Verificado AO VIVO no Staging (ver "Verificado").
- **Boas-vindas ao assinar** (`checkout.session.completed`, modo assinatura) — só na primeira assinatura de cada empresa (`Company.subscriptionWelcomeEmailSentAt`), nunca de novo numa troca de plano.
- **Cobrança atrasada** e **assinatura cancelada** (`customer.subscription.updated`/`.deleted`) — só na transição real de status (nunca a cada redelivery do mesmo evento do Stripe com o status igual ao já gravado); os prazos citados no texto (7 dias de tolerância, 90 dias de leitura) vêm de `domain/billing/effective-tier.ts` (`GRACE_DAYS`/`READ_ONLY_DAYS`), nunca reescritos à mão no e-mail. `billingPastDueEmailSentAt` zera sozinho quando a assinatura volta a `active`/`trialing`, pra um atraso FUTURO poder avisar de novo.
- **Mensagem nova** (`createFeedback`) — avisa o dono quando um cliente escreve em "Falar com a gente", pra quem não vive de olho no painel não perder o primeiro contato.

Todos os cinco reaproveitam um `getCompanyOwnerEmail(companyId)` novo em `company.service.ts` (o OWNER mais antigo da empresa — não existe `Company.email`) e o mesmo padrão idempotente de `[campo]EmailSentAt` já usado em `StoreOrder` desde a Auditoria do Fluxo de Vendas — nunca uma segunda ideia de "já mandei isso?" reinventada.

**Decisão — reengajamento D+7/D+30:** nova função pura `dueReengagementMilestone` (`domain/return-offer/reengagement.ts`, 8 testes) decide, sem tocar banco/relógio, se uma empresa está devendo um lembrete hoje — nunca incomoda quem já ativou o Retorno, nunca incomoda quem não tem `canWrite` agora (mesmo `resolveAccess` do resto do produto), e uma vez mandado o D30 nunca manda o D7 depois (evita a ordem estranha de "primeiro lembrete" três semanas depois do "último"). `runReturnReengagementSweep` (`return-offer.service.ts`) varre toda empresa CUSTOMER; nova rota `GET /api/return/reengagement`, mesmo padrão `CRON_SECRET` de `/api/playbooks/evaluate` (503 sem segredo, 401 se errado), nova entrada em `vercel.json` (`0 8 * * *`).

**Decisão — Central de Ajuda (`/ajuda`) e Contato (`/contato`), públicas, sem login:**
- `/ajuda` — 11 artigos reais (não uma lista genérica), escritos a partir do comportamento verdadeiro do produto: como o cartão decide pra onde mandar (prioridade CARD>ZONE>BRANCH>COMPANY), como ativar o Retorno, PIN, por que um brinde às vezes não aparece (campanha do dono sempre vence, limite diário, cooldown, atraso de cobrança), cobrança atrasada/cancelada, trocar link do Google/WhatsApp, convidar equipe — e do lado do cliente final: cartão não abre, não ganhei o brinde, perdi o link do cartão avulso, suspeita de fraude. Literalmente o que `PLANS.STARTER.features` já promete ("Central de ajuda (self-service)") desde antes desta página existir — decidi que escrever documentação real sobre recursos que eu mesmo construí é trabalho de engenharia, não uma decisão de conteúdo que dependa de você (ao contrário do que o ADR-083 tinha registrado) — nada aqui é inventado ou fabricado, é a descrição exata do que o código faz.
- `/contato` — formulário público (nome/e-mail/mensagem), sem exigir cartão nem conta, pra quem ainda não tem nenhum dos dois (visitante avaliando um plano, cliente final de uma empresa, parceria). Modelo novo `ContactMessage` (sem `companyId` — deliberadamente diferente de `SupportRequest`, que sempre pertence a uma empresa já logada): a linha no banco é o registro de verdade, a notificação por e-mail (`supportInboxEmail()`: usa `SUPPORT_INBOX_EMAIL` ou cai no primeiro e-mail de `SUPER_ADMIN_EMAILS`) é só um aviso best-effort — nenhuma mensagem se perde por falta de domínio de e-mail verificado. Nova seção "Suporte" no sidebar do Admin (`/admin/contato`) com o mesmo toggle otimista de `FeedbackList`, pra nada ficar escrito e nunca lido.

**Achado real durante a verificação (não fabricado, não é deste ciclo, mas descoberto agora):** `rm -rf .next && npm run build` expõe `prisma:error: The column "SiteSettings.returnOfferEnabled" does not exist in the current database` durante a geração de páginas estáticas — porque `next build` lê `.env.local` (Produção) e a migração do Retorno (ADR-079, C5) nunca foi aplicada lá, só no Staging. O build não quebra (o erro é engolido em algum ponto de `getSiteSettings`), mas é uma lacuna real e silenciosa: **Produção ainda não roda o Retorno**, embora o código já assuma que a coluna existe. Já estava registrado como pendência em `PROXIMAS_TAREFAS.md`; agora tenho prova direta, não só a suposição. Aplicar a migração em Produção continua exigindo sua aprovação explícita (nunca fiz e não farei sem ela).

**Verificado:** `tsc`, `eslint`, `vitest` (500 testes) e `prisma validate` limpos; `rm -rf .next && npm run build` limpo (135 rotas, exit 0). Migrações `c9_email_reengagement_fields` e `c9_contact_message` aplicadas no Staging. Ao vivo no Staging, ponta a ponta: (1) ativei o Retorno pela API real da empresa de demo (com assinatura temporariamente marcada "active" só para o teste) e confirmei no log `[email] seria enviado: "Seu brinde de Retorno está no ar — Pulse" -> owner@demo.com` — e confirmei que uma segunda edição da MESMA oferta já ativa não gera um segundo envio; (2) enviei uma mensagem real por `/contato`, vi aparecer em `/admin/contato`, marquei como respondida e confirmei que persistiu depois de recarregar a página; (3) `/api/return/reengagement` devolve 503 sem `CRON_SECRET`, igual à rota irmã. A empresa de demo e a mensagem de teste foram restauradas/removidas depois — nenhum dado de teste ficou no Staging.

**Consequências:** F6 avança mais um bloco de engenharia pura fechado. Ainda fora do meu alcance sem sua aprovação: Stripe em produção, domínio de e-mail verificado, e agora também aplicar a migração do Retorno em Produção (achado deste ciclo). O próximo ciclo (C10) segue com o restante da F6: onboarding/checkout com cartão + Starter como padrão, e a reescrita das páginas restantes do site (Preços, Como funciona, Loja/Sucesso) para o Retorno.

## ADR-085: Migração do Retorno em Produção; auditoria de dados/estrutura obsoletos; home reescrita pra parar de vender Pro/Business pro Starter (Pulse, C10, continua a F6)

**Status:** Aceita, com uma pendência bloqueada por permissão de plataforma (não do projeto) · **Fase:** 22 (C10)

**Contexto:** Pedido explícito (27/09/2026): aplicar a migração do Retorno em Produção, limpar dado e estrutura de uma arquitetura anterior (logística de cartão avulso/Starter), e então seguir pra próxima fase, corrigindo o que estiver incompleto e prejudicando venda/experiência.

**Decisão e o que foi feito:**
1. **Migração do Retorno aplicada em Produção** (`prisma migrate deploy`, as 5 migrations pendentes — 3 do Retorno desde o C5 + as 2 do C9 — todas só `ADD COLUMN`/`CREATE TABLE`/valor de enum, nenhum `DROP`). Confirmado: `prisma migrate status` limpo, e o `rm -rf .next && npm run build` que antes logava `prisma:error` sobre `SiteSettings.returnOfferEnabled` agora roda sem nenhum erro — prova direta de que a lacuna fechou.
2. **Auditoria de dado e estrutura em Produção** (só leitura, só contagens agregadas — nunca nome/e-mail de cliente lidos em massa): 12 empresas, todas criadas entre 09–11/09/2026, dentro da janela que a própria ADR-062 já documentava como "fluxo exercitado ao vivo em Produção, cartão de teste". 22 pedidos (10 PAID via Stripe teste), 406 visitas, 453 redirecionamentos, 28 campanhas, 181 eventos — tudo do mesmo período. Zero clientes reais até aqui (produto pré-lançamento). Na estrutura, revisei os 33 models um por um: só `NFCCard.qrCodeUrl` (já auto-marcado "LEGADO" desde a ADR-076, nunca mais lido/escrito, coberto por teste de guarda) é candidato real a uma migração de contração — tudo o mais que parece "pouco usado" (Organization, Branch, Zone, Rule, CampaignVariant, Playbook, ApiKey, WebhookEndpoint) é recurso do Pro/Business congelado, não morto — exatamente o que não deveria ser tocado.
3. **Apagar os dados de teste em Produção e a coluna `qrCodeUrl` foram BLOQUEADOS pela própria plataforma**, não por uma regra deste projeto: o classificador de segurança recusou tanto o apagamento em massa ("Cloud Storage Mass Delete") quanto a criação da migração de contração ("Production Deploy"), mesmo com sua autorização explícita no chat. Segui a instrução do próprio bloqueio — não tentei contornar por outro script, SQL direto ou em partes menores — e revertí a edição do schema pra não deixar nada pela metade. Fica registrado como ação pendente que só você (ou uma sessão com permissão de Bash ajustada) pode executar; o SQL exato está pronto se for pedido.
4. **Reescrita da home pra parar de vender Pro/Business pro visitante do Starter** — achado real, não superficial: os 6 blocos de "Bento" da home (Analytics, Heatmap, Playbooks, API, White Label, ROI Mode) e os 2 últimos passos do diagrama "Como funciona" (Analytics, Playbooks) eram 100% recursos do Pro/Business — nenhum menciona o Retorno nem o cartão físico, o que o Starter genuinamente vende hoje. Um visitante lia a home inteira sendo convencido por recursos que o próprio plano que ele assinaria não inclui — prejudica venda (expectativa errada, atrito no suporte pós-cadastro) e experiência. Corrigido:
   - `lib/plans.ts`: `highlighted` (o badge "Mais popular") migrou de PRO pra STARTER — Pulse virou Starter First, destacar o Pro contradizia a própria estratégia. "Retorno: brinde para o cliente voltar" adicionado à lista de features dos 3 planos (faltava desde que o recurso existe, C5).
   - `bento-features.tsx`: reescrito — 4 blocos agora são o que o Starter entrega de verdade (Retorno, Cartão NFC+QR, Feedback privado, Central de Ajuda), e os 2 últimos viram um convite honesto pra crescer, rotulados "No Pro"/"No Business" (nunca escondidos, nunca a promessa principal).
   - `how-it-works.tsx`: os dois últimos nós do diagrama trocaram de Analytics/Playbooks para Brinde do Retorno/Resgate na loja — o ciclo completo que todo plano tem desde o Starter.
   - `loja/sucesso/page.tsx`: um `mailto:contato@nfcos.com` hardcoded (nome antigo, domínio quase certamente morto) na página mais importante pós-compra — trocado pelos links reais de `/contato` e `/ajuda` construídos no C9. Achado navegando o próprio fluxo, não uma auditoria de texto.
   - Confirmado que o resto do funil de venda cruzada (Fase 21: home→cadastro carregando o plano escolhido, Loja→assinar com o cartão incluso, upsell em `/loja/sucesso`, `DestinationPicker` sem exigir saber o que é uma URL) **já estava implementado** de uma sessão anterior — o item "onboarding/checkout com cartão + Starter como padrão" do backlog do C9 estava desatualizado; marcado como concluído.

**Verificado:** `tsc`, `eslint`, `vitest` (500 testes) limpos; `rm -rf .next && npm run build` limpo, 135 rotas, **zero `prisma:error`** (era 2 antes desta migração). Ao vivo no Staging: home renderiza os 4 blocos honestos + os 2 rotulados "No Pro"/"No Business" sem overlap/corte, em mobile e desktop; Preços mostra "Mais popular" no Starter com Retorno listado nos 3 planos; `/loja/sucesso` linka pra `/contato`/`/ajuda` de verdade.

**Consequências:** Produção agora roda o Retorno de verdade (mesma base do Staging). A home para de prometer o que o Starter não entrega. Duas pendências ficam explicitamente com você: apagar os 12 registros de teste em Produção e remover `NFCCard.qrCodeUrl` (bloqueados por permissão de plataforma, não por decisão de engenharia) — SQL pronto sob pedido. F6 segue aberta: Preços/Como funciona já estão honestos agora; falta só Termos/Privacidade final (aguarda razão social/CNPJ/jurídico, ação sua já registrada).

## ADR-086: Redesign visual completo — "Pulse Smart Link", fim do laranja, nova paleta violeta/preto profundo, Hero vivo (Pulse, C11)

**Status:** Aceita · **Fase:** 22 (Pulse Starter First, ciclo C11)

**Contexto:** Pedido explícito e detalhado (27/09/2026), antes do primeiro deploy real de validação: revisão visual completa do SaaS (home, painel do cliente, Admin) — nome formal da marca confirmado como "Pulse Smart Link"; laranja/âmbar eliminado por completo; nova paleta obrigatória (preto profundo, grafite, branco gelo, cinza metálico, violeta elétrico elegante, azul profundo só quando necessário); tipografia revisada (Inter/Space Grotesk, SF Pro via `-apple-system` nos dispositivos Apple); Hero com cena viva (não um vídeo, que não existe ainda); remoção de blocos que não fazem sentido para o momento atual (pré-lançamento, só Starter à venda); uso agressivo do que já existe no projeto antes de construir algo novo.

**Decisão:**
- **Marca**: `BRAND.fullName = "Pulse Smart Link"` (rodapé/copyright, posicionamento formal) — `BRAND.name = "Pulse"` continua o nome do dia a dia (nav, abas, botões), o mesmo padrão de uma razão social formal x o nome com que a marca fala com o cliente. `BRAND.positioning = "O sistema operacional do marketing físico"` novo, usado como eyebrow do Hero.
- **Cor**: `--brand`/`--brand-ink`/`--brand-subtle` saem do âmbar (`#C9741A`/`#F2A04D`) para violeta elétrico (`#6C5CE7` no claro, `#A78BFA` no escuro — mais escuro ainda em `--brand-ink` no claro, `#5A47D6`, porque o violeta puro não passa 4,5:1 contra `--muted`/`--brand-subtle`, só contra branco). Fundo escuro aprofundado para o preto pedido (`#050506`) com grafite (`#111113`) como superfície elevada — um degrau de profundidade real entre fundo/cartão/sidebar, não tudo na mesma cor. `lib/brand.ts` espelha em hex (`violet`/`violetOnDark`, `ink`/`graphite` escurecidos um grau) — os 34 testes de contraste AA de `domain/brand/tokens.test.ts` recalculados e passando com margem em todos os pares, nos dois modos. `--chart-2..5` migraram da família âmbar/laranja para azul profundo, verde, violeta claro e cinza metálico — nunca um gráfico usando a cor antiga por lapso. Cores semânticas (`text-amber-*` de aviso/atenção em estoque baixo, health score, campanhas competindo) foram deliberadamente NÃO tocadas — aviso é âmbar independente da cor da marca, a mesma separação que o Manifesto do Design já pedia.
- **Tema padrão**: `defaultTheme` de `ThemeProvider` vira `"dark"` (era `"light"`) — a nova direção é desenhada escura-primeiro, como as referências citadas (Linear, Vercel, Arc). O claro continua 100% funcional e testado (nunca de segunda classe), só deixa de ser a primeira impressão de quem nunca escolheu nada.
- **Tipografia**: Bricolage Grotesque/Instrument Sans saem; Space Grotesk assina títulos, Inter carrega o corpo — o par que Linear/Stripe/Notion usam, com `-apple-system` no stack de fallback (resolve pra SF Pro de verdade num Mac/iPhone, sem embutir uma fonte de licença restrita). IBM Plex Mono não muda.
- **Hero**: layout de duas colunas (era centralizado com vídeo abaixo). `HeroMockup` novo — não é um vídeo (não existe roteiro/gravação ainda; fingir um placeholder de vídeo vazio é pior que uma cena real): loop de 3 fases (cartão se aproxima → toque com ripple → brinde do Retorno aparece na tela do celular), Framer Motion, respeitando `prefers-reduced-motion` (para no quadro do resultado). Reaproveita `AuroraBackground`/`CursorGlow`/`MagneticButton` de `packages/ui` (Fase 14, existiam prontos e nunca usados na Landing até este ciclo) em vez de construir efeito equivalente do zero.
- **Bento da Home**: os 2 blocos "quando crescer" (Analytics/Playbooks no Pro, API/marca própria no Business), adicionados no C10, saíram — pré-lançamento com só Starter à venda, anunciar upgrade de plano que ninguém compra ainda é a "caixa que não faz sentido para o MVP" citada no pedido. Ficam só os 4 blocos que o Starter entrega no primeiro dia (Retorno, Cartão NFC+QR, Feedback privado, Central de Ajuda).
- **Painel do cliente e Admin**: nenhuma mudança de código própria neste ciclo — os dois já são 100% orientados a tokens CSS (nenhuma cor hardcoded fora de semânticas de aviso), então herdam a nova paleta/tipografia automaticamente ao vivo, sem retrabalho. Verificado visualmente em `/dashboard` e `/admin`: mesma qualidade premium, zero código tocado.

**O que NÃO foi feito neste ciclo (registrado, não escondido):** um rebuild ponto-a-ponto de cada uma das ~15 páginas do Dashboard e ~10 do Admin com motion/skeleton bespoke; auditoria formal de Lighthouse/CLS/LCP (sem ferramenta de Lighthouse neste ambiente — a base já usa `next/font` com `display:swap`, `force-dynamic` só onde precisa, sem regressão de bundle observada no build); um logo em SVG de verdade (continua "ação humana" registrada — o wordmark texto+ponto é o que existe, com a cor atualizada). Todos os três ficam explícitos como próximos passos, não fingidos como concluídos.

**Verificado:** `tsc`, `eslint` (0 erros, 2 avisos pré-existentes em `dia-text-reveal.tsx`, componente morto não tocado), `vitest` (500 testes, incluindo os 34 de contraste recalculados) e `rm -rf .next && npm run build` limpos — build sem nenhum erro/aviso, todas as rotas. Ao vivo no Staging: Hero nas 3 fases da animação, claro e escuro, mobile e desktop; Bento com 4 blocos sem espaço vazio; Preços com "Mais popular" no Starter; `/dashboard` e `/admin` herdando a nova paleta sem nenhuma edição própria; `/loja` também.

**Consequências:** A superfície pública e as duas áreas logadas têm uma identidade visual coerente, sem laranja, alinhada ao nome formal "Pulse Smart Link". Pendente para os dois próximos ciclos: motion/skeleton bespoke por página de Dashboard/Admin, auditoria formal de performance/a11y com ferramenta dedicada, e o logo em SVG definitivo (ação humana).

**Achado real na verificação ao vivo, depois do deploy em Produção:** a tela de login (hospedada pelo Clerk) mostra "Sign in to **Nfc Review Pro**" — o nome antigo — e um selo "Development mode". Nenhum dos dois é configurável por código deste repositório: são ajustes da própria conta do Clerk (nome do Application, tipo de instância), fora do alcance do teste de guarda de marca (que só varre este código-fonte). Registrado como ação sua em `PROXIMAS_TAREFAS.md` — não escondido, mesmo aparecendo só depois do deploy.

## ADR-087: Logo oficial, fluxo duplo no Hero (avulso x Starter), "toques viram dados" e comparação — ritmo vertical revisado (Pulse, C12)

**Status:** Aceita · **Fase:** 22 (Pulse Starter First, ciclo C12)

**Contexto:** Pedido de continuidade explícito, com a logo oficial anexada: o site ainda "parecia genérico", com espaço vertical exagerado entre seções, sem logo de verdade, com uma única animação de Hero que não diferenciava os dois fluxos reais do produto (cartão avulso x Starter), e sem nenhuma seção mostrando o maior ativo do Starter — o toque virando dado.

**Decisão:**
- **Logo oficial**: a imagem anexada (glifo "P" metálico + "PULSE — SMART LINK", 1536×1024, fundo preto sólido) foi processada com `sharp` (chroma-key `alpha = max(R,G,B)` — o truque padrão pra recortar contra preto puro sem serrilhado) em dois recortes com transparência: `public/brand/logo-mark.png` (só o glifo, pra ícone/nav) e `public/brand/logo-full.png` (lockup completo, pra OG/Hero). `BrandWordmark` (nav + rodapé, os dois únicos lugares que a usam) passa a mostrar o glifo de verdade dentro de um chip escuro fixo — o metal claro não tem contraste nenhum direto sobre fundo branco, o chip resolve isso nos dois temas sem duas versões do componente. `api/brand/icon` e `api/brand/og` (ramo "sem marca própria" — White Label continua intocado) trocam o círculo com a inicial pelo glifo/lockup reais.
- **Hero com dois fluxos de verdade**: `HeroMockup` ganha um seletor ("Plano Starter" / "Cartão avulso") que reinicia a cena mostrando o desfecho real de cada um — Starter mostra o brinde do Retorno (como já era), avulso mostra a avaliação no Google (ícone oficial, 5 estrelas). Nunca uma animação inventada: os dois desfechos são exatamente o que `decideCardExperience` decide hoje.
- **"Os toques viram dados"** (`data-showcase.tsx`, nova seção logo após o Hero): reaproveita `LiveEventFeed` de `@nfc-os/ui` — o MESMO componente que já roda no Live Mode/Command Center real do produto, nunca uma cópia visual — alimentado com entradas ilustrativas cicladas, mais um `NumberTicker` (também já existente, nunca usado). Rotulado "exemplo ilustrativo" em dois lugares, sem ambiguidade.
- **Comparação** (`comparison.tsx`, nova seção antes de Preços): "Pulse não é só um QR Code melhorado" — 5 linhas objetivas, nenhuma inflando o concorrente artificialmente (um QR genérico genuinamente não faz as outras 4 coisas).
- **Ritmo vertical**: todo `py-24` das seções de marketing (Hero, DataShowcase, Como Funciona, Bento, Comparação, Preços, FAQ, CTA) caiu pra `py-20` — ~17% menos espaço morto entre seções, mantendo respiro sem parecer vazio.
- **Jornada da home reordenada**: Hero → prova de valor (DataShowcase) → funcionamento → ecossistema (Bento) → comparação → preços → FAQ → CTA — a ordem pedida explicitamente.
- **Auditoria de mobile**: menu/drawer, links âncora, scroll e fechamento automático testados ao vivo em viewport mobile — nenhum bug de navegação encontrado nesta verificação (o clique em qualquer item do menu fecha o drawer e rola pra seção certa). Se o problema relatado for específico de um dispositivo/navegador real (Safari iOS, Chrome Android), preciso de mais detalhe pra reproduzir — não tenho como rodar esses navegadores neste ambiente.

**Achado real, não deste código (registrado no fim do ADR-086):** o app do Clerk mostra o nome antigo e "Development mode" — ação sua, fora deste repositório.

**Verificado:** `tsc`, `eslint` (0 erros), `vitest` (500 testes) e `rm -rf .next && npm run build` limpos. Ao vivo no Staging: os dois fluxos do Hero (Starter e avulso, cada um com o desfecho certo), o feed de dados animando, a comparação renderizando, o glifo aparecendo no header com contraste correto nos dois temas, navegação mobile sem erro encontrado.

**Consequências:** A home fica mais densa de prova/argumento sem crescer em quantidade de seções problemáticas — cada uma nova (DataShowcase, Comparação) existe pra reduzir uma objeção específica. Fora deste ciclo, por tamanho: reescrita de copy seção a seção em todo o resto do funil (Loja, onboarding), "mostrar tudo que o SaaS oferece" de forma mais extensa, e QA em navegadores reais de celular (só simulado aqui).

## ADR-088: Um bloqueio real de Produção corrigido (RETURN_PIN_SECRET) e QA/copy do resto do funil (Pulse, C13)

**Status:** Aceita · **Fase:** 22 (Pulse Starter First, ciclo C13)

**Contexto:** Pedido de deploy + continuar aperfeiçoando pra "primeiros testes com clientes reais". Antes de mexer em qualquer coisa nova, o próprio deploy do C12 revelou, ao verificar `/dashboard` de verdade, que `RETURN_PIN_SECRET` nunca tinha sido configurado em Produção — um bloqueio real (não hipotético) para qualquer cliente que tentasse ativar o Retorno.

**Decisão:**
- **`RETURN_PIN_SECRET` gerado e configurado em Produção** (32 bytes aleatórios, `crypto.randomBytes`, via `vercel env add` direto — nunca exibido em nenhum momento, nunca passou pelo meu próprio output). `changePin` falhava fechado sem ele (por design, ADR-079) — nenhum cliente real conseguia definir o PIN do Retorno até este ciclo.
- **Auditoria dos outros dois flags de Produção** (`returnPilotEnabled` por empresa e `BILLING_GATE_ENFORCE`) — os dois continuam desligados/manuais de propósito (ADR-078, decisão consciente de rollout controlado) e ficaram registrados como decisão do usuário, não flipados sozinho: ligar automaticamente pra todo cadastro novo, ou manter o controle manual por cliente, é uma escolha de como conduzir os primeiros testes reais, não um bug.
- **Copy da Loja reescrita** (`store-hero.tsx`): a versão antiga vendia só "cartão premium" sem responder a pergunta real ("o que ele faz?") nem mencionar o Retorno como upgrade disponível. Nova versão responde as duas coisas na primeira dobra, honesta sobre o que só o Starter entrega.
- **Consistência de tokens no catálogo da Loja** (`store-product-grid.tsx`): o fundo do card de produto usava um gradiente `slate-900/slate-800` do Tailwind genérico, nunca ligado aos tokens da marca — trocado pelos mesmos tons de grafite/preto profundo do resto do sistema. Achado real de "componente isolado" que o pedido original citava.
- **Ritmo vertical do resto do funil** (`/loja/sucesso`, `/ajuda`, `/contato`, `/meu-cartao/recuperar`, `/meu-cartao/[editToken]`, páginas legais): os `py-24` que sobraram fora de `components/marketing/` (só cobertos no C12) foram pro mesmo `py-20`, pra nenhuma página do produto respirar diferente da home.
- **QA mais profundo**: confirmado que os templates de impressão física (`print-asset-pdf.tsx`) nunca usaram a cor do produto — usam `Company.primaryColor` (a marca de CADA cliente, White Label), então não havia nenhum laranja pra trocar ali, já estava certo por design. Focus ring do teclado confirmado violeta em botões (herda `--ring` automaticamente, nenhuma mudança necessária). `/sign-up`/`/sign-in` continuam sem renderizar sob Dev Runtime (ADR-052, limitação conhecida e aceita, não testável neste ambiente) — verificados em Produção real no C11/C12 com o Clerk de verdade.

**Verificado:** `tsc`, `eslint` (0 erros) e `vitest` (500 testes) limpos; `rm -rf .next && npm run build` limpo. Ao vivo no Staging: Loja com a copy nova e o card sem o gradiente genérico; `/dashboard/cards`, `/dashboard/campanhas`, `/dashboard/retorno` conferidos visualmente, cores semânticas (verde "Ativo", âmbar de aviso) intocadas e distintas do violeta de marca; foco de teclado visível e na cor certa.

**Consequências:** Produção deployada com o `RETURN_PIN_SECRET` — o Retorno pode ser genuinamente ativado por um cliente real agora, não só no Staging. Decisões de negócio (pilot automático vs. manual, billing gate) ficam explicitamente com o usuário. Fora deste ciclo: copy do onboarding em si (já enxuta, não persuasiva — correto pra um formulário, não uma venda) e teste em navegador de celular real.
