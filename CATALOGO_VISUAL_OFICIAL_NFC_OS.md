# Catálogo Visual Oficial — NFC OS

> Fonte única de verdade para "qual é o componente X do produto". Um vencedor por categoria — sem debate futuro. Construído explorando `@shadcn` e `@magicui` (ambos configurados em `components.json`) via shadcn MCP. Nenhuma página foi tocada para produzir este documento; a instalação abaixo só coloca os componentes no projeto (`src/components/ui/`), pronta para uso na Fase E.

## Como ler este documento

- **Oficial** = o único componente que qualquer tela nova deve usar para aquele trabalho. Já instalado em `src/components/ui/`.
- **Disponível, não selecionado** = existe no registry, foi avaliado, não tem hoje um caso de uso real no NFC OS — não instalado. Revisitar só quando uma tela concreta precisar, nunca instalar "porque existe".
- **Rejeitado** = avaliado e descartado, com o motivo. Normalmente porque duplica algo que o produto já tem e que é melhor (mais integrado à marca, já adotado, etc.).
- **Sem vencedor (compor)** = não existe um componente pronto para isso em nenhum registry conectado; a resposta certa é compor com peças que já existem, não instalar nada.

---

## 1. Layout

| Categoria | Componente Oficial | Origem | Motivo |
|---|---|---|---|
| Bento Grid | `BentoGrid` / `BentoCard` | `@magicui/bento-grid` | Único candidato real da categoria; já compõe o `Button` do shadcn internamente (não reinventa botão) |
| Feature Cards | *(mesmo BentoGrid acima)* | `@magicui/bento-grid` | `BentoCard` já cobre o caso de uso — não há necessidade de um segundo componente só para "feature card" |
| Sidebars | `Sidebar` (existente) | `@shadcn/sidebar` | Já instalado e em uso real (`AppSidebar`) — nada a trocar |
| Command Palette | `CommandPalette` (existente) | `packages/ui/command-palette.tsx` | Já construído sobre `cmdk` diretamente, já adotado (Manifesto Princípio 6) — instalar `@shadcn/command` criaria uma segunda implementação da mesma coisa |
| Hero Sections | *(sem vencedor — compor)* | — | Nenhum registry conectado tem um bloco de "Hero" pronto. Um hero premium nasce da composição de peças já oficiais: tipografia existente + `DiaTextReveal`/`TextReveal` (headline) + um Background oficial (§6) + `Button` (shadcn) — nunca um componente monolítico importado |
| Pricing | `pricing.tsx` (existente) | `src/components/marketing/pricing.tsx` | Nenhum componente de pricing existe em nenhum registry conectado — mantém o customizado, já construído sobre primitivas do Design Language |
| Dashboards | `KpiCard`/`AnalyticsCard` (existentes) | `packages/ui/premium-card.tsx` | Composição de página, não um componente único — já resolvido desde a Fase 4.5 |

## 2. Motion

