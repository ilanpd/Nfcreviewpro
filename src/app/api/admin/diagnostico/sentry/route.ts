import { NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/super-admin";
import { reportServerError, sentryConfigured } from "@/lib/observability/report-error";

/**
 * Teste do Sentry, só para o super-admin: dispara UM erro de teste e diz se o DSN
 * está configurado. Serve para provar de ponta a ponta, em Produção, que o erro
 * chega ao painel do Sentry (e que o filtro de dados pessoais não deixou nada de
 * cliente passar: o teste leva um e-mail e um CPF falsos de propósito, que devem
 * aparecer mascarados no Sentry).
 */
export async function GET() {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const dsnConfigurado = sentryConfigured();
  const enviado = reportServerError(new Error("Teste do Sentry: pode ignorar (disparado pelo admin; contato teste@exemplo.com, doc 123.456.789-09)"), {
    module: "diagnostico",
    extra: { origem: "rota de teste do admin", to: "nao-deve-aparecer@exemplo.com" },
  });

  return NextResponse.json({
    dsnConfigurado,
    enviado,
    proximoPasso: dsnConfigurado
      ? "Abra o Sentry e procure o erro \"Teste do Sentry\" (etiqueta module = diagnostico). O e-mail e o CPF do texto devem aparecer mascarados."
      : "O Sentry ainda não está ligado neste ambiente: defina NEXT_PUBLIC_SENTRY_DSN na Vercel e faça um novo deploy.",
  });
}
