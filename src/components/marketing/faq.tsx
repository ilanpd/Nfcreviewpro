import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BlurFade } from "@/components/ui/blur-fade";

// Server Component — `Accordion`/`BlurFade` já são "use client" por conta
// própria; nada aqui precisa de estado no servidor (Auditoria de
// Performance, 28/09/2026).

const FAQS = [
  {
    question: "Preciso instalar algo no celular do cliente?",
    answer: "Não. O cliente só aproxima o celular do cartão NFC (ou escaneia o QR Code) e a página abre no navegador, sem app e sem cadastro.",
  },
  {
    question: "O que o cliente vê depois de tocar no cartão?",
    answer:
      "Duas opções, iguais para todo mundo: avaliar no Google ou falar direto com o negócio. O produto não filtra, não esconde e não escolhe quem pode avaliar. No plano Starter, o cliente também ganha um brinde para a próxima visita.",
  },
  {
    question: "Posso trocar o link do Google ou o WhatsApp depois?",
    answer: "Sim, a qualquer momento em Configurações. As mudanças valem para todos os cartões da empresa.",
  },
  {
    question: "Como funciona a gravação do cartão NFC?",
    answer: "Enviamos os cartões pré-gravados com seu código exclusivo, prontos pra usar assim que chegam — você nunca precisa gravar nada.",
  },
  {
    question: "Consigo trocar de plano depois?",
    answer: "Sim, você pode fazer upgrade ou downgrade a qualquer momento direto do painel, sem multa.",
  },
  {
    question: "Funciona em qualquer celular, inclusive iPhone?",
    answer:
      "Sim. NFC funciona nativamente em iPhone (a partir do iOS 11) e Android, direto pela câmera do próprio aparelho — sem instalar nenhum app. O QR Code no cartão é a alternativa para quem preferir escanear em vez de aproximar.",
  },
  {
    question: "Se eu cancelar a assinatura, o cartão físico para de funcionar?",
    answer:
      "Não. O cartão continua levando o cliente para o destino que você configurou (Google, Instagram, WhatsApp...) mesmo sem assinatura ativa. O que fica indisponível é o acesso ao painel e a emissão de novos brindes do Retorno.",
  },
  {
    question: "O cartão aguenta o uso diário num balcão ou numa mesa?",
    answer:
      "Sim, é feito pra isso — uso diário em mãos, balcão, mesa ou recepção. Se o seu chegar com algum defeito de fabricação, é só falar com a gente pelo Contato.",
  },
  {
    question: "Preciso saber mexer em tecnologia pra configurar?",
    answer:
      "Não. O cartão já chega gravado e pronto — trocar pra onde ele leva leva menos de um minuto, direto do celular. Usar o painel do Starter é a mesma lógica de preencher um formulário.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-20">
      <BlurFade inView>
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Perguntas frequentes</h2>
        </div>
      </BlurFade>

      <BlurFade delay={0.08} inView offset={12}>
        <Accordion type="single" collapsible className="mt-12 w-full">
          {FAQS.map((faq, index) => (
            <AccordionItem key={faq.question} value={`item-${index}`}>
              <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </BlurFade>
    </section>
  );
}
