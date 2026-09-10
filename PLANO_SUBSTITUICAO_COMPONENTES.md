# Plano de Substituição de Componentes — Fase E (rollout página por página)

> Cruza os achados da Fase A (`RELATORIO_AUDITORIA_FRONTEND_FASE_A.md`) com o `CATALOGO_VISUAL_OFICIAL_NFC_OS.md`. Nada neste documento foi executado ainda — é o mapa que a Fase E segue, na ordem já confirmada: Landing → Login → Dashboard → Command Center → Playbooks → Analytics → Table Map → White Label → Developer Center → Demo OS → resto. Cada linha vira uma mudança real só quando a página correspondente for aberta na Fase E, e só depois de passar pelos três novos reviews (Visual Consistency, Luxury Motion, Pixel Polish).

## 1. Landing (`/`, `src/components/marketing/*`) — 0% de adoção do Design Language hoje

| Trecho atual | Novo Oficial | Motivo |
|---|---|---|
| `hero.tsx` — fundo estático | `GridPattern`/`DotPattern` ou `AuroraBackground` (a construir, ver catálogo §7) | Um fundo sutil de marca em vez de vazio — decisão final entre os dois na execução, olhando o layout real |
| `hero.tsx` — título estático | `DiaTextReveal` | Abertura de headline, o mesmo tratamento visto nas referências Stripe/Linear |
| `hero.tsx` — números/estatísticas (se existirem) | `NumberTicker` | Números que comunicam crescimento devem animar, não aparecer estáticos |
| `benefits.tsx` / `how-it-works.tsx` — grid de features | `BentoGrid`/`BentoCard` | Substitui grid genérico por um layout com hierarquia visual real (um item grande + itens menores) |
| `testimonials.tsx` | `Marquee` (opcional, se a lista crescer) + `MagicCard` no card individual | Marquee só se houver volume suficiente para scroll infinito fazer sentido; `MagicCard` dá o spotlight sutil em cada depoimento |
| `cta.tsx` — botão principal | `Button` (shadcn, já oficial) | **Sem troca** — nunca `shimmer-button`/`rainbow-button` (rejeitados no catálogo, duplicariam o Button) |
| `site-header.tsx`/`site-footer.tsx` | sem troca | Navegação/rodapé não precisam de efeito — clareza > espetáculo aqui |

## 2. Login (`/sign-in`, `/sign-up`) — fora do sistema por decisão (ADR-041)

| Trecho atual | Novo Oficial | Motivo |
|---|---|---|
| Moldura ao redor do widget Clerk | `NoiseTexture` sutil no fundo (opcional) | Único ajuste cabível sem violar ADR-041 (nunca duplicar a autenticação em si) — textura, não componente funcional |

## 3. Dashboard (`/dashboard`) — adoção parcial, dois sistemas no mesmo arquivo

| Trecho atual (achado Fase A) | Novo Oficial | Motivo |
|---|---|---|
| `organization-card.tsx:54,88` — `Card` raw ao lado de `OrganizationBrandCard` premium no mesmo arquivo | `PremiumCardShell`/`KpiCard` (já existentes) | Fecha a inconsistência mais visível encontrada na auditoria — não é instalação nova, é migração |
| `stat-card.tsx` — números estáticos | `NumberTicker` dentro do card existente | Combinação, não substituição (ver catálogo §5) |
| Qualquer `Loader2`/`animate-spin` solto | `Spinner` (`@shadcn/spinner`, já instalado) | Fecha o "buraco real" da Fase A |

## 4. Command Center (`/dev/ceo/command-center`, `/dashboard` ações rápidas)

| Trecho atual | Novo Oficial | Motivo |
|---|---|---|
| `next-best-actions-card.tsx` — recomendação em execução | `BorderBeam` no card durante a execução (`PlaybookExecutado` em andamento) | Comunica estado real ("isto está rodando agora"), nunca decorativo — regra do Princípio 2 |
| Visual Event Flow (`visual-event-flow.tsx`) | **sem troca** — `AnimatedBeam` explicitamente não entra aqui | Já resolvido de forma mais específica desde a Fase 12 (ver catálogo §2) |

## 5. Playbooks (`/dashboard/playbooks`) — já ✅ boa adoção

| Trecho atual | Novo Oficial | Motivo |
|---|---|---|
| Cartão de recomendação (`RecommendationCard`) | `MagicCard` como wrapper de spotlight no hover | Reforça o card já premium, sem substituí-lo |
| `RecommendationCard` — botões feitos à mão (`packages/ui/recommendation-card.tsx:79-104`) | `Button` (shadcn) | **Bug fix, não estética** — já registrado na Fase A/ADR-058: a própria camada premium quebra a regra de "um só Button" |
| Confiança/impacto estimado (%) | `NumberTicker` | Mesma lógica do Dashboard |
| AutoPilot executando | `BorderBeam` | Mesmo critério do Command Center — só durante execução real |

