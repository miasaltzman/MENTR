"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { loadAnswers, missingCoreSteps } from "@/lib/onboarding/answers";
import {
  type Answer,
  applicableSteps,
  findStep,
  parseAnswer,
} from "@/lib/onboarding/flow";
import { persistAnswer } from "@/lib/onboarding/persist";
import { generateInitialPlan } from "@/lib/plan/service";
import { createClient } from "@/lib/supabase/server";

export type SaveResult = { ok: true } | { ok: false; error: string };

function validTimezone(tz: string | undefined): string | null {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

export async function saveOnboardingAnswer(
  key: string,
  raw: unknown,
  timezone?: string,
): Promise<SaveResult> {
  const user = await requireUser();
  const supabase = await createClient();
  try {
    const answers = await loadAnswers(supabase, user.id);
    const step = findStep(key);
    if (!step) return { ok: false, error: "Unknown question." };

    // The question must apply to this user given their answers so far.
    const withCandidate = { ...answers, [key]: raw as Answer };
    const applies = applicableSteps(
      key === "user_type" ? withCandidate : answers,
    ).some((s) => s.key === key);
    if (!applies)
      return { ok: false, error: "That question doesn’t apply anymore." };

    const answer = parseAnswer(step, raw);
    if (!answer)
      return {
        ok: false,
        error: "That answer doesn’t look right — please check it.",
      };

    const { error } = await supabase
      .from("onboarding_responses")
      .upsert(
        { user_id: user.id, question_key: key, answer: answer as never },
        { onConflict: "user_id,question_key" },
      );
    if (error) throw new Error(error.message);

    await persistAnswer(
      { supabase, userId: user.id, answers: { ...answers, [key]: answer } },
      key,
      answer,
    );

    const tz = validTimezone(timezone);
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        onboarding_step: key,
        ...(tz ? { timezone: tz } : {}),
      })
      .eq("id", user.id)
      .neq("onboarding_status", "completed");
    if (profileError) throw new Error(profileError.message);
    await supabase
      .from("profiles")
      .update({ onboarding_status: "in_progress" })
      .eq("id", user.id)
      .eq("onboarding_status", "not_started");

    return { ok: true };
  } catch (err) {
    console.error(
      "[onboarding] save failed",
      err instanceof Error ? err.message : err,
    );
    return { ok: false, error: "We couldn’t save that. Please try again." };
  }
}

export async function completeOnboarding(): Promise<SaveResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const answers = await loadAnswers(supabase, user.id);
  const missing = missingCoreSteps(answers);
  if (missing.length)
    return { ok: false, error: "A few questions still need an answer." };

  try {
    await generateInitialPlan(supabase, user.id);
  } catch (err) {
    console.error("[onboarding] plan generation failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "We couldn’t build your plan just now. Please try again." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_status: "completed",
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error)
    return { ok: false, error: "We couldn’t finish setup. Please try again." };

  redirect("/home");
}
