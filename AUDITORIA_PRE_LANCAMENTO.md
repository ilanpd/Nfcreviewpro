# Auditoria pré-lançamento do Pulse — 05/10/2026

Mapa completo do que falta, do que tem erro e do que pode melhorar, para você poder tocar o trabalho em partes enquanto junta o dinheiro da hospedagem, do domínio e do lote. Cada item diz **o que é**, **a evidência**, **quanto custa** (em dinheiro e em trabalho) e **quem faz**.

> **Atualização — pacote 1 (segurança) feito:** P1-4 (SSRF), P1-5 (página de sucesso) e P1-8 (dependências) estão no ar. **P1-1 (RLS) continua com você:** o SQL está pronto em `SQL_PRODUCAO_RLS.sql`. O plano da CSP está no ADR-094.

**Escala de prioridade**
- **P0** — impede a primeira venda real. Quase tudo aqui depende de dinheiro, de conta ou de decisão sua.
- **P1** — segurança e confiabilidade. Custa R$ 0 e deve vir antes de ter cliente de verdade.
- **P2** — qualidade, conversão e robustez.
- **P3** — limpeza e dívida técnica.

**Escala de esforço (meu trabalho):** **P** até meio dia · **M** 1 a 2 dias · **G** mais de 2 dias.

---

## 1. Resumo em um minuto

- **A base está sólida:** 828 testes passando, `tsc` e build limpos, nenhuma das 52 páginas estáticas dá erro 500, o isolamento entre empresas está correto nos pontos que conferi, e o toque na placa já está rápido (0,34 s).
- **O que impede vender hoje (P0):** 10 itens, e quase todos são seus: hospedagem que permita uso comercial, domínio, Clerk e Stripe em produção, e-mail de verdade, textos legais com CNPJ, definição de nota fiscal, ligar as travas de lançamento, limpar os dados de teste e fechar a arte do lote.
- **O que posso fazer sem gastar nada agora (P1 e P2):** 8 itens de segurança e confiabilidade e 18 de qualidade (seção 5 e 6). O mais importante é **ligar o RLS do Supabase** (SQL pronto), **ter alertas de erro (Sentry)** e **escrever os testes do caminho do dinheiro**.
- **Quatro achados que eu não esperava:**
  1. Em Produção, **33 das 39 tabelas estão sem RLS**, e os papéis públicos do Supabase têm permissão nelas (inclui pedidos com CPF/telefone/endereço).
  2. **Nenhum alerta de erro está ligado**: se algo quebrar para um cliente, você não fica sabendo (e o plano Hobby guarda só 1 hora de log).
  3. A página `/loja/sucesso` diz **"Pedido confirmado!" mesmo sem pedido** ou com pagamento pendente.
  4. A página pública `/developers` **fica larga demais no celular** (tabela de 1078 px sem rolagem).
- **Já resolvido hoje, no ar:** tema escuro como padrão nativo, funções da Vercel em São Paulo (toque de ~0,86 s para ~0,34 s), pedidos e Centro de Operações redesenhados.

---

## 2. Como foi feita e o que não foi coberto

**Feito (com evidência):** leitura dos 4 documentos de backlog; varredura de TODO/testes pulados; `tsc`, `eslint`, `vitest` (725) e build de produção; `npm audit`; inventário das 178 rotas de API e sua proteção; leitura do isolamento entre empresas em cartões, chaves de API, equipe, webhooks, feedback e playbooks; catálogo e contagens do banco de Produção (somente leitura, sem ler dado de cliente); cabeçalhos de segurança ao vivo; HTTP em 52 páginas; layout em celular (390 px) em ~40 páginas; contraste de cor automático em 7 telas nos dois temas; peso do JavaScript por rota; velocidade do toque ao vivo; variáveis de ambiente de Produção (só os nomes).

**Não coberto (precisa de você ou de outro ambiente):**
- Telas logadas **em Produção** (exigem login); páginas com dado real (cartão público `/r/<código>` com cartão ativo, `/meu-cartao/<token>`, detalhe de empresa/lote/modelo).
- Lighthouse, leitor de tela, iPhone Safari, Android e navegador do Instagram/WhatsApp; leitura NFC real.
- E-mail real, Stripe e Clerk em produção, teste de carga.
- Contraste da **página inicial**: o navegador de teste não roda animações, então 87 de 124 textos ficaram de fora (dos 37 medidos, nenhum falhou).
- Backups do Supabase (exige o painel).

---

## 3. Saúde medida hoje

