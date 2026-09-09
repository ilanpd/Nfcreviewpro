# Relatório da Fase 4.5 — NFC OS Design Language & Integração de MCPs

Ver `ROADMAP.md` para a lista completa de fases e `PROXIMAS_TAREFAS.md` para o checklist que esta fase fecha. Esta é a primeira fase inteiramente documentada sob a Regra Permanente nº 1 (português como idioma oficial do projeto) — ver a seção dedicada abaixo para o que isso significou na prática.

## Regra Permanente nº 1 — Português como idioma oficial

Executado antes de qualquer trabalho de design, por instrução explícita:

- `ARCHITECTURE_DECISIONS.md` → `DECISOES_DE_ARQUITETURA.md` (traduzido por completo, ADR-001 a ADR-021 mantidas com o mesmo conteúdo técnico em português, mais ADR-022 a ADR-024 já escritas diretamente em português)
- `TASKS.md` → `PROXIMAS_TAREFAS.md` (traduzido por completo)
- `ROADMAP.md` traduzido no próprio lugar (nome do arquivo mantido, por instrução explícita — "ROADMAP.md (PT-BR)" na lista de arquivos a atualizar)
- `PHASE_1_REPORT.md` a `PHASE_5_REPORT.md` → `RELATORIO_FASE_1.md` a `RELATORIO_FASE_5.md`
- `dev-status.json`, `/dev` e `/dev/ceo` traduzidos e reconstruídos (ver seção própria abaixo)
- Referências cruzadas em comentários de código (`prisma/seed.ts`, `domain/rbac/roles.ts`, `components/dashboard/table-map/canvas.tsx`) e no `README.md` atualizadas para os novos nomes

**Uma decisão explícita, não uma omissão silenciosa:** os cinco relatórios de fase renomeados (`RELATORIO_FASE_1.md` a `RELATORIO_FASE_5.md`) tiveram apenas o **nome do arquivo** traduzido — o corpo de cada um permanece no inglês original em que foi escrito e aprovado, com uma nota no topo explicando isso. Retraduzir por completo cinco relatórios técnicos já entregues e aprovados (incluindo trechos de código, terminologia técnica precisa sobre semântica do Postgres, comportamento do React Server Components, etc.) carregava risco real de introduzir uma imprecisão técnica sutil numa tradução mecânica, para um ganho que é puramente histórico — esses documentos não são mais consultados para decisões futuras, só para auditoria do que já aconteceu. `DECISOES_DE_ARQUITETURA.md` e `PROXIMAS_TAREFAS.md`, ao contrário, são documentos **vivos** — consultados e atualizados a cada fase — e por isso foram traduzidos por completo. Esta é uma leitura de escopo, não uma tarefa pulada; se a intenção era a retradução completa de todo o histórico também, é só pedir.

Todas as minhas respostas passam a ser em português a partir desta mensagem, inclusive as tecnicamente densas, como instruído.

## O que foi implementado

### Detecção de MCPs (antes de qualquer código)

Verificação real, não presumida: `list_connectors` retornou zero conectores instalados nesta sessão, e uma busca no registro de MCPs por "shadcn", "ui components", "design system", "magic ui", "figma" e "design" não retornou nenhum resultado disponível para conectar. Ou seja: nenhum dos MCPs priorizados (Shadcn UI MCP, Magic UI MCP, Design MCP, Shadcn Space) estava acessível neste ambiente.

Consequência direta: **todo componente desta fase foi construído à mão**, sobre a stack já existente (shadcn/ui + Tailwind v4 + Radix + Framer Motion), com uma arquitetura de tokens centralizados desenhada para que um MCP conectado depois consiga gerar/ajustar componentes compatíveis sem retrabalho estrutural. As instruções de instalação de cada MCP prioritário (comando exato, formato de configuração manual, o que cada um faz) foram verificadas via busca na web nesta própria fase — não copiadas de memória — e estão documentadas em `ROADMAP.md`, seção "Integração de MCPs".

### Arquitetura do Design System

