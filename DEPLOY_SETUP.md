# Guia de Configuração de Infraestrutura — Produção/Demo + Staging

Este documento existe porque, até a Fase 12, o NFC OS nunca teve uma infraestrutura real conectada — todo desenvolvimento e verificação aconteceram num sandbox sem Postgres/Redis/Clerk reais (documentado em todo `RELATORIO_FASE_N.md`). Para o Gate Final de Entrega, precisamos de **dois ambientes estáveis e isolados**: um de Produção/Demonstração e um de Staging/Testes, cada um com seu próprio banco, sua própria instância de autenticação e sua própria URL.

Eu não posso criar essas contas por você — exigem e-mail de verificação, aceite de termos, e passam a ser de sua titularidade. Este guia tem o passo a passo exato; quando terminar cada etapa, me passe o que for pedido e eu assumo a partir daí (configuração, migração, seed, deploy).

**Tudo abaixo tem camada gratuita suficiente para este projeto.**

---

## Status final (executado em 2026-09-09 — os dois ambientes estão no ar)

| Peça | Produção | Staging |
|---|---|---|
| **URL** | https://nfc-os-production.vercel.app | https://nfc-os-staging.vercel.app |
| Banco (Supabase) | Projeto "Nfc Review Pro" (`wrxenecdfiteqkldsovz`, região `sa-east-1`) | Projeto "Nfc Review Pro 2" (`xcrniyhjiscldevjzgpt`, região `sa-east-1`) |
| Conexão | Pooler Supavisor — Transaction (porta 6543) para `DATABASE_URL`, Session (porta 5432) para `DIRECT_URL` | Idêntico, projeto diferente |
| Clerk | Mesma instância de Development para os dois ambientes (única instância criada) | — |
| Redis | Upstash real configurado (única instância do plano free) | **Sem Redis** — decisão deliberada, ver nota abaixo |
| Migrations | `prisma/migrations/20260909170425_init` aplicada via `migrate deploy` | Idêntica |
| Seed | 4 empresas (Bella Vista, Sushi House, Nova Steakhouse + 1) | Idêntico ao rodar o seed |
| Git | Commitado localmente em `main`; **push para o GitHub ainda não fechado** — ver nota abaixo | |

**Por que Staging roda sem Redis:** o único plano gratuito do Upstash permite 1 banco. As flags do Chaos Mode (`src/lib/chaos/flags.ts`) são chaves GLOBAIS no Redis, não isoladas por empresa/ambiente — compartilhar o mesmo Redis entre Produção e Staging deixaria os testes destrutivos do Chaos Mode em Staging (ex.: "Falha de Redis") vazarem para o cache/comportamento real da Produção. Em vez disso, Produção ficou com o único Redis real, e Staging roda inteiramente sobre o fallback gracioso que o produto já tinha antes desta fase (rate-limit em memória, cache caindo direto no Postgres, sem motor de fila BullMQ real). Resolve o Passo 4 abaixo sem simplificar a arquitetura sem consulta.

**Achados reais de infraestrutura durante o primeiro deploy** (não hipóteses — erros de plataforma genuínos, corrigidos):
1. Cron Jobs no plano Hobby da Vercel só rodam 1x/dia — `vercel.json` tinha agendamentos por minuto/15min, rejeitados no deploy. Corrigido para diário; documentado em **ADR-056**.
2. Um projeto Vercel criado via `vercel project add` (CLI puro, sem import de Git) fica com `framework: null` — o build passa, mas TODAS as rotas retornam 404 de plataforma (zero invocações de função). Corrigido via `PATCH /v9/projects/<nome>` da API da Vercel setando `framework: "nextjs"`.
3. 4 bugs reais de produto encontrados durante a auditoria E2E ao vivo (não durante o deploy em si) — ver `RELATORIO_GATE_FINAL.md` e `E2E_FINAL_CHECKLIST.md` (linhas 4.1, 4.2, 10.3).

**Pendência que depende de você:** `git push -u origin main` e `git push -u origin staging` para o repositório `https://github.com/ilanpd/Nfcreviewpro` — o push automático foi bloqueado pelo classificador de permissões do Claude Code neste ambiente (não um problema do repositório). Os commits já existem localmente; rodar os dois comandos acima do seu terminal resolve.

**Recomendação de segurança não-bloqueante:** as senhas do Supabase foram compartilhadas em texto puro nesta conversa — considere trocá-las depois de validar os ambientes.

---

## Visão geral do que vamos montar

| Peça | Produção/Demo | Staging/Testes |
|---|---|---|
| Hospedagem | Projeto Vercel #1 | Projeto Vercel #2 |
| Banco de dados | Projeto Supabase #1 | Projeto Supabase #2 |
| Autenticação | Instância Clerk (Production) | Instância Clerk (Development) |
| Cache/Filas | Banco Upstash Redis #1 | Banco Upstash Redis #2 |
| Repositório | O MESMO repositório GitHub, branches diferentes (`main` → Produção, `staging` → Staging) |

Dois bancos separados = você pode brincar à vontade no Staging (criar empresas, cadastros, campanhas, apagar tudo) sem nunca tocar nos dados que aparecem na Demo/Produção.

---

## Passo 1 — GitHub

