# Relatório da Fase 12 — Developer Command Center v2 + Demo OS

Ver `ROADMAP.md` para a lista completa de fases e `PROXIMAS_TAREFAS.md` para o checklist que esta fase fecha. Esta é a primeira fase sob uma nova regra permanente obrigatória — **Demo OS Review** (décimo review) — e duas novas regras permanentes de engenharia — **Self-Healing Development** e **Zero Fake Demo** — ver seções dedicadas abaixo.

## O que foi implementado

O objetivo declarado desta fase era duplo: eliminar de vez a dependência de um harness descartável para testar, e dar ao produto um ambiente de demonstração permanente onde qualquer pessoa — investidor, franquia, cliente ou desenvolvedor — abre o NFC OS e, em menos de 30 segundos, acredita que está vendo uma operação real.

- **Dev Runtime** (`src/lib/dev-runtime/{config,auth}.ts`, ver **ADR-052**): `DEV_RUNTIME=1` faz `getAuthContext()` (`lib/auth.ts`) resolver direto para um `User` real já semeado, sem chamar o Clerk — `middleware.ts` (agora um passthrough condicional) e `layout.tsx` (agora sem `<ClerkProvider>` condicionalmente) reagem a isso de forma PERMANENTE. Isso aposenta por completo o padrão de harness descartável usado nas Fases 9-11 (esvaziar o matcher/remover o ClerkProvider à mão, sempre restaurado depois) — nenhuma fase futura precisa mais editar esses dois arquivos.
- **Scenario Engine** (`services/scenario-engine.service.ts`, `domain/demo/types.ts`, ver **ADR-053**): 7 cenários reais — Happy Hour, Restaurante Lotado, Avaliações Disparando, Zona Silenciosa, Franquia, Falha de Redis, AutoPilot Trabalhando. Cada um cria linhas genuínas de `RedirectLog`/`Visit`/`RatingEvent`, publica eventos reais no Event Bus, e chama funções de serviço reais (`evaluatePlaybooksForCompany` da Fase 11, `setChaosFlag` da Fase 8, `setAutoPilotLevel` da Fase 11) — nunca um estado de UI fabricado.
- **Demo OS** (`/demo`, público, alcançável em produção, `force-dynamic`): uma narrativa de 9 momentos (`components/demo/demo-os-view.tsx`) — hero, mapa vivo, eventos chegando, KPIs subindo, heatmap respirando (Fase 11), playbooks aparecendo, AutoPilot agindo, ROI mudando, White Label trocando — reaproveitando por completo o `TableMapView`, o `BrandProvider` e o Recommendation Center já existentes. Rotas públicas dedicadas `/api/demo/**` (heatmap, live/stream, live/history, table-map, kpis, playbooks, brands, scenarios) — equivalentes de `/api/dev/demo/**`, mas deliberadamente NUNCA bloqueadas por `NODE_ENV`, já que "funciona sem cadastro" é um requisito de produção, não de desenvolvimento.
- **Demo Timeline** (`components/demo/demo-timeline.tsx`): o `usePlayback` da Fase 6 foi estendido com controle de velocidade (1x/2x/5x) e salto para "momentos importantes" (marcadores em eventos de maior sinal) — mantendo 100% de compatibilidade com o único outro consumidor existente (o Time Machine do Mapa de Mesas), sem quebrar seu comportamento.
- **White Label Live Switch**: duas empresas fictícias novas semeadas (Sushi House, Nova Steakhouse — nomes inventados, nunca uma marca real de terceiro) mais a Bella Vista, trocadas instantaneamente via `BrandProvider` sem reload.
- **Investor Mode** (`/demo/investor`): a mesma `DemoOSView`, com `autoPlay` avançando sozinha pelos 9 momentos, pensada para caber em ~2 minutos.
- **Dev Command Center v2** (`/dev/command-center`, ferramenta de engenharia, sempre bloqueada em produção, ver **ADR-055**): `services/command-center.service.ts` compõe o `getReliabilitySnapshot()` da Fase 8 com três painéis que ainda não tinham lugar — webhooks (Fase 9), playbooks/AutoPilot (Fase 11) e "cenário atual" (Fase 12) — nunca recalcula o que já existia. Quatro abas: Cockpit, State Inspector, Network Inspector, Visual Event Flow.
- **Event Explorer** (`/dev/command-center/events`): tela dedicada, inspirada em Temporal/Stripe Events/Supabase Logs — cada evento abre e mostra payload, origem/destino, correlação, duração real (tempo desde o primeiro evento da mesma correlação) e um botão de replay (reaproveitando `POST /api/dev/replay`, estendido com filtro por `id` único).
- **State Inspector** (`services/state-inspector.service.ts`): seleciona uma mesa e mostra estado atual/campanha/histórico/playbooks ativos/previsão/ROI — tudo composto de funções de serviço já existentes, nenhum cálculo novo.
- **Network Inspector**: expõe o `ApiRequestLog` (Fase 9) numa tela nova, com taxa de acerto de cache (Resolution/Analytics Engine, Fase 1/7).
- **Visual Event Flow** (`components/dev/visual-event-flow.tsx`): partículas reais (nunca decorativas) viajando por um pipeline NFC → Resolution Engine → Event Bus → Analytics → Playbooks → Command Center — cada partícula nasce de uma linha genuína de `EventLog`, via polling e diff por id.
- **Nenhum banco de dados embarcado/em memória foi construído** — decisão de escopo deliberada e documentada (ver **ADR-054**).
- **Achado e corrigido durante a própria construção, um erro real de build:** `/demo` estava sendo pré-renderizada estaticamente pelo Next.js (todo Server Component `async` sem sinal de dinamismo é candidato a página estática por padrão) — o que congelaria os dados da Bella Vista no momento do build, e também travou o build de verdade contra as credenciais de banco placeholder deste sandbox. Corrigido com `export const dynamic = "force-dynamic"` em `/demo` e `/demo/investor`.
- **Achado e corrigido sob Zero Dívida Silenciosa:** a lista de tipos de evento do seletor de Event Replay (`/dev/ceo/reliability`) estava desatualizada desde a Fase 11 — faltavam os 3 eventos de Playbook (`RecomendacaoGerada`/`PlaybookExecutado`/`PlaybookDesfeito`). Corrigida.

