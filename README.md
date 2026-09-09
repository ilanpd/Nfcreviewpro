# NFC Review Pro

SaaS multi-tenant para transformar cartões NFC em uma ferramenta de captação de avaliações, atendimento e reputação. Cada empresa cadastrada tem sua própria conta, funcionários, cartões NFC, avaliações e configurações — totalmente isolados entre si.

O projeto está evoluindo de "ferramenta de Google Reviews" para uma **Physical Marketing Operating System**, em que cada NFC é um identificador permanente cujo destino é decidido dinamicamente por um **Campaign Resolution Engine** (`src/lib/resolution-engine/`), gerenciado por um **Campaign Manager** completo (dashboard de campanhas, atribuições por empresa/unidade/zona/cartão) e refinado por um **Motor de Regras** em tempo real (horário/dia/data/dispositivo, com fuso horário próprio por empresa, e testes A/B com distribuição configurável). Esse trabalho segue em fases, com aprovação entre elas — veja [`ROADMAP.md`](ROADMAP.md) para a visão completa, [`PROXIMAS_TAREFAS.md`](PROXIMAS_TAREFAS.md) para o checklist da fase atual, [`DECISOES_DE_ARQUITETURA.md`](DECISOES_DE_ARQUITETURA.md) para o porquê de cada decisão estrutural, os relatórios `RELATORIO_FASE_N.md` (1 a 5) para o que foi feito em cada fase (como testar, riscos), e `/dev`/`/dev/ceo` (fora de produção) para o mesmo status como painel.

## Stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Framer Motion
- **Backend:** Next.js Route Handlers, Prisma ORM 7 (driver adapters, sem engine Rust), PostgreSQL (Supabase)
- **Cache / rate limit:** Upstash Redis
- **Autenticação:** Clerk
- **Hospedagem:** Vercel + Supabase

## Arquitetura multi-tenant

Toda tabela relevante carrega um `companyId` — inclusive `Visit`, `RatingEvent` e `PrivateFeedback`, que são "netos" de `Company` — para que qualquer query de analytics ou listagem filtre diretamente por empresa, sem depender de joins aninhados para isolar dados entre tenants. Toda rota autenticada resolve o usuário Clerk para seu `companyId` através de [`lib/auth.ts`](src/lib/auth.ts) antes de tocar o banco.

## Setup

### 1. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
cp .env.example .env.local
```

| Variável | Onde conseguir |
| --- | --- |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string (modo **Transaction**, porta 6543, com `pgbouncer=true`) |
| `DIRECT_URL` | Mesma tela, connection string **direta** (porta 5432) — usada só para migrations |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk → API Keys |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash → Redis Database → REST API |
| `IP_HASH_SALT` | Qualquer string longa e aleatória (usada para hashear IPs, nunca armazenamos IP em texto puro) |

### 2. Instalar dependências e gerar o client do Prisma

```bash
npm install
```

O `postinstall` já roda `prisma generate` automaticamente.

### 3. Criar as tabelas no banco

```bash
npm run db:push     # prototipagem rápida, sem histórico de migrations
# ou
npm run db:migrate  # cria uma migration versionada (recomendado a partir da 1ª feature)
```

### 4. Popular dados de exemplo (opcional)

```bash
npm run db:seed
```

Cria a empresa demo **Bella Vista**: 3 zonas (VIP, Varanda, Interno), 5 cartões (alguns já atribuídos a uma zona) e 4 campanhas de exemplo (Black Friday agendada, Happy Hour semanal na zona VIP, Google Reviews só na Mesa VIP 1, Instagram ainda em rascunho) — dá pra ver os 4 níveis de atribuição (empresa/unidade/zona/cartão) e a resolução por especificidade funcionando de verdade. `owner@demo.com` é criado como membro pendente e vira `ACTIVE` automaticamente no primeiro login com esse e-mail no Clerk.

### 5. Rodar em desenvolvimento

```bash
npm run dev
```

- Landing page: `http://localhost:3000`
- Cadastro/login: `/sign-up`, `/sign-in` — o primeiro acesso de cada empresa cai em `/onboarding`
- Painel: `/dashboard`
- Página pública de um cartão: `/r/[uniqueCode]`

## Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | `prisma generate` + build de produção |
| `npm run lint` | ESLint |
| `npm run db:push` | Sincroniza o schema com o banco sem migration |
| `npm run db:migrate` | Cria/aplica migrations |
| `npm run db:seed` | Popular dados de exemplo |
| `npm run db:studio` | Abre o Prisma Studio |

## Fluxo público (o coração do produto)

1. Cliente aproxima o celular do cartão NFC (ou lê o QR Code) → abre `/r/[code]`.
2. A visita é registrada (`Visit`) com device/browser/OS, hash do IP e localização aproximada (via headers de geolocalização da Vercel).
3. Cliente avalia com estrelas → `POST /api/ratings` cria um `RatingEvent`.
   - **4-5 estrelas:** tela de agradecimento com botão para o Google Reviews (link oficial da empresa).
   - **1-3 estrelas:** redireciona para `/feedback`, um formulário privado (nome/telefone opcionais, comentário obrigatório) que salva no banco e monta um link `wa.me` pré-preenchido para o WhatsApp do responsável.
4. `/thank-you` fecha o ciclo com a mensagem final.

## Estrutura de pastas

```
prisma/                 schema.prisma, seed.ts
prisma7.config.ts       config do Prisma CLI (migrations usam DIRECT_URL)
src/
  app/                  rotas (App Router) — públicas, dashboard e API
  components/
    ui/                 shadcn/ui
    marketing/           landing page
    public/             fluxo público de avaliação (/r/[code], /feedback)
    dashboard/           painel da empresa
  domain/campaign/       regras puras (status, escopo de atribuição, tipos de destino) — sem I/O
  domain/rules/          motor de regras puro (fuso horário via Intl, avaliação por tipo, recorrência, seleção de variante A/B) — sem I/O
  repositories/          acesso a dados do módulo de campanhas (Prisma cru, sem regra de negócio)
  services/             regras de negócio, sempre escopadas por companyId
  lib/                  prisma, redis, rate-limit, auth, validações zod, utils, resolution-engine
  types/                tipos compartilhados
  generated/prisma/     client do Prisma gerado (não versionado)
```

## Segurança

- Rate limiting (Upstash) em todas as rotas públicas (`/api/visits`, `/api/ratings`, `/api/feedback`)
- IPs nunca são armazenados em texto puro — apenas um hash salgado (`lib/ip.ts`)
- Toda entrada é validada com Zod antes de tocar o banco
- Toda query autenticada é escopada por `companyId` resolvido a partir da sessão Clerk — nunca por um valor recebido do client

## Deploy

1. Suba o repositório no GitHub/GitLab e importe na Vercel.
2. Configure as mesmas variáveis de ambiente de `.env.example` no projeto da Vercel.
3. Rode `npm run db:migrate` (ou `db:push`) contra o banco de produção antes do primeiro deploy.
4. Configure o webhook/URLs de redirecionamento do Clerk para o domínio de produção.

## Roadmap (além do MVP)

Ver [`ROADMAP.md`](ROADMAP.md) para a evolução completa em fases. Ainda não incluído:

- Gravação própria de cartões NFC via app
- WhatsApp Business API (hoje o envio usa `wa.me`, iniciado pelo cliente)
- Domínio personalizado por empresa (white label — Fase 10)
- Integração com Google Business Profile
- Aplicativo mobile
