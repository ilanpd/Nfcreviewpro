import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Server Component (Auditoria de Performance, 28/09/2026) — 10 artigos de
// conteúdo real estavam indo pro bundle do cliente só porque `Accordion` (já
// "use client" por conta própria) foi importado aqui; nada neste arquivo usa
// estado ou efeito.

interface Article {
  question: string;
  answer: React.ReactNode;
}

interface Category {
  title: string;
  description: string;
  articles: Article[];
}

/**
 * Central de Ajuda (C9/F6, J7 do plano, 10 artigos) — conteúdo real, escrito
 * a partir do comportamento de verdade do produto (não uma lista genérica de
 * "perguntas frequentes" de SaaS). Duas categorias porque duas pessoas bem
 * diferentes chegam aqui: o dono do negócio que assina o Pulse, e o cliente
 * final que tocou um cartão numa mesa/balcão e teve algum problema.
 */
const CATEGORIES: Category[] = [
  {
    title: "Para donos e equipe",
    description: "Configurar o cartão, o Retorno, a cobrança e a equipe.",
    articles: [
      {
        question: "Como funciona o cartão quando alguém toca ou escaneia?",
        answer: (
          <>
            <p>
              Cada cartão tem um código único. Quando alguém toca (NFC) ou escaneia o QR Code, o Pulse decide pra
              onde mandar essa pessoa em quatro passos, do mais específico pro mais genérico: primeiro olha se{" "}
              <strong>aquele cartão</strong> tem uma campanha própria ativa, depois a <strong>zona</strong> (ex.:
              &ldquo;Salão Interno&rdquo;) onde ele está, depois a <strong>filial</strong>, e por último a configuração
              geral da empresa.
              A primeira que encontrar, ativa, vence — nunca duas ao mesmo tempo.
            </p>
            <p>
              Se nada disso estiver configurado, o cliente cai no comportamento padrão: avaliar no Google ou falar com
              você, mais o brinde do Retorno se ele estiver ativo (ver o próximo artigo).
            </p>
          </>
        ),
      },
      {
        question: "Como ativo o brinde de Retorno?",
        answer: (
          <>
            <p>
              Em <Link href="/dashboard/retorno" className="underline underline-offset-2">Retorno</Link>, escreva o
              brinde (ex.: &ldquo;10% de desconto na próxima visita&rdquo;) e defina o PIN — o código que quem atende digita pra
              confirmar um resgate no balcão. Só depois de ter os dois o botão de ativar libera.
            </p>
            <p>
              A partir daí, todo cliente que tocar num cartão da empresa ganha um código de brinde na hora, com prazo
              de validade que você escolhe. Você recebe um e-mail confirmando a ativação, com um lembrete das duas
              coisas pra deixar prontas na loja: o PIN e a placa/adesivo do cartão atualizada.
            </p>
          </>
        ),
      },
      {
        question: "Esqueci o PIN de resgate do Retorno",
        answer: (
          <p>
            Volte em <Link href="/dashboard/retorno" className="underline underline-offset-2">Retorno</Link> e troque
            o PIN a qualquer momento — não existe recuperação do PIN antigo (ele nunca fica salvo em texto puro, só um
            hash), só definir um novo. Isso não afeta os brindes já emitidos: eles continuam válidos com o PIN novo.
          </p>
        ),
      },
      {
        question: "Configurei o brinde, mas um cliente não recebeu — por quê?",
        answer: (
          <>
            <p>Antes de qualquer outra hipótese, confira nesta ordem:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Uma campanha sua está ativa naquele cartão, zona ou filial.</strong> Campanha configurada por
                você sempre tem prioridade sobre o Retorno — é assim de propósito, pra você nunca perder o controle do
                que aparece.
              </li>
              <li>
                <strong>O limite diário do brinde foi atingido.</strong> Se você definiu um teto de emissões por dia,
                depois dele o cliente ainda vê a oferta, mas sem ganhar um código novo até o dia seguinte.
              </li>
              <li>
                <strong>O mesmo cliente já resgatou há pouco tempo.</strong> O período de &ldquo;espera&rdquo;
                (cooldown) que você configurou evita que a mesma pessoa ganhe brinde a cada visita no mesmo dia.
              </li>
              <li>
                <strong>A assinatura está em atraso além da tolerância.</strong> Depois de alguns dias de cobrança não
                confirmada, a emissão de brinde novo pausa (ver o artigo sobre cobrança abaixo) — resgatar um brinde já
                emitido continua funcionando normalmente.
              </li>
            </ul>
          </>
        ),
      },
      {
        question: "Minha cobrança atrasou ou minha assinatura foi cancelada — o que acontece?",
        answer: (
          <>
            <p>
              Uma cobrança que falha não desliga nada na hora: você tem <strong>7 dias de tolerância</strong> com tudo
              funcionando normal, mais um aviso por e-mail. Depois disso, o painel vira só leitura por até{" "}
              <strong>90 dias</strong> — dá pra ver os dados, mas não editar nada nem emitir brinde novo (um brinde já
              emitido antes continua podendo ser resgatado). Depois desse prazo, é preciso reativar a assinatura.
            </p>
            <p>
              Pra atualizar a forma de pagamento ou reativar, use &ldquo;Gerenciar assinatura&rdquo; em{" "}
              <Link href="/dashboard/settings" className="underline underline-offset-2">Configurações</Link>.
            </p>
          </>
        ),
      },
      {
        question: "Como trocar o link do Google ou o WhatsApp dos meus cartões?",
        answer: (
          <p>
            Em <Link href="/dashboard/settings" className="underline underline-offset-2">Configurações</Link>, a
            qualquer momento. A mudança vale pra todos os cartões que ainda não têm uma campanha própria sobrepondo
            esse destino padrão.
          </p>
        ),
      },
      {
        question: "Como convido alguém da minha equipe pro painel?",
        answer: (
          <p>
            Em <Link href="/dashboard/team" className="underline underline-offset-2">Equipe</Link>, envie o convite
            pelo e-mail da pessoa e escolha o papel dela (Administrador, Marketing, Gerente, Operador ou Somente
            leitura) — cada papel enxerga e edita só o que faz sentido pra função, do dono da empresa a quem só
            precisa confirmar resgates no balcão.
          </p>
        ),
      },
    ],
  },
  {
    title: "Para quem tocou o cartão",
    description: "Você chegou aqui depois de tocar ou escanear um cartão? Estas são pra você.",
    articles: [
      {
        question: "Toquei o cartão e não abriu nada",
        answer: (
          <>
            <p>
              Sem NFC ligado no celular (ou um celular mais antigo sem suporte), o toque não funciona — procure o QR
              Code no mesmo cartão ou placa e escaneie com a câmera, funciona igual.
            </p>
            <p>
              Se mesmo escaneando o QR Code não abrir nada, o cartão pode estar temporariamente desativado pelo
              estabelecimento — fale diretamente com quem te atendeu.
            </p>
          </>
        ),
      },
      {
        question: "Não ganhei o brinde que a placa prometia",
        answer: (
          <p>
            O brinde tem regras definidas pelo próprio estabelecimento (validade, um por visita, limite por dia) — se
            você acha que deveria ter recebido e não recebeu, o jeito mais rápido é perguntar direto pra quem te
            atendeu. Um código de brinde já emitido pra você não expira sozinho antes do prazo mostrado na tela.
          </p>
        ),
      },
      {
        question: "Perdi o link do meu cartão (sou dono de um cartão avulso, comprado sem assinatura)",
        answer: (
          <p>
            Acesse{" "}
            <Link href="/meu-cartao/recuperar" className="underline underline-offset-2">
              Recuperar link do cartão
            </Link>{" "}
            e informe o e-mail usado na compra — mandamos de volta o link de edição de todos os cartões comprados com
            aquele e-mail, na hora.
          </p>
        ),
      },
      {
        question: "Suspeito de uso indevido do cartão ou de um resgate fraudulento",
        answer: (
          <p>
            Fale com a gente em <Link href="/contato" className="underline underline-offset-2">/contato</Link>{" "}
            contando o que percebeu (data, local, o que aconteceu). O sistema já bloqueia sozinho, por alguns minutos,
            uma sequência de tentativas erradas de PIN num mesmo brinde ou numa mesma loja — mas qualquer coisa fora
            do normal que você perceber, queremos saber.
          </p>
        ),
      },
    ],
  },
];

export function HelpArticles() {
  return (
    <div className="mx-auto max-w-3xl space-y-14">
      {CATEGORIES.map((category) => (
        <section key={category.title}>
          <h2 className="text-xl font-semibold tracking-tight">{category.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
          <Accordion type="single" collapsible className="mt-6 w-full">
            {category.articles.map((article, index) => (
              <AccordionItem key={article.question} value={`${category.title}-${index}`}>
                <AccordionTrigger className="text-left">{article.question}</AccordionTrigger>
                <AccordionContent className="space-y-2 text-muted-foreground">{article.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}
    </div>
  );
}