## Demo OS Review (nova regra permanente, primeira fase em que se aplica)

**As cinco perguntas obrigatórias:**

1. **Impressiona em 30 segundos?** Sim — o hero do `/demo` já mostra o nome da marca ativa e um botão único ("Assistir a operação acontecer"); clicar já dispara o primeiro momento real em segundos, sem nenhuma tela de configuração antes.
2. **Funciona sem cadastro?** Sim, literalmente — `/demo` não chama `requireAuthContext()` em nenhum ponto; toda leitura/escrita resolve pela empresa fixa de demonstração (`getDemoCompany()`), protegida por limite de taxa por IP em vez de sessão.
3. **Conta uma história completa?** Sim — os 9 momentos (`STORY` em `demo-os-view.tsx`) formam um arco com início (o salão ganha vida), meio (playbooks percebem e o AutoPilot age) e fim (ROI muda, a marca troca) — nunca telas soltas sem conexão narrativa.
4. **Parece produção ou protótipo?** Os componentes reaproveitados (Mapa de Mesas, Heatmap, Recommendation Center, BrandProvider) já são os componentes de produção reais — o Demo OS nunca constrói uma segunda versão "de mentira" de nenhuma tela.
5. **Existe um momento "uau"?** Sim — a troca de marca instantânea no fim da história (a mesma operação, quatro identidades visuais diferentes, sem reload) e o AutoPilot aplicando uma recomendação sozinho no meio dela.

**Veredito honesto:** a história É real (dados genuínos, motores genuínos) — o que este sandbox não permite provar é a experiência visual completa ao vivo, já que não há Postgres real aqui (ver "Como isso foi verificado" abaixo). O Demo OS Review pergunta sobre a EXPERIÊNCIA, que foi desenhada e implementada por completo; provar que ela "impressiona" de fato exige um ambiente com banco real, fora do alcance deste sandbox.

## Self-Healing Development (nova regra permanente de engenharia, primeira fase em que se aplica)

