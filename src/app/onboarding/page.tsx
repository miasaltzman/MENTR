import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { requireUser } from "@/lib/auth/session";
import { brand } from "@/lib/brand";
import { loadAnswers } from "@/lib/onboarding/answers";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `Get started with ${brand.name}` };
// Finishing onboarding generates the first plan, which can take a while.
export const maxDuration = 120;

export default async function OnboardingPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_status, first_name")
    .eq("id", user.id)
    .single();
  if (profile?.onboarding_status === "completed") redirect("/home");

  const answers = await loadAnswers(supabase, user.id);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-2xl px-5 pt-5 sm:px-8">
        <Logo />
      </header>
      {/* The name from the auth provider (e.g. Google) is only a suggestion until confirmed. */}
      <OnboardingFlow
        initialAnswers={answers}
        suggestedName={profile?.first_name}
      />
    </div>
  );
}