| Categoria | Componente Oficial | Origem | Motivo |
|---|---|---|---|
| Text Reveal (headline/momento de destaque) | `DiaTextReveal` | `@magicui/dia-text-reveal` | Faixa de cor varrendo o texto com brilho — o efeito de abertura visto nas referências (Stripe/Linear-style headline); comunica "isto é o título", nunca decoração genérica |
| Text Reveal (parágrafo, ao rolar) | `TextReveal` | `@magicui/text-reveal` | Job diferente do acima (revelar corpo de texto conforme o scroll, não uma abertura de headline) — os dois coexistem porque resolvem problemas diferentes, não o mesmo |
| Number Ticker | `NumberTicker` | `@magicui/number-ticker` | Único candidato; encaixe direto com `KpiCard`/Analytics — números que sobem comunicam "isto acabou de mudar" |
| Blur In | `BlurFade` | `@magicui/blur-fade` | Único candidato para entrada de conteúdo com blur |
| Shimmer (texto/badge) | `AnimatedShinyText` | `@magicui/animated-shiny-text` | Para destacar um rótulo/texto pontual (ex. "Novo") — não confundir com o shimmer de loading abaixo |
| Shimmer (loading) | `.skeleton-shimmer` (existente) | `globals.css` + `packages/ui/skeletons.tsx` | Já construído na Fase 4.5, já correto — job diferente (skeleton de carregamento, não destaque de texto) |
| Spotlight | `MagicCard` | `@magicui/magic-card` | Spotlight que segue o cursor e realça a borda no hover — efeito exato pedido, único candidato |
| Border Beam (estado ativo/ao vivo) | `BorderBeam` | `@magicui/border-beam` | Reservado para elementos que estão genuinamente ativos/processando agora (ex. um playbook em execução, uma campanha ao vivo) — nunca decorativo, por exigência do Princípio 2 do Manifesto |
| Meteors | `Meteors` | `@magicui/meteors` | Efeito de fundo decorativo para hero/seções vazias — uso deliberadamente raro |
| Animated Beam | `AnimatedBeam` | `@magicui/animated-beam` | Para visualizar fluxo entre pontos (ex. integrações na Landing). **Não usar no Visual Event Flow do Dev Command Center** — aquela tela já tem sua própria implementação (`src/components/dev/visual-event-flow.tsx`, Fase 12) desenhada para partículas nascidas de `EventLog` real; `AnimatedBeam` resolveria um problema genérico que aquela tela já resolve de um jeito mais específico |
| Marquee | `Marquee` | `@magicui/marquee` | Único candidato para scroll infinito (logos de clientes, depoimentos) |
| Typing (Demo OS apenas) | `TypingAnimation` | `@magicui/typing-animation` | Só para os momentos narrativos do Demo OS (Fase 12) — nunca em UI de produto real, onde digitação simulada atrasaria a leitura sem comunicar estado |
| Dock | *(disponível, não selecionado)* | `@magicui/dock` | Sem tela hoje que peça uma navegação estilo dock |
| Morphing Text | *(disponível, não selecionado)* | `@magicui/morphing-text` | Sem job real hoje; risco de parecer gimmick, não "empresa bilionária" |
| Ripple (clique/confirmação) | `.brand-ripple` (existente) | `globals.css` + `components/white-label/brand-ripple.tsx` | **Rejeitado** `@magicui/ripple`/`ripple-button` — o produto já tem um ripple próprio da Fase 10 que reage à cor de marca (`--brand-primary`), superior a um ripple genérico. Instalar o do Magic UI duplicaria e provavelmente divergiria da cor de marca |
| Shiny Button | *(rejeitado)* | `@magicui/shimmer-button`, `rainbow-button`, `shiny-button` | O produto já tem UM `Button` canônico (shadcn) — a própria auditoria da Fase A encontrou o `RecommendationCard` quebrando essa regra com botões feitos à mão; adicionar uma terceira variante de botão brilhante repetiria o mesmo erro, não o corrigiria |
| Confetti, Cool Mode, Pulsating Button, Hyper Text, Comic Text, Spinning Text, Video Text, Text 3D Flip, Kinetic Text, Icon Cloud, Globe | *(disponíveis, não selecionados)* | `@magicui/*` | Avaliados, sem caso de uso real hoje. `globe` traz `cobe` (WebGL) como dependência nova — só se justifica se um dia existir uma visão geográfica real (ex. mapa de franquias); `icon-cloud` só se justifica com uma vitrine real de integrações/logos |

## 3. Inputs

| Categoria | Componente Oficial | Origem | Motivo |
|---|---|---|---|
| Search / Command | `CommandPalette` (existente) | `packages/ui/command-palette.tsx` | Já cobre isso — ver §1 |
| Select | `Select` (existente) | `@shadcn/select`, já instalado | Sem mudança |
| Date Picker | *(sem vencedor — compor)* | `@shadcn/calendar` + `@shadcn/popover` (já instalados) | Nenhum registry tem um "Date Picker" pronto — o padrão oficial do próprio shadcn é compor Calendar+Popover. Vira um novo componente `DatePicker` em `packages/ui` na Fase D, não uma instalação |
| Multi Select | *(sem vencedor — compor)* | `@shadcn/combobox` (padrão, não um componente isolado) | Mesmo caso: nenhum registry tem "multi-select" pronto. Padrão oficial do shadcn é compor Command+Popover+Badge — vira componente `MultiSelect` em `packages/ui` na Fase D |

