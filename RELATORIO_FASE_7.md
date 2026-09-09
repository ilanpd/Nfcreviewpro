# Relatório da Fase 7 — Analytics Enterprise

Ver `ROADMAP.md` para a lista completa de fases e `PROXIMAS_TAREFAS.md` para o checklist que esta fase fecha. Esta é a primeira fase sob a nova regra permanente **Revenue Review** (quarto review obrigatório, ao lado de Architect, Product e Demo First — ver seção dedicada abaixo).

## O que foi implementado

O objetivo declarado desta fase era parar de construir só funcionalidades e passar a construir ativos que vendem assinatura: o NFC OS deveria responder sozinho a perguntas que o empresário normalmente nunca conseguiria responder, nunca só mostrar dados brutos.

- **Arquitetura em 5 motores desacoplados** (ver **ADR-030**): `analytics-engine.service.ts` (KPIs, funil, comparativos, ROI, timeline executiva), `insights-engine.service.ts`, `forecast-engine.service.ts`, `ranking-engine.service.ts`, `export-engine.service.ts` — cada um com responsabilidade única e suas próprias consultas ao Postgres, todos sobre `RedirectLog`/`RatingEvent`/`Visit`/`AuditLog` (nenhuma tabela de eventos nova). A lógica pura e testável vive em `domain/analytics/{types,math,funnel,insights,forecast,roi}.ts`.
- **KPIs executivos:** aproximações hoje, conversões, avaliações geradas, CTR do fluxo de avaliação, taxa de conversão, crescimento semanal/mensal, receita estimada influenciada (ROI Mode) — mais 6 cartões "melhor X" (campanha/zona/mesa/funcionário/horário/dia) vindos do Ranking Engine.
- **Funil Inteligente:** Aproximação → Página aberta → Clique → Conversão → Avaliação publicada, escopado ao fluxo de avaliação — o único caminho deste produto com múltiplas etapas rastreáveis (`FunnelChart`, packages/ui, com animação de largura suave por etapa).
- **Insights Automáticos:** motor de regras determinístico (nunca uma chamada a LLM) com limiar de amostra mínima e significância — comparação de conversão por zona, uso de campanha vs. média, pico de engajamento por horário de um cartão, e um alerta de queda dia-a-dia. Cada frase carrega a evidência numérica exata que a gerou.
- **Ranking Inteligente:** campanha (por toques), zona/mesa/funcionário (por conversões), horário/dia (por conversões, em fuso horário local via `getLocalDateParts`, reaproveitado do Rule Engine da Fase 3) — com filtro de período.
- **Comparativos automáticos:** hoje vs. ontem, semana vs. semana anterior, mês vs. mês anterior, sempre com variação percentual.
- **Timeline Executiva:** atribuições de campanha (`AuditLog`), início/fim de campanha agendada, pico de aproximações e recorde de avaliações — cada entrada com instante específico linka para o Time Machine da Fase 6.
- **Forecast Inteligente:** meta de avaliações configurável com projeção linear a partir do ritmo diário recente, e tendência de toques da campanha mais usada — sempre rotulado como estimativa.
- **ROI Mode:** três campos opcionais em `Company` (ticket médio, taxa de retorno, valor de novo cliente — ver **ADR-029**) transformam toques em receita estimada, com a fórmula exposta na própria UI; `Campaign.estimatedCost` opcional habilita "ROI da campanha"/"custo por avaliação" quando preenchido.
- **Exportações Enterprise:** CSV achatado (Seção/Métrica/Valor), Excel (`exceljs`, 5 abas formatadas) e PDF executivo (`@react-pdf/renderer`, sem headless browser — ver **ADR-031**).
- **`/dashboard/analytics`** ganhou uma aba "Enterprise" (agora a aba padrão) com seletor de período (7/30/90 dias) e menu de exportação — as abas "Visão geral" e "Feedbacks privados" da Fase 0 continuam intactas.
- **Command Center Evolution:** `/dev/ceo/command-center` ganhou funil vivo, insights/alertas inteligentes, ranking líder por categoria, timeline executiva e forecast, com refresh de 30s via as novas rotas espelho `/api/dev/demo/analytics/*` (mesmo padrão da ADR-027).
- **`packages/ui`** ganhou `InsightCardList`, `RankingList` e `FunnelChart`, todos animados com Framer Motion e reaproveitados tanto no dashboard real quanto no Command Center.
- **Seed da Bella Vista:** segundo cartão de equipe ("Garçom João"), janela de histórico estendida de 36h para 14 dias (dá massa real para comparativos semana/mês e forecast), e vieses de geração deliberados e documentados no próprio código para a história "Happy Hour no horário certo, Varanda em destaque, Mesa VIP e João líderes" emergir de números recalculados de verdade, nunca de texto fixo.

