# Manual de logística das placas

Como uma placa física (acrílico + chip NFC + QR) vai da gráfica até o cliente, nas três situações de venda. Tudo se faz no painel admin, em **Estoque de placas** (`/admin/estoque`). Decisões de arquitetura: ADR-092.

## O ciclo de uma placa

```
Gerada → Em produção → Em estoque → Com cliente
                 ↘ Defeituosa / Anulada (saem de circulação; dá para restaurar)
```

- **Gerada:** o sistema reservou a série e o código. Ainda não saiu para a gráfica.
- **Em produção:** o lote foi enviado à gráfica (ou chegou e ainda não foi conferido).
- **Em estoque:** conferida (NFC, QR e série batem) e sem dono. Pronta para vender.
- **Com cliente:** ligada a um cartão de um cliente.

Cada placa tem **série** (`L001-07`, impressa nela) e **código** (as letras da URL, escondidas no chip e no QR). Série é para você; código é para a máquina.

## Primeiro lote, passo a passo

1. **Modelo** (`Estoque → Modelos → Novo modelo`). Defina o nome e o estoque mínimo.
2. **Arte.** No editor do modelo, envie a arte de fundo (PNG ou JPG, **sem o QR**, até 3,5 MB; prefira JPG). Para 10×10 cm com 3 mm de sangria, a página é 106×106 mm e, em 300 dpi, 1252×1252 px. Deixe um painel **branco chapado** onde o QR vai entrar. Clique em **Encaixar no painel branco da arte**: o sistema acha o painel e enquadra o QR dentro dele. Para ajustar à mão, arraste o QR e a série (ou use as setas do teclado); para mudar o **tamanho** do QR, arraste a **alça azul** do canto dele, use os botões **−** e **+**, ou as teclas **+** e **−** com o QR selecionado.
3. **Prova.** Clique em "Prova em PDF" e confira como a gráfica vai receber. Os avisos do editor (QR pequeno, poucos dpi, arte esticada) aparecem antes de você salvar.
4. **Lote** (`Estoque → Lotes → Novo lote`). Escolha o modelo e a quantidade (ex.: 20).
5. **Arquivos.** Na página do lote, baixe os três e mande **juntos** para a gráfica:
   - **Arte (PDF):** uma página por placa, com o QR e a série de cada uma.
   - **Ficha de produção (PDF):** especificação, o que fazer e a lista por série.
   - **Manifesto (CSV):** série, código e URL para gravar em cada chip.
6. **Enviado.** Clique em "Marcar como enviado à gráfica".
7. **Recebido.** Quando o pacote chegar, "Marcar como recebido".
8. **Conferir** (`Conferir lote`, no celular, com as placas na mão). Para cada placa:
   1. Encoste o celular: tem que abrir uma página com a série. Marque **NFC**.
   2. Escaneie o QR: tem que abrir a página com a **mesma** série. Marque **QR**.
   3. Compare com o número impresso na placa. Marque **Série**.
   Com as três marcas, a placa entra no estoque. Se o NFC ou o QR abrir a série de **outra** placa, é o erro mais caro: marque a placa como defeituosa e avise a gráfica.

## Vendas

### A) Loja abordada, com a placa na mão

1. Demonstre encostando o celular numa placa de demonstração.
2. Receba o pagamento (PIX, maquininha). Isso fica fora do sistema.
3. `Pedidos → Registrar venda direta`. Preencha nome, e-mail, CPF/CNPJ, telefone e o link de destino (por exemplo, o link de avaliação do Google da loja).
4. Em **Placa física**, escolha **Informar o nº da placa** e digite a série que está na placa (`L001-07`), ou **Do estoque (automático)** para pegar a mais antiga conferida.
5. Mande o link `/meu-cartao` que aparece para o cliente. Teste encostando o celular **antes de deixar a placa**: tem que abrir o destino da loja.

> Confirme o e-mail em voz alta. Se o cliente assinar o Starter depois com o **mesmo e-mail**, a placa e o histórico vêm junto. Com outro e-mail, nasce uma empresa nova.