## 4. Feedback

| Categoria | Componente Oficial | Origem | Motivo |
|---|---|---|---|
| Toasts | `Sonner` (existente) | `@shadcn/sonner`, já instalado | Sem mudança |
| Empty States | `EmptyState` (existente) | `packages/ui/empty-state.tsx` | **Rejeitado** `@shadcn/empty` (existe no registry, foi avaliado) — instalá-lo criaria um segundo "Empty State" competindo com o que o produto já tem e já usa em 6 telas, violação direta do Princípio 6 do Manifesto |
| Skeletons | `SkeletonText/Avatar/Card/Row/Grid` (existentes) | `packages/ui/skeletons.tsx` | Já construído na Fase 4.5. A Fase A encontrou zero uso em produto — o problema é adoção, não ausência; resolvido na execução da Fase E, não aqui |
| Loading (spinner) | `Spinner` | `@shadcn/spinner` | **Buraco real confirmado na Fase A** (nenhum spinner compartilhado existia) — resolvido com zero dependência nova (usa só `cn`+`class-variance-authority`, já instalados). Substitui todo uso solto de `Loader2`/`animate-spin` |
| Success/Error States | *(sem vencedor — compor)* | `@shadcn/alert` (já instalado) + `SmartBadge` (existente) | Nenhum componente pronto para isso em nenhum registry — vira composição na Fase D |

## 5. Data

| Categoria | Componente Oficial | Origem | Motivo |
|---|---|---|---|
| Tables premium | *(sem vencedor — compor)* | `@shadcn/table` (já instalado) | Nenhuma "tabela premium" pronta em nenhum registry — um `PremiumTable` (sort/filter sobre `@shadcn/table`) é trabalho de composição da Fase D |
| Charts | `chart.tsx` (existente) | `@shadcn/chart`, já instalado | Já resolvido — já usado em `visits-chart.tsx`/`hourly-chart.tsx` |
| Activity Feed, Timeline, Ranking, Heatmap | *(existentes)* | `packages/ui/{activity-feed,timeline,ranking-list,heatmap-card}.tsx` | Já construídos na Fase 4.5/11, sem equivalente melhor em nenhum registry |
| Metrics | `KpiCard` + `NumberTicker` | `packages/ui/premium-card.tsx` + `@magicui/number-ticker` | Combinação, não substituição — o número anima dentro do card que já existe |

## 6. Overlays

| Categoria | Componente Oficial | Origem | Motivo |
|---|---|---|---|
| Dialog / Drawer / Popover | `PremiumModal`/`PremiumDrawer`/`PremiumPopover` (existentes) | `packages/ui/overlays.tsx` | Já corretos — o problema é adoção (25+ arquivos usando a versão raw por baixo), resolvido na execução da Fase E, não aqui |
| Tooltip | `Tooltip` (existente) | `@shadcn/tooltip`, já instalado | Sem mudança |
| Hover Card | `HoverCard` | `@shadcn/hover-card` | **Buraco real, agora fechado** — em uso em `/dashboard/team` (avatar do membro → cargo + data de entrada), verificado ao vivo. Zero dependência nova |

## 7. Backgrounds

