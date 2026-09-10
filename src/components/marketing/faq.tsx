"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BlurFade } from "@/components/ui/blur-fade";

const FAQS = [
  {
    question: "Preciso instalar algo no celular do cliente?",
    answer: "Não. O cliente só aproxima o celular do cartão NFC (ou escaneia o QR Code) e a página abre no navegador, sem app e sem cadastro.",
  },
  {
    question: "O que acontece com avaliações ruins?",
    answer: "Avaliações de 1 a 3 estrelas nunca chegam ao Google. Elas abrem um formulário de feedback privado que é enviado direto para o WhatsApp do responsável.",
  },
  {
    question: "Posso trocar o link do Google ou o WhatsApp depois?",
    answer: "Sim, a qualquer momento em Configurações. As mudanças valem para todos os cartões da empresa.",
  },
  {
    question: "Como funciona a gravação do cartão NFC?",
    answer: "Hoje enviamos cartões pré-gravados com seu código exclusivo. A gravação própria via app estará disponível em breve.",
  },
  {
    question: "Consigo trocar de plano depois?",
    answer: "Sim, você pode fazer upgrade ou downgrade a qualquer momento direto do painel, sem multa.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
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
