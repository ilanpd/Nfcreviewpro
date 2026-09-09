# Relatório da Fase 10 — White Label Enterprise

Ver `ROADMAP.md` para a lista completa de fases e `PROXIMAS_TAREFAS.md` para o checklist que esta fase fecha. Esta é a primeira fase sob três novas regras permanentes: **Enterprise Brand Review** (sétimo review obrigatório), **Franchise First Review** (oitavo review obrigatório) e **Luxury UX** (regra de engenharia permanente, não um review de fase) — ver seções dedicadas abaixo.

## O que foi implementado

O objetivo declarado desta fase era transformar cada cliente em dono de uma plataforma própria — não trocar um logo, mas fazer o produto inteiro (dashboard, login, QR, impressão) parecer construído exclusivamente para aquela empresa.

- **Identidade completa por empresa:** `Company` ganhou `secondaryColor`, `domainVerifiedAt`, `domainVerificationToken`, `loginHeadline`, `loginBackgroundUrl` (somados a `faviconUrl`/`domain`, já preparados na Fase 9 — ADR-039). Subdomínio gratuito e imediato via `Company.slug` (`{slug}.dominio-raiz`), sem nenhuma configuração adicional.
- **`DomainResolver`** (`src/lib/white-label/resolve-brand.ts`): resolve um `Host` HTTP para a marca de uma empresa — raiz do produto (sem marca própria), subdomínio (`Company.slug`) ou domínio customizado (`Company.domain`, só quando `domainVerifiedAt` está preenchido). Cacheado por Host (`cachedOrLoad`, TTL 120s, reaproveitando o helper genérico do Resolution Engine da Fase 1) — a mesma consulta indexada O(1) independente de 1 ou 5.000 tenants.
- **Domínio customizado com verificação real** (`src/services/company.service.ts`, `src/lib/white-label/dns.ts`): `claimDomain`/`removeDomain`/`verifyDomainOwnership` confirmam posse via um registro TXT (`_nfcos-challenge.<domínio>`) checado por DNS-over-HTTPS (Cloudflare) — nunca finge verificar. Apontamento de CNAME e emissão de SSL continuam manuais, do lado da hospedagem (limite honesto, documentado, não escondido).
- **`BrandProvider`/`useBrand()`** (`src/components/white-label/brand-provider.tsx`): único ponto de verdade para cor/logo em runtime — variáveis CSS (`--brand-primary`, `--brand-secondary`, `--brand-hover`, `--brand-pressed`, `--brand-on-primary`) calculadas uma vez via `buildBrandColorSet`, aplicadas com zero impacto de layout (`display:contents`). Usado em exatamente dois lugares: o layout do dashboard e as telas de login/cadastro — `AppSidebar` e outros componentes estáveis continuam recebendo prop, sem reescrita não justificada.
- **Login com marca própria:** `BrandedAuthScreen` (`src/components/white-label/branded-auth-screen.tsx`) é puramente decorativo (fundo/logo/mensagem) ao redor do `<SignIn>`/`<SignUp>` do Clerk, que continua sendo o único responsável por autenticar; a única customização real do Clerk é `appearance.variables.colorPrimary`, a API oficial dele para isso.
- **Assets Inteligentes:** `/api/brand/icon`, `/api/brand/og` e `/api/brand/manifest` (Route Handlers `runtime="nodejs"`, `next/og`'s `ImageResponse`) geram favicon/Apple Touch Icon/Open Graph/Twitter Card/Web App Manifest resolvidos por Host a cada requisição. Sem favicon/logo próprio, geram um distintivo com a inicial do nome sobre a cor de marca — nunca um ícone genérico sem identidade. O `favicon.ico` estático foi removido de propósito (arquivado em `.archive/`, não perdido).
- **QR Code White Label** (`src/lib/qrcode.ts`): `ensureScannableDark` escurece progressivamente a cor da marca até contraste ≥7:1 contra branco antes de qualquer QR ser gerado — nunca um QR bonito e ilegível.
- **Impressão Profissional (bônus):** `src/services/export/print-asset-pdf.tsx` + `print-assets.service.ts` geram 5 formatos com dimensões físicas reais (adesivo 50×50mm, cartão PVC padrão CR80, displex de mesa 100×150mm, cavalete A4, plaquinha 80×120mm) via `@react-pdf/renderer`, sem canvas/`sharp` — `GET /api/cards/:id/print?template=`.
- **Theme Studio** (`/dashboard/branding`, `theme-studio-view.tsx`): 4 abas (Identidade/Login/Domínio/Impressão) com preview ao vivo (dashboard/login/QR/mockups físicos) que muda instantaneamente ao editar um campo — rascunho em estado React local, nunca persistido até "Salvar" explícito.
- **Brand Motion System (bônus):** `.brand-glow`/`.brand-hover`/`.brand-ripple` (utilities CSS + componente `BrandRipple`) derivam glow/hover/ripple automaticamente da cor de marca via `color-mix`, com fallback para a cor padrão do produto fora de um `BrandProvider` — zero configuração manual, respeitando `prefers-reduced-motion`.
- **Segurança:** primeiro CSP do produto (nativo do Clerk, `report-only`) e HSTS real (`next.config.ts`, sem `preload`) — ver ADR-045.
- **Preparação (não implementação) para as Fases 11, 12 e 13** — ver ADR-046.
- **Fase 13 — AI Copilot & Marketplace OS registrada como fase futura** em `ROADMAP.md`, a pedido explícito: nada projetado nem implementado, só documentada no lugar certo.
- **Achado e corrigido durante a própria construção:** a primeira versão do `DomainResolver` chamava o Prisma de dentro do `middleware.ts` (como o pedido original desenhava) — o build de produção falhou de verdade, porque o Edge Runtime deste Next.js não sustenta o Prisma. Corrigido movendo a resolução para as páginas de login/cadastro (ver ADR-042 e Achados do Architect Review abaixo).

## Enterprise Brand Review (nova regra permanente, primeira fase em que se aplica)

**Pergunta institucional: "Uma rede com 500 unidades teria coragem de colocar sua marca inteira em cima disso?"**

- **Identidade visual:** logo, favicon, cor primária e secundária (derivada automaticamente se não informada), tudo aplicado sem "vazamento" da marca padrão do NFC OS em nenhuma tela nova desta fase.
- **Domínio:** subdomínio gratuito imediato (`{slug}.dominio-raiz`) para toda empresa, mais domínio customizado verdadeiramente próprio (`app.pizzariabella.com`) com verificação de posse real — nunca uma URL que entrega a marca do NFC OS por engano.
- **Login:** tela de entrada com o nome/logo/mensagem/cor da empresa, não uma tela genérica de "faça login no NFC OS."
- **Favicon/e-mails/URLs:** favicon dinâmico por empresa; Open Graph/Twitter Card levam o nome e a cor da empresa quando o link é compartilhado — **e-mails transacionais continuam fora do escopo desta fase** (o produto não envia e-mail de marca própria hoje, um limite honesto, não uma omissão).
- **QR codes e NFCs:** cor de marca sempre com contraste garantido (≥7:1), nunca ilegível; ativos de impressão físicos com dimensões reais, prontos para uma gráfica de franquia de verdade.
- **Consistência entre telas:** a mesma marca (mesmas cores, mesmo logo) aparece no dashboard, no login e nos ativos de impressão — calculada uma única vez (`buildBrandColorSet`), nunca recalculada de formas diferentes em lugares diferentes.
- **Mobile e desktop:** o Theme Studio e as telas de login usam os mesmos componentes responsivos já validados em fases anteriores — nenhuma tela nova desta fase quebra em viewport estreito (não re-testado com um dispositivo físico, mas nenhum CSS novo desta fase usa unidade fixa incompatível com telas pequenas).

**Veredito honesto:** sim, para a superfície que esta fase cobre — mas com uma reserva registrada sem rodeio: o pedido original incluía "temas claro e escuro," e este produto nunca teve dark mode de verdade ligado em nenhuma fase anterior (ver ADR-047 e "Achados do Architect Review" abaixo). Uma rede de 500 unidades hoje colocaria sua marca com segurança sobre login/dashboard/QR/impressão — mas só no tema claro, porque é o único que o produto realmente tem.

## Franchise First Review (nova regra permanente, primeira fase em que se aplica)

**Checklist institucional: funciona para 1 loja? Para 50? Para 500? Para 5.000?**

- **`DomainResolver`:** uma consulta indexada por `slug` (subdomínio) ou por `domain` (customizado, só quando verificado), cacheada por Host com TTL de 120s — 1, 50, 500 ou 5.000 empresas fazem exatamente a mesma consulta O(1), nunca uma varredura que cresce com o número de tenants.
- **Cache com invalidação correta:** `invalidateCompanyBrandCaches` invalida só as chaves da empresa editada (por `slug` e por `domain`, quando existir) — editar a marca de uma empresa nunca precisa (nem consegue) invalidar o cache de outra.
- **Assets Inteligentes:** `/api/brand/{icon,og,manifest}` resolvem por Host a cada requisição, sem pré-gerar ou enumerar empresas — o custo por requisição é o mesmo com 1 ou 5.000 empresas cadastradas.
- **Impressão:** cada PDF é gerado sob demanda para um cartão específico, nunca um job em lote que precisaria escalar com o número de empresas.
- **Limite reconhecido, não escondido:** branding é por `Company`, não por `Organization` — uma franquia com 500 unidades sob uma organização não tem hoje um botão "aplicar esta marca a todas as 500 de uma vez" pela UI. O caminho natural, se um dia for pedido, é a API Pública da Fase 9 (`PATCH` da mesma marca em N empresas via um script) — não construído agora porque não foi pedido explicitamente (ver ADR-042).

**Veredito honesto:** a arquitetura escala por construção (consultas indexadas, cache por chave específica, nada que enumera tenants) — o que não escala ainda é a *operação* de configurar 500 marcas de uma vez pela interface, um problema de produto/fluxo, não de arquitetura de dados.

## Platform First Review (continua a partir da Fase 9)

- Nenhuma rota `/api/v1/**` foi alterada nesta fase — White Label é inteiramente uma superfície de dashboard/páginas públicas, não uma mudança de contrato de API.
- Os cinco novos campos de `Company` (`secondaryColor`, `domainVerifiedAt`, `domainVerificationToken`, `loginHeadline`, `loginBackgroundUrl`) seguem exatamente o padrão já estabelecido pela API v1: se um dia forem expostos via `/api/v1/organizations`, entram no mesmo Zod schema `updateCompanySchema` já compartilhado internamente (`src/lib/validations/company.ts`), sem uma segunda forma de validar o mesmo dado.
- Nenhuma dívida de contrato público foi introduzida: os novos endpoints internos (`/api/company/domain`, `/api/company/domain/verify`, `/api/company/branding/preview`) vivem deliberadamente fora de `/api/v1/**` — são operações de dashboard autenticado por sessão, não pensadas para uma integração de terceiro ainda.

## Luxury UX (nova regra permanente de engenharia, primeira fase em que se aplica)

**A régua declarada: "software de empresa de bilhões de dólares" — Stripe, Linear, Vercel, Notion, Figma, Framer como referência.**

- **Preview ao vivo sem salvar:** o Theme Studio reflete qualquer mudança de cor/logo instantaneamente em quatro superfícies (dashboard, login, QR, mockups físicos) antes de qualquer persistência — o tipo de feedback imediato que Figma/Framer tornaram esperado, não um "Salvar e recarregar para ver."
- **Brand Motion System:** glow/hover/ripple derivados automaticamente da cor de marca via `color-mix` — uma microinteração que nunca precisa de configuração manual por empresa, e que respeita `prefers-reduced-motion` (contido, não excessivo, por instrução explícita da regra).
- **QR/impressão sempre corretos:** o comerciante nunca vê um QR ilegível por escolha de cor — o contraste é garantido antes de a cor chegar à tela, não depois de um erro.
- **Distintivo de marca em vez de ícone genérico:** quando uma empresa ainda não subiu logo/favicon, o produto gera um distintivo com a inicial do nome sobre a cor de marca (favicon, OG, mockups) — nunca um placeholder cinza sem identidade, mesmo no primeiro minuto de uso.
- **Restrito, não excessivo:** nenhuma animação nova roda sem `prefers-reduced-motion` sendo respeitado; nenhuma tela ganhou um efeito visual que não estivesse diretamente a serviço de "mostrar a marca com clareza."

## Reliability Review

1. **Essa funcionalidade continua funcionando sob alta carga?** Sim — `DomainResolver` é uma consulta indexada cacheada (TTL 120s), não uma varredura; o custo por requisição não cresce com o número de tenants (ver Franchise First Review acima).
2. **Existe algum ponto único de falha?** Não introduzido por esta fase. A resolução de domínio depende do mesmo Postgres/Redis de sempre, com a mesma degradação já estabelecida: sem Redis, `cachedOrLoad` simplesmente recalcula a cada chamada (mais lento, nunca quebrado).
3. **O redirecionamento público continua protegido?** Sim, inalterado — `/r/[code]` não foi tocado nesta fase; White Label não introduz nenhuma nova superfície pública de redirecionamento.
4. **Existe degradação graciosa quando Redis/filas/serviços externos falham?** Sim — a verificação de domínio (Cloudflare DNS-over-HTTPS) é uma chamada externa opcional: uma falha nela deixa `domainVerifiedAt` como estava (nunca marca um domínio como verificado por engano), e o produto inteiro continua funcionando pelo subdomínio gratuito enquanto isso.
5. **Os eventos podem ser recuperados sem perda importante?** Não se aplica diretamente — esta fase não introduz eventos novos no Event Bus. O rascunho do Theme Studio não persistido (draft local) é intencionalmente perdível até "Salvar", nunca uma perda inesperada de dado já confirmado.
6. **A observabilidade permite descobrir rapidamente onde um problema começou?** Sim — as rotas de domínio/branding seguem o mesmo padrão de log estruturado já estabelecido; o CSP em `report-only` (ADR-045) é, em si, uma nova fonte de observabilidade que não existia antes desta fase.

## Revenue Review

1. **Essa funcionalidade aumenta a percepção de valor da assinatura?** Sim, de forma direta e forte — White Label é classicamente um recurso de tier superior ("Enterprise"/"Franquia") em praticamente todo SaaS B2B; uma rede que já paga pelo produto ganha um motivo concreto para subir de plano só para ter domínio próprio.
2. **O empresário entenderia quanto dinheiro isso pode gerar ou economizar?** Sim, mais do que a maioria das fases anteriores: "seus clientes nunca veem a marca NFC OS, só a sua" é uma frase que um dono de rede entende sem explicação técnica.
3. **Existe algum insight que justifique renovar o plano mensal?** Sim — ver o domínio próprio funcionando, o favicon da própria empresa no navegador, é um lembrete visual recorrente (toda vez que o gerente abre o dashboard) do investimento feito, diferente de um recurso que só aparece em um relatório mensal.
4. **Existe algum recurso digno de aparecer na página de vendas?** Sim, um dos mais fortes até agora: "sua marca, seu domínio, seus cartões — o cliente nunca sabe que existe um NFC OS por trás" é a frase de vendas central de um plano Enterprise/Franquia.
5. **Existe alguma oportunidade de transformar dados em recomendação automática?** Não desta fase — branding é configuração declarada pelo próprio empresário, não um dado que o produto poderia inferir ou recomendar automaticamente.

## Demo First Review

1. **Essa funcionalidade impressionaria um investidor em uma demonstração de 2 minutos?** Sim, fortemente — arrastar o seletor de cor no Theme Studio e ver login/dashboard/QR/mockup físico mudarem juntos, ao vivo, é o tipo de momento que vende "plataforma" em vez de "produto."
2. **Um dono de restaurante entenderia o valor em menos de 30 segundos?** Sim — diferente da Fase 9 (voltada ao desenvolvedor), esta fase é para o próprio empresário: "isso aqui vira a cara da sua marca" não precisa de nenhuma explicação técnica.
3. **Existe um momento "uau" claramente perceptível?** O preview simultâneo de 4 superfícies (dashboard/login/QR/mockups físicos) reagindo à mesma mudança de cor em tempo real, sem precisar salvar — ver seção WOW Factor abaixo.
4. **O comportamento parece software premium ou apenas funcional?** Premium — o Theme Studio segue a mesma inspiração declarada (Figma) com preview lateral fixo, abas organizadas, e nenhuma tela de "configuração de admin" crua.
5. **Existe uma animação/transição que comunique melhor o estado sem prejudicar performance?** O botão "Salvar" usa `BrandRipple`, e os três mockups principais (dashboard/login/QR) têm `.brand-glow` — motion contido, não decorativo por decoração.

## Product Review

1. **A experiência parece um produto premium, ou apenas uma tela de admin?** Premium — o Theme Studio é a tela mais visualmente rica do produto até agora, com preview ao vivo como núcleo da experiência, não um formulário com um botão "Salvar" no final.
2. **Existe algum atrito desnecessário?** Evitado deliberadamente: reivindicar um domínio pede só o hostname; a verificação mostra o registro TXT exato a copiar, sem forçar o usuário a ler documentação de DNS em outro lugar.
3. **A interface exige mais cliques do que precisa?** Não — trocar uma cor é um clique no seletor, com o preview reagindo antes de qualquer confirmação adicional.
4. **Forma mais intuitiva de fazer a mesma tarefa?** O `settings-form.tsx` teve `logoUrl`/`primaryColor` removidos e substituídos por um único link para `/dashboard/branding` — uma tarefa, um lugar, nunca duas telas editando o mesmo campo (ver ADR-040).
5. **Um gerente de restaurante aprenderia isso em menos de 2 minutos?** Sim — as 4 abas (Identidade/Login/Domínio/Impressão) seguem uma ordem que seria a ordem natural de perguntas de quem está configurando pela primeira vez.
6. **Oportunidade de "uau" que não custa nada?** O distintivo de inicial-sobre-cor gerado automaticamente quando não há logo — a primeira impressão do produto (favicon, OG) já parece "pensada para a empresa," mesmo antes de qualquer upload.

## Achados do Architect Review (corrigidos proativamente, não pedidos) — incluindo Zero Dívida Silenciosa

1. **O achado técnico mais significativo desta fase, corrigido em tempo real contra um erro de build de verdade:** a primeira versão do `DomainResolver` seguia o pedido original ao pé da letra — chamado de dentro de `middleware.ts`, "antes do resto do sistema carregar." `npm run build` falhou de verdade: `UnhandledSchemeError` tentando importar `node:crypto`/`node:fs`/`node:path` através do cliente do Prisma, porque o Middleware deste Next.js roda exclusivamente em Edge Runtime, que não sustenta essas APIs de Node. Verificado por inspeção direta do tipo instalado (`node_modules/next/dist/build/segment-config/middleware/middleware-config.d.ts`, sem campo `runtime`) antes de aceitar o limite como real, não hipotético. Corrigido movendo `resolveBrandByHost` para dentro das páginas `/sign-in`/`/sign-up` (Server Components, runtime Node) — documentado em **ADR-042**.
2. **Encontrado sob Zero Dívida Silenciosa, corrigido no schema, não escondido:** o pedido original de "temas claro e escuro" para a identidade de marca esbarrou num fato pré-existente do produto — nenhuma fase anterior jamais ligou dark mode de verdade (`ThemeProvider` sempre com `forcedTheme="light"`; o bloco `.dark` em `globals.css` existe desde a Fase 4.5/ADR-023 mas nunca é aplicado a nenhuma tela). Em vez de fingir uma tela escura que não pode ser vista em lugar nenhum do produto, ou silenciosamente ignorar a frase do pedido, o achado foi investigado, o `BrandProvider` foi desenhado para já ser agnóstico a tema (funcionaria sob escuro se um dia for religado), e o limite foi registrado explicitamente em **ADR-047**, no `ROADMAP.md` e nos riscos abaixo.
3. **Encontrado e corrigido antes de construir Theme Studio:** `settings-form.tsx` já tinha `logoUrl`/`primaryColor` editáveis, mais um campo de domínio permanentemente desabilitado ("Em breve"). Construir o Theme Studio como uma segunda tela paralela editando os mesmos campos criaria exatamente a duplicação de superfície que o Platform First Review (Fase 9) existe para caçar — mesmo sendo uma tela de dashboard, não uma API. Corrigido removendo os campos de `settings-form.tsx`, substituídos por um link para `/dashboard/branding` (ver ADR-040).
4. **Vazamento entre tenants — verificado, não encontrado:** `resolveBrandByHost` só resolve um domínio customizado quando `domainVerifiedAt` está preenchido — um domínio reivindicado mas não comprovado nunca entrega a marca de uma empresa para o Host de outra pessoa. `claimDomain`/`removeDomain` operam exclusivamente sobre `companyId` do `AuthContext`, nunca aceito como parâmetro de entrada.
5. **Cache com invalidação correta, testada por leitura de código:** `invalidateCompanyBrandCaches` é chamado de dentro de `updateCompany`, `claimDomain`, `removeDomain` e `verifyDomainOwnership` — todo caminho que muda um dado lido pelo `DomainResolver` invalida a chave certa (por `slug` e, quando existir, por `domain` anterior E novo, para não deixar uma entrada de cache órfã apontando para o domínio antigo).
6. **Performance:** nenhuma consulta N+1 nova — `resolveBrandByHost` faz uma única consulta `findFirst`/`findUnique` (`BRAND_SELECT`, projeção mínima de colunas) por Host não cacheado; os Route Handlers de Assets Inteligentes reaproveitam essa mesma função, nunca uma segunda consulta.
7. **Compatibilidade com toda fase anterior:** `AppSidebar` não foi tocado (continua recebendo `logoUrl` por prop); nenhuma rota `/api/v1/**` da Fase 9 foi alterada; o Resolution Engine da Fase 1 (`cachedOrLoad`) foi reaproveitado, não duplicado.

## WOW Factor Review

**"O que faria alguém dizer 'nunca vi um SaaS fazer isso'?"** O Theme Studio mudando 4 superfícies simultaneamente (dashboard, login, QR, mockup físico de mesa/cartão) em tempo real, ao arrastar um único seletor de cor, sem precisar salvar primeiro — a maioria dos produtos com "personalização de marca" mostra um formulário e pede para o usuário navegar até outra tela para ver o resultado. Ver a aba "Preview" do Theme Studio reagindo instantaneamente em `dashboard/branding`.

**Melhoria de alto impacto implementada sem gerar dívida técnica:** o Brand Motion System (`.brand-glow`/`.brand-hover`/`.brand-ripple`) deriva automaticamente de `color-mix(var(--brand-primary), ...)` com um fallback explícito para a cor padrão do produto (`var(--brand-primary, var(--brand)))`) — funciona corretamente tanto dentro quanto fora de um `BrandProvider`, sem exigir que nenhum componente futuro saiba se está ou não dentro de um contexto de marca.

## Como isso foi verificado (não só compilado)

Todos os quatro quality gates (`tsc --noEmit`, `eslint .`, `prisma validate`, `npm run build` com um `.env.local` temporário completo) passam limpos — incluindo as ~15 rotas/páginas novas desta fase no build de produção, com o `middleware.ts`/`layout.tsx` já restaurados ao estado real (Clerk + matcher completos), não no estado reduzido usado durante a verificação interativa abaixo.

**Sem Postgres/Redis/Clerk reais neste sandbox** (mesma limitação de toda fase anterior). Verificação interativa usou o mesmo padrão já estabelecido: `src/middleware.ts` temporariamente reduzido a um matcher vazio e `<ClerkProvider>` temporariamente removido de `src/app/layout.tsx`, ambos restaurados exatamente ao original depois — confirmado por leitura direta dos arquivos após a restauração.

Confirmado via inspeção real de DOM/rede/logs de servidor (não apenas "o texto certo apareceu"):
- **`/api/brand/icon` (domínio raiz, sem empresa resolvível):** `200 OK` confirmado via `read_network_requests`; a aba do navegador mostrou "icon (32×32)" e a imagem renderizada foi o distintivo de inicial ("N") sobre a cor padrão do produto — prova de que a rota funciona mesmo com zero linha em `Company` alcançável, porque `classifyHost` retorna `{kind:"root"}` antes de qualquer chamada ao Prisma.
- **`/api/brand/og`:** mesma prova, com a imagem 1200×630 correta (aba "og (1200×630)"), confirmada visualmente via screenshot.
- **`/api/brand/manifest`:** JSON válido confirmado via `get_page_text` — `name`, `short_name`, `theme_color`, `background_color` e os dois ícones (`192`/`512`) todos presentes com os valores de fallback corretos.
- **`/dashboard/branding`:** `500 Internal Server Error`, confirmado idêntico em causa raiz a `/dashboard/developers` (Fase 9) via inspeção direta do log do servidor — ambos falham em `getAuthContext`/`requireAuthContext` com o mesmo erro do Clerk ("`auth()` foi chamado, mas o Clerk não detecta `clerkMiddleware()`"), porque o harness esvazia o matcher do middleware de propósito para este teste. Mesma classe de limitação de todo `/dashboard/*` desde a Fase 1 (exige Clerk + Postgres reais simultaneamente) — não uma regressão desta fase.
- **`/sign-in`:** falha confirmada via console do navegador e log do servidor, com a causa raiz exata capturada: `useSession can only be used within the <ClerkProvider />` — o erro nasce dentro do próprio componente `<SignIn>` do Clerk (stack trace confirma: `useEnforceCorrectRoutingProps` → `useSession` → `SignIn`), nunca dentro de `resolveBrandByHost` ou `BrandedAuthScreen`. Ou seja: o código desta fase (resolução de marca + moldura decorativa) rodou até o fim sem erro — a falha é inteiramente a remoção deliberada do `<ClerkProvider>` para este teste, não um bug do White Label.

**O que não pôde ser provado neste sandbox:** um domínio customizado real apontado e verificado de ponta a ponta (exigiria um domínio de verdade e um registro DNS real); o Theme Studio interativo com upload de logo/preview ao vivo (exige a mesma sessão Clerk + Postgres real de todo `/dashboard/*`); um PDF de impressão baixado e aberto de fato (verificado por leitura de código + build limpo, não por abrir o arquivo); o CSP `report-only` recebendo uma violação real de um navegador de produção; e a fila de e-mails/CNAME/SSL do domínio customizado, que dependem inteiramente de infraestrutura de hospedagem fora deste ambiente.

## Migração

Cinco campos aditivos novos em `Company` (`secondaryColor`, `domainVerifiedAt`, `domainVerificationToken`, `loginHeadline`, `loginBackgroundUrl`) — todos nulos até uso, zero backfill necessário, mesma convenção de toda coluna aditiva deste produto desde a Fase 1. Nenhum modelo novo, nenhuma coluna removida. Sem histórico em `prisma/migrations/` ainda (mesma restrição de toda fase anterior — ver o aviso de baseline no plano original da Fase 1).

## Riscos carregados adiante

- "Temas claro e escuro" não foi cumprido integralmente — o produto nunca teve dark mode de verdade ligado; o cálculo de cor do `BrandProvider` já é agnóstico a tema, mas nenhuma tela escura foi construída ou verificada (ver ADR-047).
- Branding é por `Company`, não por `Organization` — uma franquia de 500 unidades não tem hoje um jeito de compartilhar UMA marca entre várias empresas pela UI (ver ADR-042).
- Verificação de domínio confirma posse via DNS TXT, mas CNAME e SSL continuam manuais, do lado da hospedagem (ver ADR-042).
- Mockups físicos são ilustrações 2D em CSS, nunca renders 3D fotorrealistas (ver ADR-044).
- QR/impressão não compõem um logo dentro do próprio QR — o logo aparece ao lado, nunca sobreposto (sem `sharp`/`canvas` instalado).
- O primeiro CSP do produto está em modo `report-only` — não bloqueia nada ainda (ver ADR-045).
- HSTS está ligado sem o flag `preload`, que exige submissão manual contra o domínio real de produção.
- Nenhuma linha de código de IA existe neste produto — a preparação da Fase 10 para as Fases 11/13 reconheceu a API v1/SDK existente como interface suficiente, não escreveu nenhuma chamada a um modelo (ver ADR-046).
- `/dashboard/branding` e `/sign-in`/`/sign-up` não são verificáveis interativamente de ponta a ponta neste sandbox (exigem Clerk + Postgres reais) — mesma limitação de todo `/dashboard/*` e das telas de auth desde fases anteriores, não uma regressão desta fase.

## Próximos passos

Aguardando aprovação para iniciar a **Fase 11 — Smart Campaign Playbooks**, cuja preparação arquitetural (não implementação) já está registrada em ADR-046.