| Categoria | Componente Oficial | Origem | Motivo |
|---|---|---|---|
| Grid (estático) | `GridPattern` | `@magicui/grid-pattern` | Único candidato para grid estático de fundo |
| Dot | `DotPattern` | `@magicui/dot-pattern` | Único candidato |
| Interactive Background | `InteractiveGridPattern` | `@magicui/interactive-grid-pattern` | Job diferente do grid estático (reage ao mouse) — justifica um segundo oficial na família "grid" |
| Noise | `NoiseTexture` | `@magicui/noise-texture` | Combina diretamente com a filosofia já documentada de "glassmorphism com moderação" em `globals.css` — textura sutil, nunca decoração pesada |
| Particles | `Particles` | `@magicui/particles` | Único candidato; zero dependência extra (canvas puro) |
| Gradient | *(sem vencedor — já existe)* | `globals.css` (`--shadow-glow`, `color-mix` sobre `--brand`) | Gradiente não é um componente, é token — já existe e já é ciente de marca; instalar um "gradiente" separado seria pior (não reagiria ao White Label) |
| Aurora Background | *(sem vencedor — construir)* | — | **Gap real, honestamente registrado**: nenhum registry conectado (`@shadcn`, `@magicui`) tem um Aurora Background de página inteira — só `aurora-text` (efeito de texto, não de fundo) existe no Magic UI. O visual "Aurora" das referências enviadas é de outra fonte (Aceternity UI), que não é um registry compatível com shadcn CLI de forma verificável — não adicionamos uma URL de registry não verificada. Decisão: construir um `AuroraBackground` próprio em `packages/ui` (blobs de gradiente radial animados, CSS puro) usando os tokens de marca já existentes (`--brand`, `--chart-*`) — mais correto para o produto que importar uma versão genérica roxa fixa, e sem dependência nova. Trabalho de composição da Fase D, não instalação |
| Retro Grid, Flickering Grid, Animated Grid Pattern, Hexagon Pattern, Striped Pattern, Warp Background, Light Rays, Dotted Map | *(disponíveis, não selecionados)* | `@magicui/*` | Variações da mesma família de fundo — escolher mais de uma "família de grid oficial" violaria a regra de um vencedor por categoria; revisitar só se uma tela pedir uma textura claramente diferente das já escolhidas |

---

## Componentes efetivamente instalados nesta fase (via MCP)

Todos em `src/components/ui/`, zero dependência nova no `package.json` (ver ADR-059 para a correção de `motion`/`@radix-ui/react-icons`):

`bento-grid` · `dia-text-reveal` · `text-reveal` · `number-ticker` · `blur-fade` · `magic-card` · `border-beam` · `meteors` · `animated-beam` · `marquee` · `typing-animation` · `animated-shiny-text` · `grid-pattern` · `dot-pattern` · `interactive-grid-pattern` · `noise-texture` · `particles` · `spinner` · `hover-card`

## Quality Gate desta etapa

- **Next.js/SSR:** todos os componentes instalados são `"use client"` quando usam `framer-motion`/estado — nenhum quebra Server Components por padrão de importação.
- **Framer Motion:** corrigido — ver ADR-059. Todo import `motion/react` reescrito para `framer-motion` (já instalado, `^13.2.0`), pacote `motion` removido. Um único motion system no bundle.
- **Bundle:** zero dependências novas após a correção (`motion` e `@radix-ui/react-icons` removidos; `particles`/`dot-pattern`/`grid-pattern`/`marquee`/`meteors`/`noise-texture` não têm dependência externa nenhuma).
- **Acessibilidade:** `HoverCard`/`Spinner` herdam Radix (já auditado no resto do produto); efeitos puramente decorativos (`Particles`, `Meteors`, `GridPattern`, `NoiseTexture`) não carregam texto/foco, não têm impacto de acessibilidade próprio — mas devem sempre respeitar `prefers-reduced-motion` quando aplicados (checagem por tela, na Fase E, via Luxury Motion Review).
- **Dark mode / White Label:** nenhum destes componentes tem cor hardcoded fora de props — todos aceitam `className`/props de cor, compatíveis com os tokens de marca quando aplicados corretamente (checagem por tela, na Fase E).
- **`tsc --noEmit` e `eslint`:** limpos (2 warnings pré-existentes do código vendorizado do Magic UI em `dia-text-reveal.tsx`, não escritos por nós, não bloqueantes).
