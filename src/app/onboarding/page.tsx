import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const ctx = await getAuthContext();
  if (ctx) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Vamos configurar sua empresa</h1>
          <p className="text-sm text-muted-foreground">
            Essas informações aparecem na página que seus clientes veem ao aproximar o cartão NFC.
          </p>
        </div>
        <OnboardingForm />
      </div>
    </div>
  );
}