### B) Venda sem placa em estoque

Registre a venda direta com **Sem placa do estoque**. O cartão nasce com um código próprio. Depois, no **próximo lote**, use **Novo lote → Para pedidos pagos**: cada cartão desses pedidos ganha uma placa que já nasce com o código dele (nada muda para o cliente). Quando a placa chegar e for conferida, entregue.

### C) Compra online (só o cartão) ou com plano (Starter + cartão)

Pagamento → o sistema cria o pedido e o cartão sozinho. Depois:

- **Tem placa em estoque:** no detalhe do pedido (`Pedidos`), clique em **Atribuir placa do estoque**, automático ou por número. Siga o quadro (separação, embalagem, expedição, entregue).
- **Não tem:** junte os pedidos pagos num **lote para pedidos pagos** e siga o fluxo do lote.

Se o cliente já tem painel (`CUSTOMER`) e o código do cartão vai mudar, o sistema pede confirmação: ele pode ter baixado o QR antigo. Por isso, para clientes com plano, prefira o **lote para pedidos pagos**, que não troca código.

## Quando algo dá errado

| Situação | O que fazer |
|---|---|
| Placa chegou com defeito (NFC não lê, QR borrado) | Na conferência, **Defeituosa** com o motivo. A gráfica reimprime só essa: na tabela do lote, selecione a placa e use **Reimprimir só estas (PDF)**. |
| Placa já está com um cliente e precisa trocar | Abra a placa (`Estoque → Placas`), **Trocar placa**, escolha a nova. A antiga vira defeituosa, e o cartão do cliente passa a usar a nova. |
| Atribuí a placa errada | Abra a placa, **Devolver ao estoque**. O cartão ganha um código novo. |
| Lote parado na gráfica | O radar do Centro de Operações avisa a partir de 10 dias sem recebimento. |
| Lote recebido e não conferido | O radar avisa a partir de 2 dias. |
| Estoque baixo | Defina o **estoque mínimo** no modelo. O painel avisa quando as conferidas ficam abaixo (e não repete o aviso se o lote a caminho já cobre). |
| Placa que ninguém vendeu abre "ainda não ativada" | É o esperado: ela não tem dono. |
| Placa defeituosa aberta pelo cliente | Mostra "Placa fora de uso". |

## Quem faz o quê

| Fornecedor | Você | Sistema |
|---|---|---|
| Imprime a arte, cola o chip, grava a URL de cada chip pelo manifesto, **trava a escrita** | Define o modelo e a arte, aprova a prova | Gera séries, códigos e os 3 arquivos |
| Entrega com a lista por série | Marca enviado/recebido, confere cada placa | Mostra a série na tela da placa (a prova) |
| Teste básico de leitura | Vende e atribui a placa | Liga placa a cartão, registra tudo no histórico |

## Cuidados que valem para tudo

- **A URL gravada no chip e impressa no QR é permanente.** Hoje o endereço do cartão ainda é provisório (`*.vercel.app`). O painel mostra esse aviso em destaque e a ficha de produção também. Para produção em escala, defina o domínio próprio antes. **Nunca remova o endereço antigo da Vercel:** chips já entregues dependem dele.
- **Peça à gráfica para travar a escrita do chip** depois de gravar e testar. Sem isso, qualquer pessoa com um celular poderia regravá-lo. Como o destino é trocado no servidor, o chip nunca precisa ser regravado, então a trava não custa nada.
- **Peça ao fornecedor** o acabamento que ele realmente entrega: relevo prateado e cromado exige hot-stamping, impressão UV comum é plana. O render de IA não é o produto.
- **Metal perto do chip atrapalha o NFC.** Stand de acrílico, não de metal; sem tinta ou foil metálico por cima da área do chip.
- **Teste em iPhone e Android** com a placa montada no stand, antes de fechar o lote.
- A **arte tem limite de 3,5 MB** (PNG ou JPG); o PDF entregue pelo painel, 4,3 MB. Arte fotográfica em PNG pesa bem mais que JPG.
