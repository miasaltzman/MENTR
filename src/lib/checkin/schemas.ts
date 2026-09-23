import { z } from "zod";
import { CATEGORIES, priorityDraft } from "@/lib/plan/schemas";

export const checkinAnswers = z.object({
  progress: z.string().trim().max(1500).default(""),
  changes: z.string().trim().max(1500).default(""),
  difficulties: z.string().trim().max(1500).default(""),
  nextPriority: z.string().trim().max(500).default(""),
});
export type CheckinAnswers = z.infer<typeof checkinAnswers>;

export const checkinReview = z.object({
  mentor_note: z
    .string()
    .describe(
      "2-4 sentences to the user: honest reflection on the week and what to focus on next. No empty praise.",
    ),
  next_week_priorities: z
    .array(priorityDraft)
    .describe(
      "3-5 priorities; milestone_key must be an id from the list or null",
    ),
  milestone_updates: z
    .array(
      z.object({
        milestone_id: z.string(),
        status: z.enum(["in_progress", "completed", "skipped"]),
        reason: z.string(),
      }),
    )
    .describe("Only when the user's answers clearly indicate it"),
  new_milestones: z
    .array(
      z.object({
        horizon: z.enum(["year", "term", "month"]),
        title: z.string(),
        why: z.string(),
        category: z.enum(CATEGORIES).nullable(),
      }),
    )
    .describe("0-2, only if goals changed or something important is missing"),
});
export type CheckinReview = z.infer<typeof checkinReview>;
