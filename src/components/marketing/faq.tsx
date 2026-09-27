"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BlurFade } from "@/components/ui/blur-fade";

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