**"Nunca mais depender de editar `middleware.ts`/`layout.tsx` para testar."** Cumprida literalmente: os dois arquivos ganharam um único ponto de decisão condicional cada (`isDevRuntimeEnabled()`), permanente e commitado — nenhum comentário "TEMP" existe mais neles. Verificado contra um erro real, não hipotético: com `DEV_RUNTIME=1`, `/dashboard` parou de lançar o erro do Clerk ("can't detect clerkMiddleware()") e passou a falhar exatamente no próximo limite genuíno (Postgres inalcançável neste sandbox) — confirmado pelo stack trace mostrando `getDevRuntimeAuthContext → prisma.user.findFirst`, nunca mais o Clerk. Esta é a prova de que o mecanismo funciona, não uma alegação.

## Zero Fake Demo (nova regra permanente de engenharia, primeira fase em que se aplica)

**"Nenhuma tela pode fingir dados."** Cada um dos 7 cenários do Scenario Engine grava linhas reais em `RedirectLog`/`Visit`/`RatingEvent` e publica eventos reais no Event Bus — nunca escreve um estado de React desconectado do banco. O único cenário sem efeito de servidor ("Franquia") é honestamente descrito como puramente client-side (troca de `BrandProvider`), nunca disfarçado de chamada real. O Demo OS lê exatamente as mesmas tabelas que o dashboard real (`RedirectLog`, `RatingEvent`, `PlaybookRecommendation`) através dos mesmos serviços — não existe uma segunda fonte de dados "de demonstração" em lugar nenhum do código.

## Autonomy Review (continua a partir da Fase 11)

O único novo comportamento autônomo desta fase é o cenário "AutoPilot Trabalhando", que reaproveita — sem alterar — o AutoPilot Engine da Fase 11: (1) age sozinho, mas só depois de `setAutoPilotLevel(ctx, "AUTOMATIC")` explícito; (2) o usuário entende por quê — a mesma recomendação com o mesmo `triggeredBy="AUTOPILOT"` de sempre; (3) Undo disponível, herdado sem mudança; (4) limite de segurança, herdado sem mudança (confiança ≥75%, teto diário); (5) log completo, herdado sem mudança. Nada de novo foi introduzido no motor de autonomia em si — só uma forma de acioná-lo sob demanda, para fins de demonstração.

## Enterprise Brand Review (continua a partir da Fase 10)

O White Label Live Switch é, por definição, o Enterprise Brand Review em ação: a MESMA tela do Demo OS, a MESMA operação por baixo, com identidade visual trocando por completo (cor, nome) em tempo real via `BrandProvider` — nenhum resquício da marca anterior, nenhuma tela com "cara de plataforma genérica" no meio da transição. Os dois nomes fictícios novos (Sushi House, Nova Steakhouse) foram escolhidos deliberadamente genéricos, nunca uma marca real de terceiro, mesmo dentro de uma demonstração.

## Franchise First Review (continua a partir da Fase 10)

- **Dev Command Center v2**: cada painel novo (`getWebhookHealth`, `getPlaybookAutomationSummary`) é uma consulta indexada por `companyId`, mesmo padrão O(1) por tenant já estabelecido.
- **Scenario Engine**: toda mutação é escopada à empresa fixa de demonstração — rodar um cenário nunca afeta nem lê dado de outra empresa.
- **Limite reconhecido, não escondido:** `/api/demo/*` e `/api/dev/demo/*` seguem resolvendo uma única empresa fixa por slug — nenhuma das duas árvores foi desenhada para multi-tenant real ainda (não era o pedido desta fase: "Demo OS" é uma vitrine de UMA operação, não um ambiente multi-empresa).

## Platform First Review (continua a partir da Fase 9)

Nenhuma rota `/api/v1/**` foi tocada nesta fase. As novas rotas `/api/demo/**` seguem exatamente o mesmo padrão de toda rota interna já existente (Zod onde há entrada de usuário, `handleApiError`, JSON consistente) — a única rota pública nova com efeito colateral (`POST /api/demo/scenarios/:id/run`) tem sua própria proteção de taxa dedicada (`demoScenario`, `lib/rate-limit.ts`), documentada e nomeada, não emprestada de outro limiter por acidente.

## WOW Factor Review

**"O que faria alguém dizer 'nunca vi um SaaS fazer isso'?"** O Visual Event Flow — ver partículas reais (nunca uma animação decorativa solta) nascendo de eventos genuínos do Event Bus e viajando por um pipeline visual NFC→Resolution Engine→Event Bus→Analytics→Playbooks→Command Center é o tipo de visualização que produtos de infraestrutura (Temporal, Inngest) cobram caro para oferecer, aqui construída sobre dados que o produto já registrava desde a Fase 8.

