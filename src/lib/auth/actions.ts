"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth/redirects";
import { isSupabaseConfigured, publicEnv } from "@/lib/public-env";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | {
      status: "error";
      stage: "email" | "code";
      message: string;
      email?: string;
    };

const emailSchema = z.email({ message: "Enter a valid email address." });
const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6,10}$/, "Enter the code from your email.");

async function siteOrigin(): Promise<string> {
  const h = await headers();
  return h.get("origin") ?? publicEnv.siteUrl;
}

function notConfigured(): AuthFormState {
  return {
    status: "error",
    stage: "email",
    message:
      "Sign-in isn’t configured yet. Add your Supabase keys to .env.local.",
  };
}

/** Single entry point for the email form so the UI always shows the latest result. */
export async function emailAuth(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  return formData.get("intent") === "verify"
    ? verifyEmailCode(formData)
    : sendMagicLink(formData);
}

async function sendMagicLink(formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return notConfigured();

  const parsed = emailSchema.safeParse(
    String(formData.get("email") ?? "").trim(),
  );
  if (!parsed.success) {
    return {
      status: "error",
      stage: "email",
      message: parsed.error.issues[0].message,
    };
  }
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const origin = await siteOrigin();

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return {
      status: "error",
      stage: "email",
      email: parsed.data,
      message:
        error.status === 429
          ? "Too many attempts. Please wait a minute and try again."
          : "We couldn’t send the email. Please try again.",
    };
  }
  return { status: "sent", email: parsed.data };
}

async function verifyEmailCode(formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return notConfigured();

  const email = emailSchema.safeParse(
    String(formData.get("email") ?? "").trim(),
  );
  const code = codeSchema.safeParse(String(formData.get("code") ?? ""));
  if (!email.success) {
    return {
      status: "error",
      stage: "email",
      message: "Enter your email again.",
    };
  }
  if (!code.success) {
    return {
      status: "error",
      stage: "code",
      email: email.data,
      message: code.error.issues[0].message,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: email.data,
    token: code.data,
    type: "email",
  });
  if (error) {
    return {
      status: "error",
      stage: "code",
      email: email.data,
      message:
        "That code didn’t work. It may have expired — request a new one.",
    };
  }
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) redirect("/login?error=not_configured");

  const next = safeNextPath(String(formData.get("next") ?? ""));
  const origin = await siteOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
