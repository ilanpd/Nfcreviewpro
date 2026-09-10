# Auditoria Front-End — Fase A (Design System 2.0)

> Escopo: exclusivamente front-end/visual, conforme instrução do chat dedicado. Nenhum arquivo de produto foi alterado nesta fase — só leitura.

## Achado crítico, antes de tudo

Este **não é um projeto greenfield em design**. Já existe um sistema de design real, construído na **Fase 4.5** e estendido na **Fase 10**:

- `MANIFESTO_DO_DESIGN.md` — 8 princípios permanentes (uma ação por tela, animação sempre comunica estado, no máximo 3 níveis de profundidade, `PremiumCardShell` é o único card, etc.).
- `packages/ui/src/` — a camada "NFC OS Design Language": 17 componentes premium (`PremiumCardShell`, `SmartBadge`, `PremiumModal/Drawer/Popover`, `EmptyState`, skeletons com shimmer, `CommandPalette`, `RecommendationCard`, `Timeline`, `FunnelChart`, etc.), importados via alias `@nfc-os/ui`.
- `packages/design-tokens/src/index.ts` — motion system (durations, easings, springs do Framer Motion), z-index scale, breakpoints.
- `src/app/globals.css` — tokens de cor (OKLCH), radius, sombra (`--shadow-subtle/elevated/premium/glow`), glassmorphism (`.glass`), motion CSS (`--ease-*`, `--animate-*`), tudo já com suporte a `.dark` e a `prefers-reduced-motion`.

**Conclusão prática:** a Fase B do brief ("criar o Design System 2.0" do zero — tipografia, cores, radius, sombra, motion) já existe em ~80%. O trabalho real não é criar, é **fechar a lacuna de adoção** entre o que já foi desenhado e as telas que ainda não usam. Tratar isso como greenfield seria jogar fora uma decisão de arquitetura já madura (e brigar com o Manifesto, que exige reaproveitar, nunca recriar). Isso é reportado aqui em vez de simplesmente seguido em silêncio porque contraria a leitura implícita do brief — ver "Pergunta em aberto" no final.

---

## 1. Mapa de páginas (27 rotas)

| Rota | Adoção do Design Language (`@nfc-os/ui`) | Observação |
|---|---|---|
| `/` (landing) | ❌ Nenhuma | `src/components/marketing/*` (hero, pricing, testimonials, cta, faq, site-header/footer) — zero uso da camada premium |
| `/sign-in`, `/sign-up` | N/A (por decisão) | ADR-041: login nunca duplica Clerk, só estiliza a moldura — comportamento esperado, não é dívida |
| `/onboarding` | ❌ Nenhuma | `onboarding-form.tsx` usa `Card` raw |
| `/feedback`, `/thank-you` | ❌ Nenhuma | não auditado componente a componente ainda |
| `/r/[code]` | N/A | rota de redirecionamento, sem UI própria |
| `/developers` (marketing) | ❌ Nenhuma | página pública de devs, distinta do `/dashboard/developers` |
| `/dashboard` | 🟡 Parcial | usa `stat-card`/`organization-card`, mas `organization-card.tsx` mistura `OrganizationBrandCard` (premium) com `Card` raw **no mesmo arquivo** |
| `/dashboard/cards` | ❌ Nenhuma | `cards-view.tsx`, `card-item.tsx`, `card-form-dialog.tsx` — só shadcn raw |
| `/dashboard/campaigns` | 🟡 Parcial | `campaigns-view.tsx` usa Design Language; `campaign-builder-sheet.tsx` usa `Sheet` raw em vez de `PremiumDrawer` |
| `/dashboard/table-map` | ✅ Boa | `table-map-view.tsx` no `@nfc-os/ui`; exceção: `time-machine-panel.tsx` usa `Popover` raw |
| `/dashboard/analytics` | 🟡 Parcial | `analytics-enterprise-view.tsx` adota, mas `page.tsx:66` tem `Card` raw |
| `/dashboard/playbooks` | ✅ Boa | referência do produto — `PremiumModal`, `PremiumDrawer`, `EmptyState` todos em uso |
| `/dashboard/branding` | ✅ Boa | mas `brand-preview-panels.tsx` tem hex hardcoded (`#E5E7EB`) |
| `/dashboard/developers` | ✅ Boa | mas com 4 arquivos usando `Dialog` raw em vez de `PremiumModal` |
| `/dashboard/team` | ❌ Nenhuma | `team-view.tsx` — `Badge`/`Dialog` raw |
| `/dashboard/settings` | 🟡 Parcial | `Card` raw em `settings-form.tsx` e `roi-settings-form.tsx` |
| `/demo`, `/demo/investor` | ✅ Boa | `demo-os-view.tsx` adota bem |
| `/dev/**` (7 rotas internas) | ✅ Boa | mas `mission-control-view.tsx` tem `bg-[#0B0F17]` hardcoded 6× em vez de token de superfície |