**Melhoria de alto impacto implementada sem gerar dívida técnica:** a extensão do `usePlayback` (velocidade + salto para momentos importantes) é aditiva — o único outro consumidor (Time Machine do Mapa de Mesas) continua funcionando bit a bit igual, sem precisar de nenhuma mudança no seu próprio código.

## Reliability Review (continua a partir da Fase 8)

1. **Essa funcionalidade continua funcionando sob alta carga?** Sim — o Scenario Engine roda em lotes com `Promise.all` limitados (até 40 cartões por cenário), e a rota pública tem limite de taxa por IP.
2. **Existe algum ponto único de falha?** Não novo — o Dev Runtime é auth pura (sem I/O externo além do Prisma que já existia); o Visual Event Flow degrada silenciosamente (sem partículas) se `/api/dev/events` falhar.
3. **O redirecionamento público continua protegido?** Sim, inalterado — `/r/[code]` não foi tocado.
4. **Existe degradação graciosa quando Redis/filas/serviços externos falham?** Sim — `getLastScenario`/`recordLastScenario` são best-effort (sem Redis, o widget "cenário atual" simplesmente mostra "nenhum"); `getCommandCenterSnapshot` isola cada sub-leitura em `try/catch` próprio, mesmo padrão do Reliability Engine.
5. **Os eventos podem ser recuperados sem perda importante?** Sim, sem mudança — o Event Explorer/replay reaproveitam o `EventLog` durável da Fase 8.
6. **A observabilidade permite descobrir rapidamente onde um problema começou?** Sim, e melhor agora — o Event Explorer torna a correlação de um evento (de onde veio, o que mais aconteceu na mesma sequência) visualmente navegável pela primeira vez, não só uma consulta de banco.

## Revenue Review (continua a partir da Fase 7)

1. **Essa funcionalidade aumenta a percepção de valor da assinatura?** Indiretamente forte — um Demo OS público é uma ferramenta de vendas/aquisição, não uma funcionalidade que o cliente pagante usa diariamente.
2. **O empresário entenderia quanto dinheiro isso pode gerar ou economizar?** Sim, através do próprio Demo OS — o momento "ROI muda" mostra receita influenciada estimada em tempo real, a resposta mais direta possível.
3. **Existe algum insight que justifique renovar o plano mensal?** Não diretamente desta fase — é uma ferramenta de aquisição/demonstração, não um recurso do produto pago em si.
4. **Existe algum recurso digno de aparecer na página de vendas?** Sim, fortemente: "veja o NFC OS funcionando agora, sem cadastro" em `/demo` é literalmente um recurso de página de vendas.
5. **Existe alguma oportunidade de transformar dados em recomendação automática?** Não desta fase — o Demo OS mostra recomendações já existentes (Fase 11), não gera novas categorias delas.

## Demo First Review (continua a partir da Fase 6)

1. **Essa funcionalidade impressionaria um investidor em uma demonstração de 2 minutos?** Esta é literalmente a fase que constrói essa demonstração — `/demo/investor` foi desenhado exatamente para isso.
2. **Um dono de restaurante entenderia o valor em menos de 30 segundos?** Sim — o Demo OS não pede nenhum conhecimento técnico, só assistir.
3. **Existe um momento "uau" claramente perceptível?** Sim — ver Demo OS Review acima.
4. **O comportamento parece software premium ou apenas funcional?** Premium — glass/blur/gradientes vivos no hero e nas narrações, reaproveitando os tokens de design já estabelecidos (`--brand`, `brand-glow`, `brand-ripple` da Fase 10).
5. **Existe uma animação/transição que comunique melhor o estado sem prejudicar performance?** Sim — a narração flutuante (`AnimatePresence`) e as partículas do Visual Event Flow, ambas com Framer Motion já instalado, nenhuma dependência nova.

## Product Review (continua a partir da Fase 5)