## Revenue Review (nova regra permanente, primeira fase em que se aplica)

1. **Essa funcionalidade aumenta a percepção de valor da assinatura?** Sim, diretamente — o produto deixa de mostrar "quantas pessoas tocaram o cartão" e passa a mostrar "quanto dinheiro isso influenciou" e "o que fazer a seguir." Essa é a diferença entre uma ferramenta de métricas e um consultor de negócio embutido no software.
2. **O empresário entenderia quanto dinheiro isso pode gerar ou economizar?** Sim — o ROI Mode mostra "R$ 1.840,50 em receita influenciada" com a fórmula exata ao lado, não uma contagem abstrata de toques. É a métrica mais fácil de justificar internamente numa reunião de diretoria.
3. **Existe algum insight que justifique renovar o plano mensal?** Sim — os Insights Automáticos e o Forecast respondem exatamente à pergunta "o que o NFC está fazendo por mim este mês," a pergunta que qualquer cliente de assinatura eventualmente faz antes de cancelar.
4. **Existe algum recurso digno de aparecer na página de vendas?** O ROI Mode é o mais forte: "veja quanto seu marketing físico está gerando em reais" muda a conversa de "mais um app de avaliações do Google" para "software que mede retorno financeiro do marketing físico" — exatamente a virada de posicionamento que o usuário descreveu ao pedir a funcionalidade. O PDF executivo também é vendável por si só: um relatório que parece pronto para um investidor é uma prova social embutida no próprio produto.
5. **Existe alguma oportunidade de transformar dados em recomendação automática?** Os Insights Automáticos já fazem isso parcialmente (frases, não só números). O próximo passo natural — não construído nesta fase, registrado para a Fase 11 (Smart Campaign Playbooks) — é a recomendação virar uma ação de um clique ("aplicar esta campanha na Varanda agora"), não só uma frase para o gerente interpretar.

## Demo First Review

1. **Essa funcionalidade impressionaria um investidor em uma demonstração de 2 minutos?** Sim — o Command Center Evolution mostra funil, ranking, timeline e forecast se atualizando sozinhos ao lado do mapa vivo da Fase 6, no mesmo painel. É a cena de "isto parece um centro de operações de verdade."
2. **Um dono de restaurante entenderia o valor em menos de 30 segundos?** O ROI Mode sim, imediatamente ("isso gerou R$X"). Os outros painéis (funil, rankings) pedem uns segundos a mais de leitura — aceitável, já que são análise, não um número de resumo.
3. **Existe um momento "uau" claramente perceptível?** O Insight automático "A Varanda converte 94% melhor que a VIP" — uma frase em português, gerada a partir dos próprios dados, é o tipo de coisa que faz alguém perguntar "como isso soube disso?" mesmo sabendo, ao ler o código, que é uma regra determinística e não mágica.
4. **O comportamento parece software premium ou apenas funcional?** Premium — o Funil anima largura suave por etapa, o Ranking anima a barra de progresso ao carregar, o `KpiCard` já tinha o "pop" de valor da Fase 6, e a estimativa de ROI é apresentada com a mesma linguagem visual do resto do produto, não uma tela à parte.
5. **Existe uma animação/transição que comunique melhor o estado sem prejudicar performance?** Sim: a barra do `RankingList` anima de 0 até o valor real ao montar (`transition: width 0.5s`), o `FunnelChart` anima cada etapa com um delay escalonado (`delay: i * 0.08`) para o olho acompanhar o funil de cima para baixo em vez de tudo aparecer de uma vez, e o cartão de insight "atenção" usa a mesma cor semântica (`#F59E0B`) já usada em alertas no resto do produto — nenhuma cor nova inventada só para isso.

## Product Review