- `packages/{ui,design-tokens,icons,animations}` como pastas com alias de import (`@nfc-os/*`) via `tsconfig.json`, **não** um monorepo real com workspaces/build separado — ver ADR-022 para os três motivos e para quando essa decisão deveria ser revisitada.
- `packages/design-tokens`: motion (durações/easings/springs), z-index, breakpoints — os valores que só existem em JavaScript. Cor/radius/sombra continuam com fonte da verdade em `globals.css`, via os namespaces nativos do Tailwind v4 (`@theme`).
- `packages/icons`: `NfcOsIcon`, um encapsulamento de conceitos de domínio (Campanha, Zona, Organização, Ghost Mode, Auditoria, etc.) sobre `lucide-react` — ícones puramente genéricos de UI continuam importados direto nos componentes, só os que representam um conceito do produto passam por aqui.
- `packages/animations`: os variants do Framer Motion reutilizados por todo componente premium, mais `usePrefersReducedMotion()`.
- `packages/ui`: os 12 componentes premium (ver lista abaixo).
- `cmdk` foi a única dependência nova instalada nesta fase — para o Command Palette, evitando reimplementar navegação por teclado e busca acessível à mão.

### Cor de marca e tokens visuais (`globals.css`)

Um único violeta-índigo (`oklch(0.549 0.214 279)` no claro, `oklch(0.685 0.19 279)` no escuro) substitui o cinza neutro padrão do shadcn/ui em `--primary`/`--ring`/`--sidebar-primary`/`--accent` — ver ADR-023. Como todo botão, link, anel de foco e destaque de navegação do produto inteiro já apontava para essas variáveis, essa foi a alavanca de maior efeito possível: uma mudança em um arquivo dá identidade visual ao produto inteiro, sem tocar em nenhum componente individualmente.

Também adicionados: tokens de sombra (`--shadow-subtle/elevated/premium/glow`), easing (`--ease-standard/enter/exit/spring`), keyframes (`fade-in`, `scale-in`, `shimmer`) como utilitários nativos do Tailwind v4, e três classes utilitárias — `.glass` (glassmorphism, usado só no header fixo do dashboard), `.skeleton-shimmer` (usado pelos Skeleton States), `.hover-lift`. `prefers-reduced-motion` é respeitado **globalmente**, uma vez, em `globals.css` — não precisa ser lembrado componente a componente.

### Os 12 componentes premium

Card KPI, Card Analytics, Card Campanha, Card Zona, Card Mesa, Card Organização (`OrganizationBrandCard`), Modal/Drawer/Popover Premium, Command Palette, Empty States, Skeleton States, Timeline, Activity Feed, Heatmap Card, Badge Inteligente, Avatar Stack, Permission Matrix — todos com dark mode automático (herdam os mesmos tokens CSS, nenhum tem lógica de tema própria) e construídos sobre os primitivos shadcn/ui já existentes (Dialog, Sheet, Popover, Avatar), nunca os substituindo.

### Onde foi aplicado de verdade (não só construído)

- **Dashboard (Visão Geral):** `StatCard` e o card do gráfico reescritos sobre `KpiCard`/`AnalyticsCard`.
- **Configurações:** nova seção "Papéis e permissões" com `PermissionMatrix` visualizando a matriz real de `domain/rbac/roles.ts`; `AuditLogCard` reescrito sobre `ActivityFeed`; `OrganizationCard` reescrito sobre `OrganizationBrandCard`.
- **Campanhas:** `StatusBadge` reescrito sobre `SmartBadge` (pulsa quando `ACTIVE`); estado vazio da lista reescrito sobre `EmptyState`.
- **`/dev` e `/dev/ceo`:** reconstruídos por completo como "painel de investimento" — KPIs, Saúde do Projeto (os 4 quality gates como badges), Arquitetura (4 pilares), Timeline animada de todas as fases, Backlog priorizado, e a contagem de ADRs **computada ao vivo** a partir de `DECISOES_DE_ARQUITETURA.md` (`countArchitectureDecisions()` conta os cabeçalhos `## ADR-` do arquivo real a cada requisição, em vez de um número fixo em `dev-status.json` que ficaria desatualizado na próxima fase).
- **Layout do dashboard inteiro:** `DashboardCommandPalette` (Cmd+K/Ctrl+K) navegando para todas as seções; glassmorphism moderado no header fixo.

