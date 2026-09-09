import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // BullMQ (Fase 8 — Queue Engine) tenta importar vários backends
  // opcionais (ex.: @valkey/valkey-glide) que este produto não usa — nunca
  // instalados, então o bundler do webpack os reportava como "Module not
  // found" (um aviso inofensivo, mas ruidoso, em todo build). Marcá-los
  // como pacotes externos do servidor faz o Node resolvê-los em runtime via
  // `require` normal, em vez do webpack tentar (e falhar) empacotá-los.
  serverExternalPackages: ["bullmq", "ioredis"],

  // Impressão Profissional (Fase 10, bônus) — achado real no Gate Final:
  // `/api/cards/[id]/print` (via @react-pdf/renderer → pdfkit) retornava
  // 500 em produção na Vercel com `Cannot find module
  // '.../pdfkit/js/standard-fonts/Helvetica.cjs'`. O pdfkit carrega essas
  // fontes com um require() dinâmico que o file tracer da Vercel não
  // consegue seguir estaticamente, então excluía o diretório inteiro do
  // pacote da função serverless — funcionava em `npm run dev` (node_modules
  // completo no disco) e quebrava só no deploy real. `outputFileTracingIncludes`
  // força a inclusão desse diretório para a rota que precisa dele.
  outputFileTracingIncludes: {
    "/api/cards/[id]/print": ["./node_modules/pdfkit/js/**/*"],
  },

  // Segurança (Fase 10 — White Label) — HSTS real, não preparação de
  // mentira: navegadores só o honram sobre HTTPS (inofensivo em
  // desenvolvimento local sobre HTTP). `preload` deliberadamente omitido —
  // exige submissão manual a hstspreload.org, um passo do lado do domínio
  // de produção, não algo que o código sozinho pode ativar. Ver ADR-045.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }],
      },
    ];
  },
};

export default nextConfig;