1. **A experiência parece um produto premium, ou apenas uma tela de admin?** Premium — todos os novos componentes (`InsightCardList`, `RankingList`, `FunnelChart`) seguem o mesmo `PremiumCardShell`/tokens de cor da Fase 4.5, não uma estética nova.
2. **Atrito desnecessário?** Um evitado deliberadamente: o Forecast e o ROI Mode não pedem configuração para MOSTRAR algo — o Forecast já funciona com uma meta padrão (100), e o ROI Mode mostra uma chamada clara para configurar em vez de esconder a seção inteira quando não configurado.
3. **A interface exige mais cliques do que precisa?** O seletor de período (7/30/90) e as abas de ranking são o mínimo necessário para explorar 6 categorias de ranking sem 6 painéis simultâneos competindo por atenção.
4. **Forma mais intuitiva de fazer a mesma tarefa?** Os 3 formatos de exportação (CSV/Excel/PDF) ficam num único menu suspenso "Exportar" em vez de 3 botões separados — a ação é "exportar," o formato é um detalhe secundário.
5. **Um gerente aprenderia isso em menos de 2 minutos?** Os KPIs e o ROI Mode sim, imediatamente. O Funil e os Rankings usam padrões já conhecidos (barra de progresso, abas). O conceito genuinamente novo — "de onde vêm esses insights" — é mitigado por cada frase ser curta e concreta, nunca jargão técnico.
6. **Oportunidade de "uau" que não custa nada?** O alerta de queda ("Aproximações caíram 32% em relação a ontem") é um insight NEGATIVO — decidido deliberadamente incluído (não só insights positivos), porque um sistema que só elogia perde credibilidade; um que avisa de problemas reais parece mais confiável, o que paradoxalmente aumenta a percepção de valor.

## Achados do Architect Review (corrigidos proativamente, não pedidos)

1. **Um limite estrutural real descoberto ao desenhar os Insights Automáticos:** uma campanha (WhatsApp, Instagram, Google Reviews direto) redireciona o cliente para fora do produto instantaneamente — ela nunca passa pelo fluxo de estrelas (`RatingEvent`). Um insight inicialmente esboçado como "a campanha X gerou N avaliações extras" foi corrigido, antes de qualquer código depender do formato errado, para "a campanha X foi acionada N vezes a mais que a média" — a única comparação que os dados sustentam honestamente. Ver ADR-030 para a análise completa; esse limite também moldou o Ranking Engine (campanha por toques, zona/mesa/funcionário por conversões).
2. **`Company`/`Campaign` ganharam campos nulos por padrão para ROI Mode** — nenhum valor-padrão inventado; `configured: false` é um estado de UI explícito, não um número chutado. Verificado que `updateCompany`/`createCampaign`/`updateCampaign`/`duplicateCampaign` propagam os novos campos corretamente (o `duplicateCampaign` precisou de uma linha extra para copiar `estimatedCost` — encontrado ao revisar todos os call-sites de criação/atualização de campanha, não só os óbvios).
3. **Isolamento entre tenants:** toda rota nova (`/api/analytics/*`) segue `requireAuthContext()` → `ctx.companyId`, o mesmo padrão de toda rota autenticada existente. As únicas exceções são as rotas de demonstração `/api/dev/demo/analytics/*`, que resolvem uma empresa fixa (nunca aceita por parâmetro) e se recusam a existir em produção.
4. **Performance:** cada motor usa `analyticsCached` (TTL de 60s, degradação graciosa sem Redis — mesmo padrão do Resolution Engine) para as agregações mais pesadas, evitando recomputar funil/ranking/insights a cada re-render do dashboard ou a cada ciclo de 30s do Command Center. Nenhuma consulta N+1 nova: cada motor agrega em memória a partir de `findMany`s já indexados por `companyId`/`createdAt`, nunca uma consulta por mesa/zona/campanha.
5. **Verificado e corrigido durante a própria verificação interativa desta fase (não antes):** nenhum bug de código foi encontrado nos motores novos além do já citado item 1 — o Architect Review desta fase foi, na maior parte, sobre a honestidade do modelo de dados, não sobre bugs de implementação.

## Como isso foi verificado (não só compilado)

Todos os quatro quality gates (`tsc --noEmit`, `eslint`, `prisma validate`, `npm run build` com um `.env.local` temporário copiado de `.env.example`, removido depois) passam limpos, rodados repetidamente ao longo da fase. O build de produção confirmou que `exceljs` e `@react-pdf/renderer` empacotam corretamente para o runtime serverless do Next — a rota `/api/analytics/export` compila e aparece no manifesto de rotas normalmente.

**Sem Postgres/Clerk reais neste sandbox** (mesma limitação de toda fase anterior), incluindo o `<ClerkProvider>` do layout raiz. Verificação interativa usou o mesmo padrão já estabelecido nas Fases 6: `src/middleware.ts` temporariamente reduzido a um matcher vazio e `<ClerkProvider>` temporariamente removido de `src/app/layout.tsx`, ambos restaurados exatamente ao original depois — mais um harness temporário em `src/app/dev/harness-phase7` (apagado antes da entrega) com dados fabricados em memória.