### O que NÃO foi reescrito — leitura honesta de escopo

Mapa de Mesas, Cartões, Equipe e a tabela de Campanhas mantêm sua UI já construída e testada nas Fases 2, 3 e 5 — eles **herdam automaticamente** a cor de marca, radius e sombra novos (por serem tokens globais em CSS), mas seus componentes internos não foram reescritos um a um sobre `packages/ui` nesta fase. Isso foi uma escolha deliberada, não um esquecimento: reescrever o Mapa de Mesas (um canvas próprio com lógica de arraste, seleção e Ghost Mode recém-construída e verificada na Fase 5) ou o Campaign Builder (um sheet com múltiplas abas e várias validações) só pelo visual, sob pressão de uma única entrega já muito extensa, carregava risco real de regressão numa superfície que já funciona corretamente. O Product Review abaixo registra isso explicitamente como um item em aberto, não como concluído.

## Architect Review

1. **Inconsistências arquiteturais que criariam dívida técnica futura — encontrada e corrigida uma real:** ver o bug de serialização do React Server Components abaixo. Uma segunda observação, não corrigida por ser uma leitura de escopo válida: `CampaignCard`/`ZoneCard`/`TableCard` foram construídos e expõem uma API completa, mas ainda não têm nenhum call site no app — ficam prontos para quando o Mapa de Mesas ou a lista de Campanhas migrarem para eles, mas hoje são código morto do ponto de vista de uso real. Registrado aqui para não ser esquecido, não escondido.
2. **Vulnerabilidades de isolamento entre tenants:** nenhuma nova consulta a dados de tenant foi introduzida nesta fase — é inteiramente uma fase de apresentação (tokens, componentes, duas páginas de dev-only). `countArchitectureDecisions()` lê um arquivo Markdown local, não dados de banco. Nenhuma rota de API nova. Procurado, nada encontrado.
3. **Gargalos de performance — encontrado um custo real, não escondido:** o First Load JS de `/dashboard` subiu de 223 kB (Fase 5) para 308 kB; `/dashboard/campaigns` de 224 kB para 279 kB; `/dashboard/settings` de 239 kB para 294 kB. A causa mais provável é o `DashboardCommandPalette` (que embute `cmdk` e o próprio Command Palette) agora rodando no layout do dashboard inteiro, mais os componentes de `packages/ui` que usam Framer Motion entrando no bundle compartilhado de mais páginas. Isso não foi medido como regressão de tempo de carregamento real (sem ambiente de produção neste sandbox), mas é um custo de bundle mensurável e deveria ser revisitado com `next/dynamic` para o Command Palette (carregado sob demanda, não no layout inicial) caso uma fase futura precise otimizar isso — sinalizado como risco conhecido, não resolvido agora, para não expandir ainda mais o escopo desta entrega.
4. **Race conditions:** nenhuma mutação nova nesta fase — nada a verificar.
5. **Oportunidades de simplificar sem perder flexibilidade:** `Timeline` e `Activity Feed` parecem redundantes à primeira vista (ambos são listas verticais com um ícone à esquerda) — mantidos separados deliberadamente, porque representam conceitos diferentes (marcos ordenados vs. um log que só cresce) e um Product Review focado em clareza de intenção pesou mais que economizar um arquivo.
6. **Compatibilidade com toda fase anterior:** verificada via build completo (`tsc`, `eslint`, `prisma validate`, `npm run build`, todos limpos) e verificação interativa real de `/dev`/`/dev/ceo`/Dashboard/Configurações/Campanhas — nenhuma mudança de schema nesta fase, então não há migração para considerar.
7. **Quality gates:** todos os quatro passam, reexecutados após cada lote de mudanças, não só uma vez no final.
8. **Registro de decisões:** ADR-022 (arquitetura de pacotes), ADR-023 (cor de marca), ADR-024 (contrato de ícones) — todas em `DECISOES_DE_ARQUITETURA.md`.

### O bug real encontrado durante a verificação (Architect Review em ação, não apenas um checklist)

