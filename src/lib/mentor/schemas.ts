import { z } from "zod";
import { CATEGORIES } from "@/lib/plan/schemas";

/** One-tap actions the mentor can attach to a reply. Never auto-executed. */
export const suggestionItem = z.object({
  kind: z
    .enum(["add_milestone", "set_today"])
    .describe(
      "add_milestone: a goal for the roadmap. set_today: a 5-30 minute action to do today.",
    ),
  title: z.string().describe("Short, action-oriented"),
  why: z.string().describe("One sentence on why it matters for this user"),
  horizon: z
    .enum(["long_term", "year", "term", "month"])
    .nullable()
    .describe("Required for add_milestone; null for set_today"),
  category: z.enum(CATEGORIES).nullable(),
  estimated_minutes: z
    .number()
    .int()
    .nullable()
    .describe("Required for set_today; null otherwise"),
});

export const suggestionsSchema = z.object({ items: z.array(suggestionItem) });

export type SuggestionItem = z.infer<typeof suggestionItem>;
export type Suggestions = z.infer<typeof suggestionsSchema>;

/** Stored form adds acceptance state. */
export type StoredSuggestion = SuggestionItem & { accepted_at?: string | null };

export function sanitizeSuggestions(s: Suggestions | null): StoredSuggestion[] {
  if (!s) return [];
  return s.items
    .filter((i) => i.title.trim())
    .slice(0, 3)
    .map((i) => ({
      ...i,
      title: i.title.trim().slice(0, 200),
      why: i.why.trim().slice(0, 400),
      horizon: i.kind === "add_milestone" ? (i.horizon ?? "month") : null,
      estimated_minutes:
        i.kind === "set_today"
          ? Math.min(60, Math.max(5, Math.round(i.estimated_minutes ?? 15)))
          : null,
      accepted_at: null,
    }));
}

export const memoryExtraction = z.object({
  memories: z.array(
    z.object({
      kind: z.enum([
        "fact",
        "preference",
        "goal",
        "concern",
        "decision",
        "context",
      ]),
      content: z
        .string()
        .describe(
          "A durable fact about the user, written in third person, under 200 characters",
        ),
      importance: z.number().int().describe("1-5"),
    }),
  ),
});

export const conversationSummary = z.object({
  summary: z
    .string()
    .describe(
      "Under 150 words: what the user is working on, decisions made, open questions",
    ),
});