**Leitura direta para a ordem de prioridade do brief:** a página #1 da lista do usuário (Landing) é a que está em pior estado de adoção — 0%. Login (#2) é intencionalmente fora do sistema (ADR-041). Dashboard (#3) é a mais "meio-termo" — mistura os dois sistemas no mesmo componente, o pior tipo de inconsistência porque é visível lado a lado.

---

## 2. Duplicação de componentes (achado central)

Existem **dois sistemas de componente coexistindo** sem uma fronteira que impeça o acesso direto ao mais raw:

- `src/components/ui/*` — primitivas shadcn puras (a "matéria-prima").
- `packages/ui/src/*` — a camada premium que deveria ser a única usada por telas de produto.
- `packages/ui` **não tem `package.json`** — é só um alias de path TypeScript, não um workspace real. Nada impede uma tela de importar `@/components/ui/card` em vez de `@nfc-os/ui`, e isso acontece com frequência (ver tabela abaixo).

| Par | Raw usado onde deveria ser premium | Premium (referência correta) |
|---|---|---|
| `Card` vs `PremiumCardShell`/`KpiCard`/`AnalyticsCard` | 7 arquivos (`onboarding-form.tsx:47`, `dashboard/analytics/page.tsx:66`, `dashboard/settings/page.tsx:34`, `card-item.tsx:74`, `organization-card.tsx:54,88`, `settings-form.tsx:44`, `roi-settings-form.tsx:51`) — todos reimplementando a mesma classe `"border-none shadow-sm shadow-black/5"` à mão | 33 usos corretos |
| `Badge` vs `SmartBadge` | 5 arquivos (`team-view.tsx:186`, `card-item.tsx:135-143`, `settings/page.tsx:37`, `dashboard/layout.tsx:27`) | `status-badge.tsx` prova que o padrão certo já existe e é ignorado alhures |
| `Dialog` vs `PremiumModal` | 6 arquivos | só `playbook-apply-dialog.tsx` usa `PremiumModal` |
| `Sheet` vs `PremiumDrawer` | `campaign-builder-sheet.tsx` | `event-explorer-view.tsx`, `explainability-panel.tsx` |
| `Popover` vs `PremiumPopover` | `time-machine-panel.tsx` | **`PremiumPopover` tem 0 usos em todo o `src/`** — código morto |
| `Skeleton` vs `SkeletonText/Card/Row/Avatar/Grid` | infraestrutura interna (sidebar) só | **todo `skeletons.tsx` tem 0 usos** — nenhuma tela do produto tem loading state de lista hoje |
| "Nenhum dado" manual vs `EmptyState` | 7 arquivos com `<p>`/`<div>` sem ícone, sem CTA (viola Princípio 7 do Manifesto) | 6 arquivos usam `EmptyState` corretamente |

**Caso mais revelador:** `src/components/dashboard/organization-card.tsx` usa `OrganizationBrandCard` (premium) na linha 9 e `Card` raw nas linhas 54 e 88 — os dois sistemas convivendo no mesmo arquivo, para o mesmo tipo de elemento visual.

## 3. Outras inconsistências