## 6. Analytics (`/dashboard/analytics`)

| Trecho atual (achado Fase A) | Novo Oficial | Motivo |
|---|---|---|
| `page.tsx:66` — `Card` raw | `AnalyticsCard` (existente) | Migração de adoção, não instalação nova |
| KPIs (`analytics-enterprise-view.tsx`) | `NumberTicker` | Mesma lógica do Dashboard |

## 7. Table Map (`/dashboard/table-map`) — já ✅ boa adoção

| Trecho atual (achado Fase A) | Novo Oficial | Motivo |
|---|---|---|
| `time-machine-panel.tsx` — `Popover` raw | `PremiumPopover` (existente, hoje com **zero uso** em produto) | Fecha o código morto encontrado na Fase A — primeiro uso real do componente |
| `ghost-mode-preview-dialog.tsx:100,125`, `time-machine-panel.tsx:65` — `Loader2` solto, tamanhos inconsistentes | `Spinner` | Mesmo buraco do Dashboard |

## 8. White Label / Branding (`/dashboard/branding`) — já ✅ boa adoção

| Trecho atual (achado Fase A) | Novo Oficial | Motivo |
|---|---|---|
| `brand-preview-panels.tsx:44,58` — `#E5E7EB` hardcoded | Token (`bg-muted`/`bg-border`) | Correção de bug de design, não estética — já registrado na Fase A |
| Preview de marca (Theme Studio) | `NoiseTexture` sutil nos mockups físicos | Reforça "glass premium com moderação" já documentado em `globals.css` |
| Swatches de cor no preview | `MagicCard` no hover | Spotlight ao passar o mouse sobre cada opção de cor |

## 9. Developer Center (`/dashboard/developers`, `/developers`)

| Trecho atual (achado Fase A) | Novo Oficial | Motivo |
|---|---|---|
| `api-keys-panel.tsx`, `webhooks-panel.tsx`, `logs-panel.tsx` — `Dialog` raw (6 arquivos no total do produto, vários aqui) | `PremiumModal` (existente) | Migração de adoção |
| `api-explorer.tsx:150` — `Loader2` solto | `Spinner` | Mesmo buraco de sempre |
| Chip de escopo/chave de API | `HoverCard` (novo, instalado) | Preview rápido do escopo sem abrir um modal — primeiro uso real do componente |

## 10. Demo OS (`/demo`, `/demo/investor`) — já ✅ boa adoção

| Trecho atual | Novo Oficial | Motivo |
|---|---|---|
| Momentos narrativos guiados | `TypingAnimation` | Reservado exclusivamente para esta tela no catálogo — reforça a natureza de "narrativa", nunca usado em UI de produto real |
| Hero do `/demo` | `Meteors`/`Particles` de fundo, discreto | Único lugar onde um efeito puramente decorativo se justifica sem violar o Princípio 2 (é uma vitrine, não uma ferramenta de trabalho) |

## 11. Demais telas (`/dashboard/cards`, `/dashboard/team`, `/onboarding`, `/feedback`, `/thank-you`, `/dev/ceo/mission-control`)

| Trecho atual (achado Fase A) | Novo Oficial | Motivo |
|---|---|---|
| `cards-view.tsx`, `card-item.tsx`, `card-form-dialog.tsx` — 0% adoção | `PremiumCardShell`, `SmartBadge`, `PremiumModal` | Mesma migração das demais páginas mistas |
| `team-view.tsx:107-117,186` — `Dialog`/`Badge` raw | `PremiumModal`, `SmartBadge` | idem |
| `mission-control-view.tsx` — `bg-[#0B0F17]` × 6 hardcoded | Token de superfície (`bg-background`/novo token dark-surface, decidir junto com dark mode) | Correção de bug de design já registrada na Fase A |
| Estados vazios manuais (`feedback-list.tsx:47`, `campaign-tray.tsx:26`, painéis de developers) | `EmptyState` (existente) | Fecha os 7 arquivos com "Nenhum dado" sem ícone/CTA encontrados na Fase A |

---

## Regra de ouro para a execução (Fase E)

Cada linha acima só vira código depois que a página específica passar pelos três reviews novos (Visual Consistency, Luxury Motion, Pixel Polish) e pelos reviews já existentes que se aplicarem. Nenhuma linha autoriza sozinha uma mudança — este documento é o mapa, não a permissão.
