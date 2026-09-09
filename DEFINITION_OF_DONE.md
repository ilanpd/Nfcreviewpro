# Definition of Done — NFC OS

Este documento define, de forma objetiva e verificável, quando uma funcionalidade — e quando o produto como um todo — pode ser chamada de **Production Ready**. Não é uma lista de intenções: cada critério abaixo tem uma forma concreta de ser checado, e nenhum item pode ser marcado como atendido só porque "o código existe" ou "parece certo na leitura". Ver `feedback_review_gates.md` (memória) e `RELATORIO_GATE_FINAL.md` para o histórico de achados que motivou cada critério — vários deles vieram de bugs reais encontrados durante testes ao vivo, não de suposições.

---

## Definition of Done por funcionalidade

Uma funcionalidade só é **DONE** quando **todos** os itens abaixo são verdadeiros. Um item não verificado conta como não atendido, nunca como "provavelmente ok".

| # | Critério | Como se verifica (não como se declara) |
|---|---|---|
| 1 | Implementada | O caminho feliz funciona de ponta a ponta, clicado/chamado de verdade — não só compila |
| 2 | Conectada ao resto do sistema | A ação gera efeito real no banco/cache/fila, visível em outra parte do produto (ex.: uma campanha aplicada aparece no Analytics), não só na tela onde foi criada |
| 3 | Funciona no ambiente real | Testada contra Staging ou Produção implantados na Vercel — nunca só `npm run dev` local. (O bug do PDF em `RELATORIO_GATE_FINAL.md` só existia no deploy real — é exatamente o tipo de coisa que este critério existe para pegar) |
| 4 | Caminho de erro testado | Uma chamada inválida/malformada/proibida foi feita de propósito e a resposta foi observada (não presumida) |
| 5 | Loading testado | O estado de carregamento foi visto na tela, não só existe no código |
| 6 | Empty state testado | A tela foi aberta com zero dados de verdade (não simulado) e o texto/CTA faz sentido |
| 7 | Permissões testadas | Pelo menos um papel COM a permissão e um papel SEM a permissão tentaram a ação de verdade — na API e na UI, separadamente (ocultar botão não é o mesmo que a API recusar) |
| 8 | Isolamento entre tenants testado | Uma tentativa real de acessar/alterar o recurso a partir de outra empresa foi feita e bloqueada |
| 9 | Mobile testado | Aberto em viewport mobile real (375px), não só "deveria ser responsivo" |
| 10 | API testada (quando aplicável) | Se exposta via API pública v1, testada com escopo correto, escopo insuficiente, e sem autenticação |
| 11 | Persistência confirmada | Dado sobrevive a um F5 real da página, não só ao estado do React |
| 12 | Regressão executada | `tsc`/`eslint`/`prisma validate`/build rodados depois da mudança, e pelo menos um fluxo adjacente reconfirmado manualmente |
| 13 | UX revisada | Texto, rótulos e mensagens consistentes com o resto do produto (mesma palavra para o mesmo conceito, mesmo padrão de confirmação para ações destrutivas) |
| 14 | Sem bug conhecido crítico | Nenhum item 🔴 aberto no relatório de auditoria para esta funcionalidade |
| 15 | Não é um stub disfarçado | Se algo está incompleto de propósito (ex.: COUPON/AI_MENU), isso é visível para quem usa — nunca parece pronto sem estar |
| 16 | Validado em Produção quando aplicável | Para funcionalidades que dependem de infraestrutura que só existe em Produção (Redis real, domínio), confirmado lá de forma não-destrutiva |

---

## Definition of Done do produto como um todo

O NFC OS só pode ser chamado de **Production Ready** quando a resposta a esta pergunta for sim, com evidência, não opinião:

> "Uma pessoa que nunca viu o código consegue entrar no NFC OS, criar uma conta, configurar sua empresa, cadastrar sua operação, criar cartões/campanhas/regras, configurar NFC/QR, gerar tráfego, visualizar os resultados, utilizar Analytics/Heatmap/Playbooks, administrar usuários, utilizar API/Webhooks, personalizar sua marca e navegar pelo sistema inteiro sem encontrar funcionalidades quebradas, inconsistências relevantes ou telas com aparência de produto inacabado?"

Critérios agregados:

- [ ] Todo item da tabela acima atendido para: Cadastro, Onboarding, Cartões, Campanhas/Regras/A-B, Table Map, Analytics, Heatmap, Playbooks/AutoPilot, Equipe/RBAC, Branding, API Pública, Webhooks.
- [ ] Zero bugs 🔴 conhecidos e não corrigidos no fluxo principal.
- [ ] Toda limitação arquitetural classificada (A/B/C/D — ver seção 8 do `RELATORIO_GATE_FINAL.md`) e, se A, corrigida antes de fechar este documento.
- [ ] Auditoria página-a-página das 26 páginas concluída, com resultado por página registrado em `ROTAS_AUDITADAS.md`.
- [ ] Passagem de UX/UI dedicada concluída — nenhuma tela avaliada como "parece MVP" sem correção ou justificativa registrada.
- [ ] Regressão integrada final executada com múltiplos papéis (Owner, Manager, Read Only), múltiplos tenants, desktop e mobile — sem quebra cruzada entre correções.
- [ ] Nenhuma funcionalidade apresentada como pronta que na verdade seja stub — verificado por varredura de código E confirmado ao vivo.

## Legenda de status usada nos relatórios de ciclo

- 🟢 Confirmado — testado ao vivo, funcionando.
- 🟡 Limitação/pendência conhecida — documentada, com plano ou classificação (A/B/C/D).
- 🔴 Problema encontrado — bug real, precisa de correção antes de fechar o ciclo.
- ⚪ Não testado — nem confirmado nem refutado; nunca deve ser lido como "provavelmente ok".

## Como este documento é usado

A cada ciclo de auditoria (`Auditar → Encontrar → Corrigir → Testar → Refinar → Regressão → Auditar novamente`), o relatório de ciclo em `RELATORIO_GATE_FINAL.md` referencia os números desta tabela ao declarar uma funcionalidade DONE. Este documento em si só muda quando o próprio critério de "pronto" mudar — não é reescrito a cada ciclo.