| Item | Resultado |
|---|---|
| `tsc` | limpo |
| `eslint` | 0 erros, 2 avisos (no componente sem uso `dia-text-reveal`) |
| Testes | **828 passando** em 59 arquivos (725 antes do pacote 1) |
| Build de produção | limpo; 242 rotas medidas |
| Páginas estáticas (52) | **0 erros 500** |
| Layout em celular | 1 página com defeito (`/developers`); tabelas do painel rolam por dentro do cartão |
| Contraste (WCAG AA) | 2 defeitos pequenos (ver P2-4); resto passou nos dois temas |
| `npm audit` (produção) | **8 avisos, 0 críticos** (eram 11; ver P1-8): tudo em ferramentas de build ou sem uso real, só com conserto por salto de versão |
| Cobertura de testes | domínio bem coberto; **serviços 2 de 43, rotas de API 4 de 178** |
| Velocidade do toque | **~0,34 s** (média de 8 medições, após fixar São Paulo) |
| JavaScript da página inicial | 397 kB (média do site: 212 kB; análises 500 kB) |
| Cabeçalhos de segurança | HSTS, X-Frame-Options, nosniff, Referrer-Policy e Permissions-Policy ativos; **CSP só em modo relatório** |
| Rotas `/api/dev/*` em Produção | todas **404** (bem protegidas) |

---

## 4. P0 — Impedem a primeira venda real