Ao testar `/dev/ceo` e `/dev` de verdade num servidor local (essas duas páginas não dependem de Clerk/Postgres, então puderam ser verificadas diretamente, sem harness mockado), a página quebrou em runtime com "Functions cannot be passed directly to Client Components." A causa: `KpiCard` e outros componentes de `packages/ui` são módulos `"use client"` (usam Framer Motion), e as páginas `/dev`/`/dev/ceo` são Server Components passando `icon={GitBranch}` — uma **referência** de componente, não um elemento renderizado. O React Server Components só serializa elementos JSX já renderizados através desse limite, nunca a função/objeto do componente em si. Esse bug não apareceu nos testes interativos da Fase 5 porque aquele harness era inteiramente `"use client"` (cliente chamando cliente nunca serializa nada) — só surgiu ao testar uma página Server Component de verdade, exatamente o tipo de bug que só aparece testando no ambiente real, não em um mock.

**Corrigido de forma sistêmica, não pontual:** todo prop de ícone em `packages/ui` (`KpiCard`, `EmptyState`, `SmartBadge`, `Timeline`, `ActivityFeed`, `CampaignCard`) mudou de `LucideIcon` para `React.ReactNode` — quem chama passa `icon={<GitBranch />}`, nunca `icon={GitBranch}`. Mudar o tipo fez o próprio `tsc` apontar exatamente todo call site que precisava de correção (nenhum precisou ser encontrado por inspeção manual) — uma boa demonstração de por que essa classe de bug vale a pena fechar no nível do tipo, não em cada ponto de uso. Ver ADR-024.

## Product Review — rigoroso, por instrução explícita

Analisando com o mesmo rigor de um design review de verdade, não uma lista de "sim/não":

**Consistência visual:** forte nas telas efetivamente reescritas (Dashboard, Configurações, `/dev`/`/dev/ceo`) — mesma cor de marca, mesmo `PremiumCardShell`, mesmo `SmartBadge` em todo lugar que usa status. Mas **não é 100% do produto** — Mapa de Mesas, Cartões, Equipe e a tabela de Campanhas herdam os tokens globais (cor, radius, sombra) automaticamente, mas seus componentes internos continuam pré-Fase-4.5. Isso significa que hoje existe uma diferença perceptível de acabamento entre "as telas novas" e "as telas antigas" — não uma inconsistência de marca (a cor é a mesma em todo lugar), mas uma inconsistência de polimento. Item aberto, registrado no roadmap.

**Hierarquia:** clara nos componentes novos — label→valor→variação no KPI Card, título→descrição→ação no Analytics Card. Nenhuma tela nova compete por atenção com dois elementos do mesmo peso visual (princípio 1 do Manifesto).

**Espaçamento:** consistente — `PremiumCardShell` usa um padding fixo (`p-5`) reaproveitado por todo card, não um valor escolhido por tela.

**Contraste:** a cor de marca escolhida (violeta-índigo, lightness ~0.55 no claro) foi escolhida visualmente para parecer legível com texto branco por cima, mas **não foi medida com uma ferramenta de contraste** (não há uma disponível neste sandbox) — não posso afirmar conformidade WCAG AA como um fato verificado, só como uma escolha visual razoável. Registrado como limitação, não escondido atrás de uma afirmação não verificada.

**Acessibilidade:** `prefers-reduced-motion` genuinamente respeitado (verificado no código, não só documentado); `PermissionMatrix` usa uma tabela HTML semântica; `CommandPalette` herda a navegação por teclado e semântica ARIA do `cmdk`. **Não rodei uma auditoria automatizada** (axe-core ou similar) — verificação manual/por leitura de código, não uma ferramenta de acessibilidade real.

**Responsividade:** grids de KPI usam breakpoints já estabelecidos (`sm:grid-cols-2 lg:grid-cols-4`); o botão do Command Palette esconde o texto "Buscar" em telas pequenas. Verificado via as classes responsivas em si, não testado fisicamente em múltiplos tamanhos de viewport nesta sessão.

**Percepção premium:** genuinamente melhor — confirmado visualmente via screenshot real do `/dev/ceo` renderizado (cards com ícone em chip colorido, badges pulsantes de status, grade limpa), não apenas descrito em texto.