- **Botão duplicado dentro da própria camada premium**: `packages/ui/src/recommendation-card.tsx:79-104` escreve dois `<button>` HTML crus com estilo próprio, em vez de compor o `Button` do shadcn — a camada que devia impor "um só botão" quebra a própria regra.
- **Hex hardcoded fora de tokens** (2 pontos reais, produto-facing): `brand-preview-panels.tsx:44,58` (`#E5E7EB`) e `mission-control-view.tsx` (`bg-[#0B0F17]` × 6). PDFs (`@react-pdf/renderer`) foram checados e excluídos — hex ali é exigência técnica da lib, não bypass.
- **Spinners ad hoc**: `Loader2`/`animate-spin` usado direto em 4 lugares com tamanhos diferentes (`size-3`, `size-3.5`, `size-4`) — não existe um `Spinner` no Design Language.
- **`bg-brand` vs `bg-primary`**: hoje resolvem para a mesma cor (`--primary: var(--brand)`), mas o código mistura as duas classes para o mesmo conceito — risco latente se os tokens forem desacoplados no futuro.

## 4. Dark mode — decisão pendente, não um bug

`globals.css` tem um bloco `.dark` completo desde a Fase 4.5 (cores, sidebar, chart, tudo). **Nunca foi ativado**: `layout.tsx:54` tem `forcedTheme="light"` e `enableSystem={false}`. Isso já era um item documentado (ADR-047) na Fase 10 como não entregue. Relevante aqui porque boa parte do pedido do brief (glass premium, glow, gradientes escuros ao estilo Linear/Vercel) fica mais forte em dark — vale decidir explicitamente se essa fase liga o dark mode de verdade ou continua adiando.

## 5. Motion — já existe um sistema, não precisa ser inventado

`packages/design-tokens/src/index.ts` já define durations (`instant/fast/base/slow/slower`), easings (`standard/exit/enter/spring`) e springs do Framer Motion (`snappy/gentle`) — exatamente o vocabulário que a Fase C do brief pede para criar. `globals.css` já espelha isso em CSS (`--ease-*`, `--animate-fade-in/scale-in/shimmer`) e já respeita `prefers-reduced-motion` globalmente (`globals.css:286-305`). `framer-motion` já está instalado (`^13.2.0`). Não há necessidade de nova biblioteca de motion.

---

## Resumo executivo

| Métrica | Valor |
|---|---|
| Páginas mapeadas | 27 |
| Páginas com boa adoção do Design Language | 7 |
| Páginas parcialmente adotadas (o pior caso — mistura visível) | 5 |
| Páginas com zero adoção | ~10 |
| Componentes premium existentes (`packages/ui`) | 17 |
| Componentes premium com **zero uso** (código morto) | `PremiumPopover`, `SkeletonText/Avatar/Card/Row/Grid` (5 exports) |
| Pontos de duplicação Card/Badge/Dialog/Drawer/Popover/EmptyState confirmados | 25+ arquivos |
| Hex hardcoded fora de token (produto-facing) | 2 arquivos, 7 ocorrências |
| Dark mode | Tokens prontos, nunca ligado |
| Motion system | Já existe (`packages/design-tokens`), pronto para reuso |

---

## Pergunta em aberto para decisão do usuário

Duas coisas não posso decidir sozinho, porque são de governança/processo, não técnicas:

1. **Numeração e processo**: o projeto principal roda em fases numeradas (1 a 13) com 10 reviews obrigatórias e ADR por decisão estrutural (`ROADMAP.md`, `DECISOES_DE_ARQUITETURA.md`). Este chat foi aberto como uma trilha separada, "esquecendo backend". Esse trabalho deve virar uma fase formal do roadmap principal (ex. "Fase 14 — Design System 2.0", com ADRs e os 10 reviews de sempre), ou é deliberadamente uma trilha mais leve, sem esse overhead, e eu só reporto aqui?
2. **Reformular Fase B do brief**: dado que ~80% do "Design System 2.0" pedido já existe e é bom, proponho que a Fase B vire "fechar a lacuna" (adoção total + matar código morto + resolver os 2 hex hardcoded + decidir dark mode) em vez de desenhar tokens do zero — e só criar componente novo onde há buraco real (ex. `Spinner` compartilhado, `Button` reaproveitado dentro do `RecommendationCard`). Confirma essa leitura, ou prefere mesmo uma repaginação visual mais radical (nova paleta, nova tipografia) por cima do que já existe?

Nenhuma mudança de código foi feita — aguardando essas duas respostas antes de entrar na Fase B.
