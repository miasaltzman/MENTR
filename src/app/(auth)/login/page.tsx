import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/brand/logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { safeNextPath } from "@/lib/auth/redirects";
import { brand } from "@/lib/brand";
import { isSupabaseConfigured } from "@/lib/public-env";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  callback: "Sign-in didn’t complete. Please try again.",
  link: "That sign-in link is invalid or has expired. Request a new one.",
  oauth: "We couldn’t start Google sign-in. Please try again.",
  not_configured: "Sign-in isn’t configured yet.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(
    typeof params.next === "string" ? params.next : null,
  );
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const isSignup = params.intent === "signup";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-6xl px-5 py-5 sm:px-8">
        <Link href="/" aria-label={`${brand.name} home`}>
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pt-10 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-display text-5xl">
              {isSignup ? `Meet ${brand.name}` : "Welcome back"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {isSignup
                ? "A few quick questions, then your first step."
                : "Pick up where you left off."}
            </p>
          </div>
          {isSupabaseConfigured() ? (
            <LoginForm
              next={next}
              initialError={errorKey ? ERRORS[errorKey] : undefined}
            />
          ) : (
            <Alert>
              <AlertTitle>Setup required</AlertTitle>
              <AlertDescription>
                Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to{" "}
                <code>.env.local</code> to enable sign-in. See{" "}
                <code>.env.example</code>.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </main>
    </div>
  );
}