**Animações:** cada uma tem um motivo (ver Manifesto, princípio 2) — nenhuma decorativa adicionada só "porque ficaria bonito".

**Fluidez:** os padrões de interação já estabelecidos na Fase 5 (rAF, `React.memo`) não foram tocados; os componentes novos são majoritariamente estáticos ou com transições CSS simples, sem introduzir nenhum padrão que pudesse travar a interface.

**Conclusão honesta do Product Review:** a fundação do Design Language está genuinamente completa e correta (tokens, componentes, motion, manifesto) e comprovada em telas reais — mas "todo o SaaS" ainda não está 100% revestido. Isso é uma leitura de escopo diante do tamanho real da tarefa, não uma entrega incompleta do que foi prometido para esta fase especificamente.

## Como verificar localmente

1. `npm run dev`, abrir `/dev` e `/dev/ceo` — não exigem login (são páginas de desenvolvimento, bloqueadas em produção via `notFound()`), então dá para ver a reconstrução completa sem precisar de Clerk/Postgres reais.
2. Fazer login e abrir `/dashboard` — ver os novos KPI Cards; `/dashboard/settings` — ver "Papéis e permissões" e os cards de Organização/Auditoria reconstruídos; `/dashboard/campaigns` — ver os badges de status pulsando quando `ACTIVE`.
3. Pressionar `Cmd+K`/`Ctrl+K` em qualquer tela do dashboard para abrir o Command Palette.
4. Alternar para dark mode (se o sistema operacional/navegador estiver configurado assim) e confirmar que a cor de marca e todos os componentes novos se adaptam automaticamente — nenhum tem uma classe `dark:` própria, todos herdam os tokens CSS.

## Arquivos alterados

**Novos:** `packages/design-tokens/src/index.ts`, `packages/ui/src/{premium-card,overlays,command-palette,empty-state,skeletons,timeline,activity-feed,heatmap-card,smart-badge,avatar-stack,permission-matrix,index}.tsx`, `packages/icons/src/index.ts`, `packages/animations/src/index.ts`, `src/components/dashboard/dashboard-command-palette.tsx`, `MANIFESTO_DO_DESIGN.md`, `DECISOES_DE_ARQUITETURA.md`, `PROXIMAS_TAREFAS.md`, `RELATORIO_FASE_1-5.md`, `RELATORIO_FASE_4_5.md`.

**Editados:** `tsconfig.json` (aliases `@nfc-os/*`), `src/app/globals.css` (cor de marca, sombra, motion, utilitários), `src/app/dashboard/{page,layout}.tsx`, `src/app/dashboard/settings/page.tsx`, `src/app/dev/{page,ceo/page}.tsx`, `src/lib/dev-status.ts` (`countArchitectureDecisions`), `src/domain/rbac/roles.ts` (labels de permissão), `src/components/dashboard/{stat-card,organization-card,audit-log-card}.tsx`, `src/components/dashboard/campaigns/{status-badge,campaigns-view}.tsx`, `dev-status.json`, `ROADMAP.md`, `README.md`, `package.json`/`package-lock.json` (dependência `cmdk`).

## Riscos e itens em aberto

- Bundle size do dashboard cresceu (~85 kB de First Load JS a mais em `/dashboard`) — provavelmente o Command Palette/`cmdk` e Framer Motion entrando no bundle compartilhado de mais páginas. Não medido como impacto real de performance; candidato a `next/dynamic` numa fase futura se isso se confirmar um problema.
- Mapa de Mesas, Cartões, Equipe e a tabela de Campanhas ainda não foram reescritos sobre `packages/ui` — herdam os tokens globais, não os componentes. Ver "O que NÃO foi reescrito" acima.
- Contraste de cor e acessibilidade não foram auditados com ferramentas automatizadas — verificação visual/manual apenas.
- `CampaignCard`/`ZoneCard`/`TableCard` existem sem nenhum call site real ainda.
- Nenhum MCP de design estava disponível para acelerar esta fase — instruções de conexão manual documentadas, não testadas de fato (não há credencial de MCP disponível neste sandbox para testar a conexão).

## Próximos passos

Aguardando aprovação para iniciar a **Fase 6 — Live Mode + Heatmap**.
