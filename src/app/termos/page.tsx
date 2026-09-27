import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "As regras de uso dos cartões NFC, do painel e da loja.",
};

const SECTIONS: LegalSection[] = [
  {
    title: "Quem somos e o que estes Termos regulam",
    paragraphs: [
      "Estes Termos regulam o uso do site, da loja, do painel e dos cartões NFC e QR vendidos por [razão social e CNPJ a definir] (“nós”). Ao comprar um cartão, criar uma conta ou usar o painel, você (“usuário”, o dono ou responsável pelo estabelecimento) concorda com eles.",
    ],
  },
  {
    title: "O serviço",
    paragraphs: [
      "O cartão físico leva a pessoa que encosta o celular (ou lê o QR code) até o destino que o usuário escolheu, como a página de avaliação do Google, um perfil de rede social, um WhatsApp ou um cardápio.",
      "O painel, disponível nos planos pagos, permite acompanhar toques, ler mensagens enviadas pelos clientes e configurar o cartão. Os recursos de cada plano são os descritos na página de preços no momento da contratação.",
    ],
  },
  {
    title: "Conta e responsabilidade",
    paragraphs: [
      "Você deve informar dados verdadeiros e manter seu acesso em segurança. Você responde pelo que for feito com a sua conta e pelas pessoas da sua equipe que você convidar.",
    ],
  },
  {
    title: "Planos, pagamento e cancelamento",
    paragraphs: [
      "As assinaturas são cobradas de forma recorrente por meio do Stripe, e os cartões físicos são cobrados uma única vez. Os preços exibidos no momento da compra são os que valem para aquele pedido.",
      "Você pode cancelar a assinatura a qualquer momento pelo portal de cobrança, sem multa. Aplicam-se os direitos previstos no Código de Defesa do Consumidor, quando cabíveis. Os prazos de produção e entrega dos cartões são informados no pedido.",
    ],
  },
  {
    title: "Regras de uso",
    paragraphs: [
      "É proibido usar o serviço para filtrar, esconder ou selecionar quem pode avaliar o seu negócio em plataformas de terceiros, para oferecer benefício em troca de avaliação, ou para qualquer prática que viole as políticas dessas plataformas ou a lei. Essas regras existem para proteger o perfil do seu negócio.",
      "Ofertas, brindes e promoções que você criar são de sua responsabilidade, incluindo regulamento, validade e custo. Não usamos nem permitimos o uso do serviço para conteúdo ilegal, enganoso ou que viole direitos de terceiros.",
    ],
  },
  {
    title: "Propriedade intelectual",
    paragraphs: [
      "O produto, a marca e o software pertencem a nós. Você mantém a titularidade do seu nome, da sua marca e dos conteúdos que cadastrar, e nos autoriza a usá-los apenas para operar o serviço para você.",
    ],
  },
  {
    title: "Disponibilidade e limitação de responsabilidade",
    paragraphs: [
      "Trabalhamos para manter o serviço disponível, mas ele é oferecido no estado em que está, sujeito a manutenções e a falhas de terceiros. Não garantimos aumento de avaliações, de clientes ou de receita.",
      "Na extensão permitida em lei, nossa responsabilidade total por qualquer problema com o serviço fica limitada ao valor que você pagou nos 12 meses anteriores ao fato.",
    ],
  },
  {
    title: "Suspensão e encerramento",
    paragraphs: [
      "Podemos suspender ou encerrar contas que descumpram estes Termos ou usem o serviço de forma ilegal ou abusiva. Você pode pedir a exclusão da sua conta e dos seus dados a qualquer momento, pelo painel ou pelo contato abaixo.",
    ],
  },
  {
    title: "Mudanças nestes Termos",
    paragraphs: [
      "Podemos atualizar estes Termos. Quando a mudança for relevante, avisaremos por e-mail ou no painel antes de ela valer. Continuar usando o serviço depois disso significa que você aceita a nova versão.",
    ],
  },
  {
    title: "Lei aplicável e contato",
    paragraphs: [
      "Estes Termos seguem a lei brasileira. O foro será o da comarca [a definir], ressalvados os direitos do consumidor previstos em lei.",
      "Dúvidas sobre estes Termos: [e-mail de contato a definir].",
    ],
  },
];

export default function TermosPage() {
  return (
    <LegalPage
      title="Termos de Uso"
      updatedAt="26/09/2026"
      intro="Leia com calma. Escrevemos de forma direta, sem juridiquês desnecessário."
      sections={SECTIONS}
    />
  );
}
