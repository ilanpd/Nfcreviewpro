# Guia de implantação na Hostinger (teste dentro dos 30 dias de reembolso)

Objetivo: provar que o app roda bem no plano **Unlimited** (3 GB de RAM, 2 núcleos) **antes** de trocar o DNS. A Vercel continua no ar o tempo todo. Se o teste falhar, peça o reembolso da hospedagem (30 dias a partir do pagamento) e siga na Vercel Pro.

> Os nomes exatos dos menus do hPanel podem mudar. Onde estiver diferente, o objetivo do passo é o que vale; me mande um print.

## 0. Ao comprar

- Pague com **cartão** (cripto não é reembolsável) e escolha **12 meses**.
- Na configuração do plano, **escolha o data center de São Paulo se ele aparecer**. Se não aparecer, anote os locais oferecidos e me avise antes de confirmar.
- O domínio vai gravado em cada chip e **não muda depois**: confirme o nome.
- Anote a data do pagamento: **o reembolso vale por 30 dias**. Decidir até o dia 20.

## 1. O teste roda isolado da Produção

Use um subdomínio de teste (por exemplo `teste.SEUDOMINIO`) e os dados de **Staging**: banco de Staging, Clerk em modo Development, Stripe em modo teste. Nada do teste toca a Produção.

## 2. Criar o app Node.js

1. hPanel → **Sites / Aplicativos web → Node.js** → criar a partir do **GitHub** (repositório `ilanpd/Nfcreviewpro`, branch `main`). A Hostinger vai pedir autorização no GitHub.
2. Framework: **Next.js**. Versão do Node: **22** (o Prisma 7 exige 20.19+ ou 22.12+).
3. Comando de build: `npm run build` (já roda `prisma generate`). Comando de início: `npm start`.
4. O build precisa **instalar também as dependências de desenvolvimento** (Prisma, TypeScript e Tailwind são usados na construção). Se o build reclamar que não acha `prisma`, é isso.
5. Aponte o subdomínio de teste para esse app.

## 3. Variáveis de ambiente (você cola no painel; eu não digito chaves)

As que começam com `NEXT_PUBLIC_` são embutidas **na hora do build**: defina todas **antes** do primeiro build.

| Grupo | Variáveis |
|---|---|
| Endereço | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CARD_BASE_URL` (no teste, o subdomínio) |
| Banco | `DATABASE_URL` (Staging) |
| Login (Clerk) | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL` |
| Pagamento (Stripe, modo teste) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_STARTER` (e `_PRO`, `_BUSINESS` se existirem) |
| Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `REDIS_URL` |
| E-mail | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SUPPORT_INBOX_EMAIL` |
| Segredos do app | `CRON_SECRET`, `IP_HASH_SALT`, `RETURN_PIN_SECRET`, `NFC_API_KEY` |
| Administração | `SUPER_ADMIN_EMAILS` |
| Opcionais | `BILLING_GATE_ENFORCE`, `CARD_URL_REQUIRE_FINAL`, `NEXT_PUBLIC_SENTRY_DSN` |

**Nunca defina** `DEV_RUNTIME`, `DEV_RUNTIME_EMAIL` nem `ALLOW_DEV_TOOLS` na hospedagem: são só do computador de desenvolvimento e pulam o login.

## 4. Agendamentos (substituem os cron da Vercel)

No hPanel → **Cron Jobs**, três tarefas diárias. O `CRON_SECRET` é o mesmo da variável de ambiente; troque `SEUDOMINIO` pelo endereço do app.

```bash
curl -fsS -H "Authorization: Bearer SEU_CRON_SECRET" https://SEUDOMINIO/api/queues/process
curl -fsS -H "Authorization: Bearer SEU_CRON_SECRET" https://SEUDOMINIO/api/playbooks/evaluate
curl -fsS -H "Authorization: Bearer SEU_CRON_SECRET" https://SEUDOMINIO/api/return/reengagement
```

Horários de referência (UTC, como no `vercel.json`): 06:00, 07:00 e 08:00. Confira o fuso do servidor.

## 5. Critérios do teste (todos precisam passar)

| Teste | Passa se |
|---|---|
| Build | termina sem o processo ser morto por falta de memória (o pico local foi ~2,5 GB com 1 worker; o limite do plano é 3 GB) |
| App no ar | a página inicial e `/loja` abrem pelo subdomínio |
| **Velocidade do toque** | média de 8 chamadas em `/r/qualquercodigo` **≤ 0,5 s** (na Vercel em São Paulo é ~0,34 s) |
| Login | entrar e sair com o Clerk (Development) |
| PDF do lote | exportar o PDF de um lote de 20 placas em até 60 s, sem erro |
| Agendamentos | os 3 endereços da seção 4 respondem 200 |
| Estabilidade | memória estável depois de 1 hora de uso leve |
| Pagamento (teste) | um webhook do Stripe em modo teste chega e o pedido é criado |

Medição do toque (rode no seu computador):

```bash
for i in 1 2 3 4 5 6 7 8; do curl -s -o /dev/null -w "%{time_total}s\n" https://teste.SEUDOMINIO/r/zzzzzzzzzz; done
```

As duas primeiras costumam ser lentas (partida a frio); compare as demais.

## 6. Decisão

- **Tudo passou:** trocar o DNS do domínio principal (a Vercel fica como volta por 7 dias), apontar Clerk Production, Stripe live e Resend para o domínio definitivo (ver "Plano de migração" em `PROXIMAS_TAREFAS.md`).
- **Algo falhou:** pedir o reembolso da hospedagem dentro dos 30 dias e subir a Vercel para o plano Pro.