1. **A experiência parece um produto premium, ou apenas uma tela de admin?** O Demo OS, sim, claramente premium — é a tela mais cinematográfica do produto até agora. O Dev Command Center v2 é uma ferramenta de engenharia, deliberadamente mais utilitária (Vercel/Stripe-style), não uma vitrine.
2. **Existe algum atrito desnecessário?** Evitado: `/demo` não pede nada antes do primeiro clique; o Event Explorer abre o detalhe de um evento com um único clique, sem navegação adicional.
3. **A interface exige mais cliques do que precisa?** Não — o Investor Mode existe exatamente para remover todo clique da experiência quando o contexto pede isso (uma sala cheia assistindo, não uma pessoa explorando).
4. **Existe uma forma mais intuitiva de fazer a mesma tarefa?** O seletor de velocidade da Demo Timeline (1x/2x/5x) é mais direto que exigir escolher uma janela de tempo manualmente.
5. **Um gerente de restaurante aprenderia isso em menos de 2 minutos?** O Demo OS sim; o Dev Command Center v2 não precisa (é uma ferramenta de engenharia, mesmo raciocínio de toda `/dev/*` anterior).
6. **Oportunidade de "uau" que não custa nada?** O distintivo "Ao vivo · N eventos" no cabeçalho do Demo OS — um contador real, não decorativo, que cresce visivelmente enquanto a história avança.

## Achados do Architect Review (corrigidos proativamente, não pedidos) — incluindo Zero Dívida Silenciosa

1. **O achado técnico mais significativo desta fase, um erro real de build:** `/demo` estava sendo pré-renderizada estaticamente pelo Next.js — descoberto batendo de frente com uma falha real de `npm run build` (não uma suposição), com a mensagem exata `SASL: SCRAM-SERVER-FIRST-MESSAGE` disparada durante `Generating static pages`. Corrigido com `export const dynamic = "force-dynamic"` em `/demo` e `/demo/investor` — a mesma classe de descoberta do Edge-Runtime/Prisma da Fase 10 (ADR-042): um limite real do framework, encontrado testando de verdade, não lendo o código com cuidado.
2. **Inconsistências visuais/renderizações redundantes — procurado, não encontrado:** o Demo Timeline usa sua própria instância de `usePlayback`, deliberadamente separada da instância interna do `TableMapView` — documentado como uma escolha honesta (ver Riscos abaixo), não uma duplicação acidental de estado.
3. **Vazamento de cenário — verificado, não encontrado:** toda mutação do Scenario Engine passa por `getDemoCompany()`, a mesma empresa fixa de sempre — nenhum cenário aceita um `companyId` de fora.
4. **Animações pesadas — verificado, mitigado por desenho:** o Visual Event Flow limita a 12 partículas simultâneas (`.slice(-12)`); a narração usa `AnimatePresence mode="wait"` (uma transição de cada vez, nunca acumulando). Nenhuma animação nova ignora `prefers-reduced-motion` — todas reaproveitam os utilitários já existentes desde a Fase 10 (`.brand-glow`/`.brand-ripple`) ou o comportamento padrão do Framer Motion, coberto pelo bloco `@media (prefers-reduced-motion: reduce)` já global em `globals.css`.
5. **Regressão de performance — verificado, não encontrado:** nenhuma rota nova faz consulta N+1; o Command Center v2 usa `Promise.all` para paralelizar as 5 sub-leituras do snapshot, mesmo padrão do Reliability Engine.
6. **Duplicação de estados — encontrado e aceito conscientemente, não corrigido:** o Demo Timeline (feed próprio) e o `TableMapView` embutido no Demo OS têm cada um sua própria conexão SSE/Playback — uma duplicação real de conexão, mas deliberada (ver ADR-053/Riscos): unificar os dois exigiria expor um controlador de playback externo de dentro do `TableMapView`, uma mudança estrutural maior que o escopo desta fase justificava.
7. **Compatibilidade com toda fase anterior:** `usePlayback` manteve sua assinatura de retorno original (`playing`/`progress`/`play`/`stop`) mais campos aditivos — o único outro consumidor (`table-map-view.tsx`) não precisou de nenhuma mudança.

## Como isso foi verificado (não só compilado)

Todos os quatro quality gates (`tsc --noEmit`, `eslint .`, `prisma validate`, `npm run build` com um `.env.local` temporário completo) passam limpos — **dois builds completos de produção nesta fase**, não um: o primeiro capturou o bug real de pré-renderização estática do `/demo` (ver Achados acima), o segundo confirmou a correção.