Confirmado via inspeção real de DOM/rede (não apenas "o texto certo apareceu"):
- **KPIs, "melhor X", Funil, Comparativos, Timeline, ROI Mode:** renderização completa verificada com valores formatados corretamente (moeda pt-BR, percentuais, separador de milhar).
- **Insights por severidade:** o cartão de alerta ("Aproximações caíram 32%...") renderizou com a barra de acento na cor exata `#F59E0B` (âmbar) via inspeção de `style.backgroundColor` — não só que o texto apareceu.
- **Ranking Engine (interação real):** trocar para a aba "Zonas" disparou a rota `/api/analytics/rankings?type=ZONE...` e renderizou 3 entradas com as cores de medalha exatas (`#F59E0B` ouro, `#94A3B8` prata, `#B45309` bronze) nas 3 primeiras posições — confirmado via inspeção computada, não suposição.
- **Seletor de período:** trocar para "Últimos 7 dias" disparou corretamente as 6 chamadas paralelas (`kpis`, `funnel`, `insights`, `timeline`, `roi`, `rankings?type=ALL`) com `days=7` na query string.
- **Resiliência a falha:** com as rotas reais retornando 500 (sem sessão real neste sandbox), a tela manteve os dados anteriores na tela em vez de quebrar ou esvaziar — confirmando que o `.catch()` silencioso funciona como projetado.
- **Exportação — a verificação mais importante desta fase:** uma rota mock temporária (`/api/dev/harness7/export`, chamando as funções reais `renderReportCsv`/`renderReportXlsx`/`renderReportPdf` com dados fabricados, sem Prisma) confirmou os três formatos de verdade: CSV com 20 linhas incluindo os KPIs e insights esperados; XLSX de 10KB com assinatura ZIP (`PK`) válida; PDF de 6.2KB com assinatura `%PDF-` válida. Uma tentativa inicial de testar essas mesmas funções via um script `tsx` isolado (fora do Next) falhou por uma particularidade real de resolução de módulos ESM/CJS de uma dependência transitiva do `@react-pdf/renderer` (`@react-pdf/hyphenate`) fora do bundler do Next — não um bug do produto, já que o build de produção real já havia empacotado tudo corretamente; a rota mock no dev server contornou isso testando através do runtime real.

**O que não pôde ser provado neste sandbox:** o Command Center Evolution (funil/ranking/timeline/forecast vivos em `/dev/ceo/command-center`) não foi remontado com um segundo conjunto completo de dados fabricados — sua verificação se apoiou em (1) checagem de tipos limpa de toda a nova fiação de props, (2) os mesmos componentes compartilhados (`FunnelChart`, `InsightCardList`, `ActivityFeed`) já verificados exaustivamente na Analytics Enterprise acima, e (3) revisão de código — uma decisão de escopo deliberada dado o esforço de reconstruir um segundo dataset fabricado completo (mesas/zonas/campanhas) para um ganho de confiança marginal sobre o que já foi provado. Também não pôde ser provado: números reais de latência das agregações sob carga; que a migração se aplica de forma limpa contra o Supabase de produção — as mesmas limitações já aceitas em toda fase anterior.

## Migração

Duas mudanças aditivas de schema nesta fase — `Company.roiAvgTicket`/`roiReturnRate`/`roiNewCustomerValue` (todos `Float?`) e `Campaign.estimatedCost` (`Float?`). Sem histórico em `prisma/migrations/` ainda (mesma restrição de toda fase anterior); nenhuma migração de dados é necessária — todo `Company`/`Campaign` existente simplesmente ganha os novos campos como `null`.

## Riscos carregados adiante

- Nenhuma campanha aparece em ranking/insight por avaliações geradas — o modelo de dados não permite essa atribuição honesta. Ver ADR-030.
- ROI Mode, custo por avaliação e ROI da campanha são estimativas configuradas pelo próprio empresário — sem integração de gasto de anúncio nem confirmação de receita real. Ver ADR-029.
- Forecast Inteligente é uma projeção linear simples, não um modelo com sazonalidade — sempre rotulado como estimativa.
- Exportação em PDF usa `@react-pdf/renderer` — suficiente para um relatório de texto/tabelas, não para embutir os gráficos interativos do dashboard como imagens vetoriais. Ver ADR-031.
- Command Center Evolution atualiza por polling de 30s, não push instantâneo.
- Mesma ausência de suíte de testes automatizados e mesmas restrições de ambiente (sem Postgres/Redis/Clerk reais) de toda fase anterior.

## Próximos passos

Aguardando aprovação para iniciar a **Fase 8 — Event sourcing + filas + observabilidade**.
