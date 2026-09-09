import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getAuthContext } from "@/lib/auth";
import { isDevRuntimeEnabled } from "@/lib/dev-runtime/config";
import { onboardingSchema } from "@/lib/validations/company";
import { createCompanyForNewUser } from "@/services/company.service";
import { handleApiError } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    const existing = await getAuthContext();
    if (existing) {
      return NextResponse.json({ error: "Empresa já configurada" }, { status: 409 });
    }

    // Onboarding é, por natureza, o momento em que uma identidade Clerk vira
    // um User — não tem equivalente no Dev Runtime (ver lib/dev-runtime/),
    // que assume uma empresa já semeada. Recusar com uma mensagem clara aqui
    // é melhor do que deixar `auth()` lançar o erro genérico do Clerk sobre
    // middleware ausente.
    if (isDevRuntimeEnabled()) {
      return NextResponse.json({ error: "Dev Runtime ativo — rode o seed para uma empresa de demonstração em vez de fazer onboarding" }, { status: 409 });
    }

    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress;
    if (!email) return NextResponse.json({ error: "E-mail não encontrado na conta" }, { status: 400 });

    const input = onboardingSchema.parse(await req.json());
    const company = await createCompanyForNewUser({ clerkId, email, input });
    return NextResponse.json({ company }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