**Verificação interativa usou, pela primeira vez, o PRÓPRIO Dev Runtime desta fase** — não mais o harness descartável: `DEV_RUNTIME=1` num `.env.local` temporário, com `middleware.ts`/`layout.tsx` NUNCA editados (a mudança real desta fase, provada em uso). Confirmado via inspeção real de rede/logs:
- **`GET /dashboard` com Dev Runtime ativo:** parou de lançar o erro do Clerk; o stack trace mostrou `DashboardPage → requireAuthContext → getDevRuntimeAuthContext → PrismaPgAdapter`, falhando só no limite genuíno do sandbox (Postgres inalcançável) — a prova de que o bypass funciona de ponta a ponta.
- **`GET /api/demo/scenarios`:** `200 OK` com o catálogo real dos 7 cenários — sem precisar de banco, confirmando que o endpoint somente-leitura funciona mesmo neste sandbox sem Postgres.
- **`GET /demo` e `GET /dev/command-center`:** `500`, confirmado nos logs como o MESMO `SASL: SCRAM-SERVER-FIRST-MESSAGE` (Postgres indisponível) — nunca o erro do Clerk, nunca uma classe nova de falha.
- **Build de produção:** todas as ~25 rotas novas (`/api/demo/**`, `/api/dev/{command-center,events,network-inspector,state-inspector}/**`, `/demo`, `/demo/investor`, `/dev/command-center`, `/dev/command-center/events`) aparecem corretamente no manifesto final, com `/demo`/`/demo/investor` corretamente marcadas dinâmicas (`ƒ`) e as páginas `/dev/*` corretamente estáticas (`○`, já que `notFound()` roda antes de qualquer I/O quando `NODE_ENV=production`).

**O que não pôde ser provado neste sandbox:** a experiência visual completa do Demo OS ao vivo (glass/motion/narração/heatmap respirando) — todas essas telas exigem Postgres real para renderizar além do ponto de falha documentado; o Scenario Engine realmente disparando (criando linhas, publicando eventos) contra um banco de verdade; o AutoPilot executando de fato dentro do cenário "AutoPilot Trabalhando"; o Visual Event Flow recebendo partículas de eventos reais fluindo. Tudo isso foi verificado por leitura de código + type-check + build limpo, não por observação ao vivo — a mesma limitação, pelo mesmo motivo, de toda fase anterior desde a Fase 6.

## Migração

Nenhuma mudança de schema Prisma nesta fase — a única mudança de dado é aditiva no seed (`prisma/seed.ts`): duas novas empresas fictícias (Sushi House, Nova Steakhouse) para o White Label Live Switch, sem nenhum campo novo em nenhum modelo existente.

## Riscos carregados adiante

- Nenhum banco de dados embarcado/em memória foi construído — sem um Postgres real configurado, páginas que dependem de dados continuam falhando no mesmo ponto de sempre (ver ADR-052/ADR-054).
- O Scenario Engine deixa dados sintéticos permanentes na empresa de demonstração a cada execução — sem limpeza/expiração automática.
- O cenário "AutoPilot Trabalhando" muda o nível de AutoPilot da empresa de demonstração para Automático permanentemente, até ser mudado de volta manualmente — um efeito colateral real do cenário, não escondido.
- O Visual Event Flow mostra até onde um TIPO de evento normalmente chega, num mapa fixo — não rastreia o caminho realmente percorrido por UM evento específico através das filas (exigiria tracing distribuído que este produto não tem, ver ADR-034).
- A Demo Timeline tem sua própria conexão de playback, separada da embutida no `TableMapView` do Demo OS — replay na timeline não anima visualmente o mapa acima dela (ver Achados do Architect Review, item 6).
- White Label Live Switch troca só a marca (cor/nome) sobre a MESMA operação da Bella Vista — nunca uma segunda operação simulada com dados próprios.
- `/demo`, `/demo/investor` e `/dev/command-center` não são verificáveis interativamente de ponta a ponta neste sandbox (exigem um Postgres real) — mesma limitação de todo `/dashboard/*`/`/dev/ceo/*` desde fases anteriores, não uma regressão desta fase.

## Próximos passos

Aguardando aprovação para iniciar a **Fase 13 — AI Copilot & Marketplace OS**, cuja preparação arquitetural (não implementação) já está registrada em ADR-046.