| # | Item | Evidência | Custo / quem |
|---|---|---|---|
| **P0-1** | **Hospedagem que permita uso comercial.** O plano Hobby da Vercel só permite uso pessoal; receber pagamento já é comercial. | Time `nfc-review-pro1` está em **hobby**; política oficial conferida. | Vercel Pro US$ 20/mês **ou** Hostinger Unlimited (teste com reembolso de 30 dias, guia em `HOSTINGER_DEPLOY.md`). **Você decide e paga.** |
| **P0-2** | **Domínio próprio + trava do endereço do cartão.** O chip e o QR levam o endereço para sempre. | `NEXT_PUBLIC_CARD_BASE_URL` e `CARD_URL_REQUIRE_FINAL` **ausentes** em Produção: hoje nada impede imprimir com `vercel.app`. | ~R$ 65–95/ano. Você compra; **eu** configuro e testo (M se houver migração de hospedagem). |
| **P0-3** | **Clerk em Production.** | Chaves de desenvolvimento, selo "Development mode", app com o nome antigo "Nfc Review Pro". | Grátis até certo volume; precisa do domínio. **Você** cria a instância e cola as chaves; eu valido (P). |
| **P0-4** | **Stripe live.** | Preços e chaves hoje são de teste; o webhook está no endereço antigo. | Ativar a conta (dados do negócio, banco). **Você**; eu confiro o fluxo com 1 compra real de valor baixo (reembolsada). |
| **P0-5** | **E-mail transacional de verdade.** Hoje nenhum e-mail sai. | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` e `SUPPORT_INBOX_EMAIL` ausentes; remetente padrão ainda `pedidos@nfcreviewpro.com.br`; **nunca um e-mail real foi enviado em nenhum ambiente**. Inclui os e-mails de envio e entrega que os botões de Expedição e Entregue disparam. | Resend tem plano grátis. **Você** cria a conta e os registros DNS (SPF/DKIM/DMARC); eu configuro e testo. |
| **P0-6** | **Textos legais finais.** | `/termos` e `/privacidade` mostram no ar: "[razão social e CNPJ a definir]", "[a definir]" (foro), "[e-mail de contato a definir]", DPO. | Dados seus + revisão jurídica. **Você.** Eu preencho em minutos (P). |
| **P0-7** | **Nota fiscal.** O site coleta CPF/CNPJ, mas não emite documento fiscal. | Nenhuma emissão no código. | **Decisão sua** (contador, ERP ou emissor). Posso exportar os pedidos no formato que ele pedir (P). |
| **P0-8** | **Travas de lançamento.** | `BILLING_GATE_ENFORCE` **ausente**: o painel abre sem assinatura. (`RETURN_PIN_SECRET` e `IP_HASH_SALT` já existem.) | Liga com 1 variável, mas antes confira as empresas de teste (P0-9). |
| **P0-9** | **Limpar os dados de teste de Produção.** | Hoje: 13 empresas (10 clientes, 3 convidadas), 16 usuários, 89 cartões, **23 pedidos** (10 pagos, 5 cancelados, 4 entregues, 3 pendentes, 1 enviado), 406 visitas, 3 chaves de API, 1 lote com 10 placas, 1 modelo; contador de chips em 12. Preservar a empresa de demonstração que alimenta `/api/demo`. | **Eu** escrevo a consulta de conferência e o SQL; **você roda no Supabase** (a plataforma bloqueia apagar em massa). Fazer **depois** do Stripe live e **antes** do lote. |
| **P0-10** | **Lote real: arte e prova física.** | Arte gerada por IA tem erro de letra e é raster; risco de marca (Google, "G", estrelas); o QR e o chip nunca foram lidos de uma placa real. | Designer (vetor), decisão sobre a arte neutra, prova impressa. **Você.** |

---

## 5. P1 — Segurança e confiabilidade (R$ 0)

| # | Item | Evidência | Esforço |
|---|---|---|---|
| **P1-1** | **Ligar RLS nas tabelas antigas.** Sem RLS, quem tiver a chave pública do projeto Supabase pode ler e escrever essas tabelas pela API de dados, sem passar pelo app. | **Produção: 33/39 tabelas sem RLS; `anon` e `authenticated` com permissão em 39.** Staging: 38/39 sem RLS. As 5 tabelas do estoque já têm RLS e o app funciona com elas. | **P.** SQL pronto: `SQL_PRODUCAO_RLS.sql`. **Você roda**, primeiro no Staging, confere o app, depois em Produção. (Tentei validar no Staging, mas a plataforma bloqueou a alteração, e respeitei.) |
| **P1-2** | **Alertas de erro.** Hoje nada avisa quando algo quebra. | `NEXT_PUBLIC_SENTRY_DSN` ausente (o código já tem Sentry pronto, desligado); logs de execução do Hobby: 1 hora. | **P** + conta grátis no Sentry (você cria, eu ligo). |
| **P1-3** | **Testes do caminho do dinheiro e do estoque.** | `store-order.service`, o webhook do Stripe e `card.service` sem teste; 4 de 178 rotas com teste. Eu mesmo mexi hoje em `store-order.service` e só validei ao vivo. | **M–G.** Webhook Stripe (assinatura, repetição), provisionamento, avanço de etapa, atribuição de placa, e um conjunto de testes de **acesso entre empresas**. |
| **P1-4** | **SSRF no envio de webhooks do cliente.** O dono (ou uma chave de API) escolhe a URL que o servidor chama; não há bloqueio de endereços internos. | `lib/webhooks/delivery.ts`: nenhuma guarda de IP privado, de `https` ou de redirecionamento. | ✅ **Feito (pacote 1, ADR-094):** bloqueio no cadastro e na conexão, testado ao vivo com um domínio público que aponta para `127.0.0.1`. |
| **P1-5** | **`/loja/sucesso` confirma pedido que não existe.** | A página mostra "Pedido confirmado!" com o ícone de sucesso mesmo com `session_id` vazio, pedido cancelado ou pagamento pendente. | ✅ **Feito (pacote 1, ADR-094):** os 6 estados conferidos; o pendente se atualiza sozinho. |
| **P1-6** | **Backups do banco.** Não consegui verificar. | Exige o painel do Supabase: plano, backup diário/PITR e um teste de restauração. | **Você** confere; eu escrevo o roteiro de restauração (P). |
| **P1-7** | **Monitor externo (uptime).** | Nada vigia o toque `/r/<código>` nem o webhook do Stripe (webhook falhando = pedido pago sem produção). | **P.** Serviço grátis de monitoramento + alerta por e-mail. |
| **P1-8** | **Dependências.** | `npm audit`: 11 (7 altos, 0 críticos). Altos em ferramentas de build (Prisma CLI, PostCSS do Next) e em pacotes transitivos (`@grpc/grpc-js`, `brace-expansion`, `fast-uri`). `npm audit fix` resolve 3 sem quebrar; o resto exige salto de versão grande (o conserto sugerido para Prisma é um **downgrade**, então ignorar). Há patches: Next 15.5.27, Clerk 7.9.11, Upstash, Stripe etc. | ✅ **Feito (pacote 1, ADR-094):** 11 → 8 avisos, 0 críticos; Next 15.5.27, Clerk 7.9.11 e outros. Os 8 restantes só têm conserto por salto de versão (avaliados no ADR). |

---

## 6. P2 — Qualidade, conversão e robustez

| # | Item | Evidência |
|---|---|---|
| **P2-1** | **CSP em modo relatório e permissiva.** | Cabeçalho `Content-Security-Policy-Report-Only` com `script-src 'unsafe-inline' 'unsafe-eval' https: http:`: na prática não bloqueia nada. Endurecer com *nonces* é M e exige testar Clerk e Stripe. |
| **P2-2** | **Peso do JavaScript.** | Página inicial **397 kB**; `/dashboard/analytics` 500 kB. Carregar sob demanda os blocos pesados da home (M). |
| **P2-3** | **Celular: `/developers`.** | Tabela de 1078 px sem contêiner de rolagem: a **página inteira alarga** e rola de lado. Correção de uma linha (P). As tabelas do painel (`/admin/empresas`, campanhas, mensagens, desenvolvedores) rolam por dentro do cartão: aceitável, mas podem virar cartões no celular (M). |
| **P2-4** | **Contraste abaixo de 4,5:1.** | Contadores dos filtros de `/admin/pedidos` (feitos hoje): 3,71:1 no escuro, 3,54:1 no claro; nota "Pagamento processado com segurança" na loja em claro: 4,40:1. (P) |
| **P2-5** | **Acessibilidade.** | 6 botões só-ícone sem nome acessível (3 em `playbooks-view`); 72 `<Input>` sem `id`/`aria-label` pela minha heurística (muitos já têm `<Label>`); Lighthouse e leitor de tela nunca medidos. |
| **P2-6** | **Favicon.** | `/favicon.ico` dá 404 em Produção (os ícones vêm de `/api/brand/*`). Depende do logo final (SVG) que está com você. |
| **P2-7** | **Dicionário de métricas.** | "Toque" é contado de formas diferentes; saúde da conta, radar, ranking, insights, heatmap, previsão, funil e playbooks ainda leem `RatingEvent`/`redirectedGoogle`. (M–G) |
| **P2-8** | **Modo só leitura incompleto.** | Com assinatura cancelada, campanhas, cartões e equipe continuam gravando (hoje só o rebaixamento para Starter segura). (M) |
| **P2-9** | **Retorno sem cache.** | Cada toque em cartão Starter faz 2 consultas a mais; cachear por empresa no Redis. (M) |
| **P2-10** | **Home e funil com texto antigo.** | Bento com exemplos, vídeo "em breve"; copy de Loja e onboarding não revisada. (M) Decisão de conteúdo sua. |
| **P2-11** | **Testes em aparelho real.** | iPhone Safari (cookie `pv`), Android, navegador do Instagram/WhatsApp; leitura NFC. **Você** (celular) + eu analiso. |
| **P2-12** | **Teste de uso do Retorno com 3 donos.** | Critério do plano: ligar em menos de 5 minutos sem ajuda. **Você.** |
| **P2-13** | **Não testados ao vivo:** `/r/[code]/teste` e o envio de "Falar com a gente". | Só lidos no código e testados em unidade. (P) |
| **P2-14** | **CI incompleto.** | `.github/workflows/ci.yml` roda só `tsc`, `lint` e `test`: **sem `build` e sem `npm audit`**. Foi um build quebrado que causou um incidente no C15. (P) |
| **P2-15** | **Nome público da API/SDK antigo.** | `NfcOsClient` e textos de `/developers` ainda com o nome antigo. É contrato externo: mudar com versionamento. (M) |
| **P2-16** | **Localização dos toques depende da Vercel.** | País e cidade vêm de cabeçalhos `x-vercel-ip-*`; sem eles o campo fica vazio (nada quebra). Relevante só se migrar. (P) |
| **P2-17** | **Documentos desatualizados.** | Alguns itens de `PROXIMAS_TAREFAS.md` já foram resolvidos (ver Apêndice). |
| **P2-18** | **Mapa de Mesas no celular.** | Tela de arrastar e ampliar; gestos de toque nunca testados em aparelho real. |

---

## 7. P3 — Limpeza e dívida técnica

- **14 componentes de interface sem nenhum uso** (efeitos como `particles`, `meteors`, `marquee`, `magic-card`, `border-beam`, `calendar`, `popover`…): apagar tira os 2 avisos do `eslint` e diminui o repositório.
- Rotas `/api/ratings` e `/api/ratings/[id]/redirect` sem nenhum chamador; coluna morta `NFCCard.qrCodeUrl` (a remoção exige SQL seu).
- `plates.service.ts` com 1268 linhas: dividir em partes menores.
- `createCard` confere o limite do plano e cria em dois passos, sem transação (dois cliques simultâneos podem passar do limite).
- Brindes vencidos ficam `ISSUED` até uma limpeza que ainda não existe; mensagem "Retorno pausado" para quem nunca ativou; feed ao vivo sem tipo "conversão".
- 13 relatórios de fase soltos na raiz (`RELATORIO_FASE_*.md`): mover para uma pasta de arquivo.
- QR ainda no azul genérico, não na cor da identidade Pulse.
- `/api/demo/*` é público de propósito, com dados da empresa de demonstração: manter, mas lembrar de preservar essa empresa na limpeza (P0-9).

---

## 8. Decisões que só você pode tomar

1. **Hospedagem:** Vercel Pro ou Hostinger (após o teste).
2. **Domínio:** `.com` ou `.com.br`, e o nome final (vai gravado em cada chip).
3. **Razão social, CNPJ, foro, e-mail e encarregado de dados** para os textos legais.
4. **Nota fiscal:** como será emitida e por quem.
5. **Preços e planos:** Pro e Business estão congelados (sem preço no Stripe); o preço de frete e a política de troca, reembolso e prazo de entrega (eu não invento texto de política).
6. **Arte das placas:** versão neutra (sem "G" do Google e sem estrelas) e designer em vetor.
7. **O que é dado de teste e o que é real** nas 13 empresas e 23 pedidos de Produção antes da limpeza.

---

## 9. Plano de execução sugerido (quando você disser "pode ir")

| Pacote | O que entra | Esforço | Custo |
|---|---|---|---|
| **1. Segurança sem custo** | P1-1 (você roda o SQL), P1-4, P1-5, P1-8, plano de endurecer a CSP | 1–2 dias | R$ 0 |
| **2. Confiança no dinheiro** | P1-3 (testes), P2-14 (CI com build e audit) | 2–3 dias | R$ 0 |
| **3. Visibilidade** | P1-2 (Sentry), P1-7 (monitor), P1-6 (roteiro de backup) | 0,5 dia + contas grátis | R$ 0 |
| **4. Acabamento** | P2-3, P2-4, P2-5, P2-6, P2-13, P3 (14 componentes sem uso) | 1–2 dias | R$ 0 |
| **5. Desempenho** | P2-2 (JS da home), P2-9 (cache do Retorno) | 1–2 dias | R$ 0 |
| **6. Métricas e assinatura** | P2-7, P2-8 | 3–4 dias | R$ 0 |
| **7. Dia do lançamento** | P0-1 a P0-10, na ordem do "Plano de migração" em `PROXIMAS_TAREFAS.md` | depende de você | hospedagem + domínio + lote |

Ordem que eu recomendo: **1 → 3 → 2 → 4 → 5**. Os pacotes 1 e 3 dão a maior proteção pelo menor esforço.

---

## 10. O que já está bom (não mexer)

- Isolamento entre empresas: toda alteração conferida busca primeiro por `id + empresa` (cartões, chaves, equipe, webhooks, feedback, playbooks).
- Rotas públicas têm limite de requisições e validação (`/api/visits`, `/api/ratings`, `/api/vouchers/*`, `/api/contact`).
- Webhook do Stripe verifica a assinatura; as rotas de agendamento exigem segredo; `/api/dev/*` responde 404 em Produção.
- Cabeçalhos HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy` e `Permissions-Policy` ativos.
- Tema escuro como padrão nativo (confirmado em Produção em visitante novo; escolha do claro é lembrada).
- Toque na placa em ~0,34 s; peso médio de 212 kB por rota; 0 erros 500; contraste aprovado no painel e no admin nos dois temas.
- Estoque de placas, pedidos e etapas: testados ao vivo ponta a ponta e documentados (ADR-092 e ADR-093).

---

## Apêndice — status do backlog antigo (`PROXIMAS_TAREFAS.md`)

**Já resolvido ou provavelmente obsoleto (confirmar e marcar como feito):**
- "Painel abre sem checar assinatura": o *gate* existe; falta só ligar a variável (P0-8).
- `RETURN_PIN_SECRET` em Produção: **existe** (conferido).
- "Registrar 2 migrações no histórico do Prisma em Produção": o `predeploy` confirma todas aplicadas; 17 migrações no histórico.
- "Aplicar `retorno_fundacao` em Produção": a tabela `Voucher` existe em Produção.
- "Venda fora do site e estoque (J8)": entregue (ADR-092).
- Telas `/sign-in` e `/sign-up`: abrem escuras e com o tema aplicado (o que falta é o item P0-3).

**Ainda aberto e já coberto acima:** domínio e trava do cartão (P0-2), Clerk (P0-3), Stripe (P0-4), e-mail (P0-5), textos legais (P0-6), limpeza de testes (P0-9), arte final e teste do chip (P0-10), SSRF (P1-4), métricas (P2-7), modo só leitura (P2-8), cache do Retorno (P2-9), acessibilidade e testes em aparelho (P2-5, P2-11), nome da API (P2-15), componentes sem uso (P3), coluna morta (P3), corrida em `createCard` (P3).

**Decisões de produto, não são bugs:** material comercial do Starter vs destino do avulso, Fluxo 5 (upgrade Starter→Pro), checkout nativo da Loja, feed de conversões, motion por página.
