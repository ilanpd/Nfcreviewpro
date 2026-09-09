# Manifesto de Design — NFC OS

Este documento não é sobre estética. É sobre o que impede um produto de virar uma colcha de retalhos depois de 10, 20 ou 50 telas — o tipo de disciplina que Stripe, Linear, Vercel e a Apple usam para que um produto continue parecendo desenhado por uma única mente, mesmo quando é construído por muitas mãos, ao longo de muitas fases, por muito tempo.

Nasceu na Fase 4.5, junto com o NFC OS Design Language, mas não é sobre aquela fase — é permanente. Toda fase futura que toque em interface deve conseguir responder "isto respeita o manifesto?" antes de ser considerada concluída, exatamente como já responde ao Architect Review e ao Product Review.

---

## Os princípios

### 1. Uma ação principal por tela

Toda tela tem uma coisa que ela quer que você faça. Se há duas, uma delas está roubando atenção da outra — e se há três, a tela está fazendo o trabalho de três telas. Botões secundários existem; botões *igualmente* primários não deveriam. Quando uma tela cresce e ganha uma segunda responsabilidade real (não um atalho, uma responsabilidade), a resposta certa quase sempre é duas telas, não um botão maior ao lado do outro.

*Onde isso já aparece:* o Mapa de Mesas (Fase 5) tem uma ação central — atribuir uma campanha a algo — e tudo mais (zoom, seleção, renomear) é ferramenta a serviço dela, não uma segunda ação competindo por atenção.

### 2. Toda animação comunica estado

Uma animação que existe só porque "fica bonito" é ruído. Uma animação existe para responder uma pergunta que o usuário acabou de fazer sem palavras: *isso vai funcionar se eu soltar aqui?* (Ghost Mode), *isso realmente aconteceu?* (o pulso de confirmação), *o que mudou desde a última vez que olhei?* (a barra de progresso animada, o `SmartBadge` que pulsa só quando algo está genuinamente ao vivo agora). Se remover a animação não muda o que a pessoa entende da tela, a animação era decoração — e decoração é a primeira coisa a cortar quando `prefers-reduced-motion` está ligado, o que este produto já respeita automaticamente em todo o sistema de motion, não tela por tela.

### 3. Nenhum modal sem motivo

Um modal interrompe. Interromper é caro — custa o contexto que a pessoa tinha antes de você abrir o modal. Isso só vale a pena quando a ação é destrutiva o suficiente para merecer uma pausa forçada (excluir algo), quando o formulário é curto o suficiente para não precisar de uma tela própria, ou quando sair do fluxo atual quebraria algo que a pessoa estava fazendo. Fora isso: um Drawer (que preserva a tela de fundo visível), um Popover (que nem interrompe, só complementa), ou simplesmente mais uma seção na própria tela. O `PremiumModal`/`PremiumDrawer`/`PremiumPopover` do NFC OS Design Language existem justamente para deixar essa escolha visível e deliberada, não para incentivar modais — a API mais fácil de usar não deveria ser a mais interruptiva.

### 4. No máximo 3 níveis de profundidade visual

Fundo, superfície, e destaque. Se uma tela precisa de um quarto nível para se explicar, ela não precisa de mais profundidade — precisa ser reorganizada. `PremiumCardShell` é a *única* superfície de card do produto por esse motivo: uma tela cheia de cards dentro de cards dentro de cards já perdeu a discussão sobre hierarquia antes mesmo de o usuário chegar nela. Sombra, cor e tamanho de fonte comunicam hierarquia — usar as três ao mesmo tempo, no mesmo elemento, normalmente significa que nenhuma das três está fazendo o trabalho sozinha.

### 5. Menos cliques sempre vence

Entre uma solução "correta" que leva 4 cliques e uma solução "esperta" que leva 1, a esperta vence — contanto que continue sendo óbvia o suficiente para um gerente de restaurante aprender em menos de 2 minutos sem ajuda (a mesma régua do Product Review). É por isso que o Mapa de Mesas assume campanha-por-arrastar em vez de um formulário, que o `CommandPalette` existe (Cmd+K é sempre menos cliques que navegar pelo menu), e que o fluxo de "armar e clicar" para posicionar uma mesa nova foi escolhido em vez de um formulário de coordenadas X/Y. Quando "menos cliques" e "mais óbvio" empatam, óbvio vence — um produto rápido que ninguém entende de primeira não é rápido, é confuso.

### 6. Consistência antes de originalidade por tela

Nenhuma tela inventa seu próprio card, seu próprio badge de status ou sua própria animação de hover. Existe um `PremiumCardShell`, um `SmartBadge`, um `hoverLift` — e toda tela nova reaproveita, não recria. Isso significa que uma pessoa que aprendeu a usar uma tela do NFC OS já sabe, por reconhecimento visual, como qualquer outra tela vai se comportar, mesmo antes de ter visto aquela tela específica. Originalidade que importa vai para o produto como um todo (o Ghost Mode, o Mapa de Mesas, a cor de marca) — não para reinventar o que um card deveria parecer a cada nova feature.

### 7. Todo estado vazio é uma oportunidade, não uma desculpa

"Nenhum dado encontrado" é uma frase que admite derrota. Um estado vazio bem-feito diz o que fazer a seguir — por isso o `EmptyState` do Design Language sempre carrega um ícone, um título específico do contexto (não um genérico "vazio") e, quando faz sentido, uma ação direta. Uma tela vazia é a primeira impressão de metade das funcionalidades deste produto na vida de um cliente novo — tratá-la como um detalhe é desperdiçar a primeira impressão.

### 8. Cor tem significado, nunca é decoração

Toda cor fora da paleta neutra (cinza) no NFC OS significa alguma coisa específica: a cor de marca significa ação/marca; verde significa ativo/sucesso; âmbar significa atenção/pendente; vermelho significa risco/conflito. A cor de um tipo de campanha no Mapa de Mesas não é escolhida por gosto — é a mesma cor em `DESTINATION_META`, no badge, no Ghost Mode e no card, sempre. Se duas cores diferentes aparecerem para o mesmo conceito em duas telas diferentes, isso é um bug de design, não uma escolha de estilo — e deveria ser corrigido com a mesma seriedade que um bug de código.

---

## Como este documento se usa

Não é uma lista de regras para citar em um code review de forma performática. É um filtro rápido para decisões reais:

- Está prestes a adicionar um segundo botão do mesmo peso visual numa tela? Volte ao princípio 1.
- Está prestes a adicionar uma animação "porque ficaria legal"? Volte ao princípio 2.
- Está prestes a abrir um modal para um formulário de duas linhas? Volte ao princípio 3.
- Está prestes a criar um novo componente de card em vez de reaproveitar `PremiumCardShell`? Volte ao princípio 6.

Quando um princípio e um pedido explícito do usuário entrarem em conflito genuíno (não uma leitura apressada, um conflito real), o pedido do usuário vence — este manifesto documenta o padrão que o próprio usuário pediu para instituir, não uma autoridade acima dele. Mas o objetivo declarado é justamente evitar que essas exceções se acumulem silenciosamente até o produto virar, de novo, "uma colcha de retalhos" — então toda exceção deliberada merece uma linha de ADR explicando por quê, do mesmo jeito que qualquer outra decisão de arquitetura.