1. Acesse [github.com/new](https://github.com/new) (crie uma conta primeiro em [github.com/signup](https://github.com/signup) se ainda não tiver).
2. Nome sugerido: `nfc-review-pro`. Visibilidade: **Private** (recomendado, o código não é open-source).
3. **Não** marque "Add a README" nem "Add .gitignore" — o repositório local já tem ambos.
4. Depois de criar, copie a URL que o GitHub mostrar (algo como `https://github.com/SEU_USUARIO/nfc-review-pro.git`).
5. Me avise com essa URL, ou rode você mesmo:
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/nfc-review-pro.git
   git push -u origin main
   ```
6. Crie a branch de staging a partir da mesma base:
   ```bash
   git checkout -b staging
   git push -u origin staging
   ```

## Passo 2 — Supabase (dois projetos: um por ambiente)

1. Crie uma conta em [supabase.com](https://supabase.com) (login com GitHub é o mais rápido).
2. Clique **New Project** duas vezes, uma para cada ambiente:
   - `nfc-os-production`
   - `nfc-os-staging`
3. Para cada projeto, escolha uma senha de banco forte (o Supabase gera uma automaticamente se preferir) e a região mais próxima de você.
4. Depois que cada projeto terminar de provisionar (leva ~2 minutos), vá em **Project Settings → Database → Connection string**:
   - Copie a **Connection pooling** string (modo "Transaction") → isso vira `DATABASE_URL`.
   - Copie a **Direct connection** string → isso vira `DIRECT_URL`.
5. Me envie as 4 strings (2 de produção + 2 de staging), ou guarde para colar direto nas variáveis de ambiente da Vercel no Passo 5.

## Passo 3 — Clerk (autenticação)

1. Crie uma conta em [clerk.com](https://clerk.com).
2. Crie uma Application chamada `NFC OS`.
3. Nas configurações da Application, você terá acesso a chaves de **Development** (funcionam imediatamente, sem domínio próprio, ótimas para o Staging) e pode promover para **Production** depois de apontar um domínio (necessário para a Demo/Produção parecer real, sem o aviso "modo de desenvolvimento" do Clerk).
4. Para começar rápido, use as chaves de **Development** para os DOIS ambientes por enquanto — dá para trocar a Produção para chaves de Production depois que a URL da Vercel estiver definida (Clerk pede o domínio final antes de liberar Production).
5. Em **API Keys**, copie:
   - `Publishable key` → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `Secret key` → `CLERK_SECRET_KEY`
6. Em **Webhooks**, ainda não precisa criar nada — o produto aceita rodar sem `CLERK_WEBHOOK_SECRET` configurado (funcionalidade condicionada, documentada).

## Passo 4 — Upstash (Redis)

1. Crie uma conta em [upstash.com](https://upstash.com) (login com GitHub também funciona).
2. Crie dois bancos Redis (**Create Database**), um por ambiente: `nfc-os-production`, `nfc-os-staging`. Tipo "Regional" é suficiente.
3. Para cada banco, na aba **Details**:
   - Copie o **REST URL** e o **REST Token** → `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.
   - Role até **Connect → ioredis** e copie a connection string `rediss://...` → `REDIS_URL`.

## Passo 5 — Vercel (hospedagem, dois projetos)

1. Crie uma conta em [vercel.com](https://vercel.com) com login GitHub (assim ele já pede autorização para importar o repositório).
2. **Add New → Project**, importe `nfc-review-pro`. Faça isso DUAS VEZES, criando dois projetos separados a partir do mesmo repositório:
   - `nfc-os-production` — em **Settings → Git**, defina a **Production Branch** como `main`.
   - `nfc-os-staging` — em **Settings → Git**, defina a **Production Branch** como `staging` (isso faz o próprio ambiente "Production" desse projeto rastrear a branch staging, dando a ele também uma URL estável).
3. Em cada projeto, vá em **Settings → Environment Variables** e cole as variáveis do ambiente correspondente (produção usa as chaves/strings de produção; staging usa as de staging):

   ```
   DATABASE_URL=...
   DIRECT_URL=...
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
   CLERK_SECRET_KEY=...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   UPSTASH_REDIS_REST_URL=...
   UPSTASH_REDIS_REST_TOKEN=...
   REDIS_URL=...
   CRON_SECRET=<gere uma string aleatória longa, uma por ambiente>
   IP_HASH_SALT=<gere outra string aleatória longa, uma por ambiente>
   NEXT_PUBLIC_APP_URL=<preenchido no passo seguinte, depois do primeiro deploy>
   ```

4. Clique **Deploy** nos dois projetos. Cada um vai te dar uma URL estável do tipo `https://nfc-os-production.vercel.app` e `https://nfc-os-staging.vercel.app` (ou o nome que você escolheu) — essas URLs **nunca mudam** enquanto o projeto existir.
5. Volte em **Environment Variables** e preencha `NEXT_PUBLIC_APP_URL` com a URL real de cada projeto (necessário para o White Label/Assets Inteligentes gerarem links absolutos corretos) — depois disso, um "Redeploy" (sem precisar de um novo commit) já aplica.

## Passo 6 — De volta para mim

Quando os dois ambientes estiverem no ar (mesmo que ainda deem erro de aplicação — o importante é o domínio responder), me avise com:
- As duas URLs (produção e staging).
- Confirmação de que as variáveis de ambiente foram preenchidas nos dois projetos Vercel.

A partir daí eu assumo: rodar `prisma migrate deploy` contra cada banco, rodar o seed em cada um, verificar que os dois ambientes sobem sem erro, e começar a auditoria de ponta a ponta de verdade — a que só é possível com um banco real.

---

## Por que dois projetos Vercel em vez de um com "preview"

O Vercel já dá uma URL de preview para toda branch/PR, mas essas URLs podem mudar de formato e não são pensadas para serem links permanentes e memorizáveis. Dois projetos separados, cada um com sua branch de produção própria, dão duas URLs **igualmente estáveis e definitivas** — exatamente o "não depender de localhost, ambientes claramente separados" pedido.
