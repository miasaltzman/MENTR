import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import {
  type Answers,
  applicableSteps,
  findStep,
  isSkipped,
  parseAnswer,
} from "./flow";

export async function loadAnswers(
  supabase: ServerSupabase,
  userId: string,
): Promise<Answers> {
  const { data, error } = await supabase
    .from("onboarding_responses")
    .select("question_key, answer")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const answers: Answers = {};
  for (const row of data ?? []) {
    const step = findStep(row.question_key);
    if (!step) continue;
    // Re-validate stored JSON so older or malformed rows can't break the flow.
    const parsed = parseAnswer({ ...step, optional: true }, row.answer);
    if (parsed) answers[row.question_key] = parsed;
  }
  return answers;
}

/** Every required core question must be answered before the first plan. */
export function missingCoreSteps(answers: Answers): string[] {
  return applicableSteps(answers, "core")
    .filter(
      (s) => !s.optional && (!answers[s.key] || isSkipped(answers[s.key])),
    )
    .map((s) => s.key);
}
