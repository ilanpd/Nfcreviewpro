import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como tratamos os dados de quem compra, usa o painel ou encosta o celular no cartão.",
};

const SECTIONS: LegalSection[] = [
  {
    title: "Quem é o responsável pelos dados",
    paragraphs: [
      "Para os dados de quem compra e usa o painel, o controlador é [razão social e CNPJ a definir]. O encarregado de dados (DPO) pode ser contatado em [e-mail do encarregado a definir].",
      "Para os dados dos clientes finais de um estabelecimento (quem encosta o celular no cartão e envia uma nota ou mensagem), o estabelecimento é o controlador e nós atuamos como operadores, tratando esses dados apenas para prestar o serviço.",
    ],
  },
  {
    title: "Quais dados tratamos e por quê",
    paragraphs: [
      "Conta e empresa: nome, e-mail, papel na equipe, nome da empresa, WhatsApp do gerente, link de destino e identidade visual. Base legal: execução do contrato.",
      "Compras: nome, e-mail, CPF ou CNPJ, telefone e endereços de cobrança e entrega. O pagamento é processado pelo Stripe, e nós não armazenamos dados de cartão de crédito. Base legal: execução do contrato e obrigações legais, como a emissão de nota fiscal.",
      "Uso do cartão: tipo de aparelho, navegador e sistema, localização aproximada (país e cidade, quando disponível) e um identificador irreversível derivado do endereço IP, sem guardar o IP em texto. Base legal: legítimo interesse, para segurança, prevenção a fraude e estatísticas de uso.",
      "Notas e mensagens: a nota rápida que o cliente escolhe e as mensagens enviadas em “Falar com a gente”, com nome e telefone opcionais informados pelo próprio cliente. Base legal: execução do serviço contratado pelo estabelecimento.",
    ],
  },
  {
    title: "Com quem compartilhamos",
    paragraphs: [
      "Usamos provedores para operar o serviço: autenticação (Clerk), pagamentos (Stripe), banco de dados (Supabase), hospedagem (Vercel), cache (Upstash) e envio de e-mails. Eles tratam os dados somente para nos prestar esses serviços.",
      "Alguns desses provedores ficam fora do Brasil. Nesses casos, a transferência é feita com as garantias exigidas pela LGPD. Não vendemos dados pessoais.",
    ],
  },
  {
    title: "Por quanto tempo guardamos",
    paragraphs: [
      "Guardamos os dados enquanto a conta existir e pelos prazos exigidos em lei. Os prazos específicos de retenção de visitas e mensagens estão em definição e serão publicados aqui.",
    ],
  },
  {
    title: "Seus direitos",
    paragraphs: [
      "Pela LGPD, você pode pedir confirmação de que tratamos seus dados, acesso, correção, anonimização, portabilidade, eliminação, informação sobre com quem compartilhamos e a revogação de consentimento.",
      "Quem tem conta pode exportar e excluir os dados da empresa em Configurações, no painel. Para qualquer outro pedido, fale com o encarregado no contato acima.",
    ],
  },
  {
    title: "Cookies",
    paragraphs: [
      "Usamos apenas cookies e armazenamento local necessários para manter você conectado, proteger o acesso e lembrar a sua preferência de tema. Não usamos cookies de publicidade. Se passarmos a usar outros, esta política será atualizada antes.",
    ],
  },
  {
    title: "Segurança",
    paragraphs: [
      "Usamos conexão criptografada, controle de acesso por papéis, senhas e segredos protegidos e registros de auditoria das ações mais importantes. Nenhum sistema é totalmente imune a falhas; se houver um incidente que afete seus dados, avisaremos você e a autoridade competente nos termos da lei.",
    ],
  },
  {
    title: "Crianças e adolescentes",
    paragraphs: ["O serviço é voltado a estabelecimentos comerciais e não se destina a menores de 18 anos."],
  },
  {
    title: "Mudanças nesta política",
    paragraphs: [
      "Podemos atualizar esta política. Quando a mudança for relevante, avisaremos por e-mail ou no painel antes de ela valer.",
    ],
  },
];

export default function PrivacidadePage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      updatedAt="26/09/2026"
      intro="Explicamos, sem rodeios, quais dados tratamos, para quê e quais são os seus direitos."
      sections={SECTIONS}
    />
  );
}
