import { z } from "zod";

export const HORIZONS = [
  "long_term",
  "year",
  "term",
  "month",
  "week",
  "today",
] as const;
export const CATEGORIES = [
  "skills",
  "networking",
  "experience",
  "career_exploration",
  "applications",
  "learning",
  "business",
] as const;
export const DIFFICULTIES = ["lighter", "standard", "stretch"] as const;

export type Horizon = (typeof HORIZONS)[number];
export type Category = (typeof CATEGORIES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];

/*
 * Schemas for model output. Kept free of length/range keywords that
 * structured outputs may not support; `sanitize*` below enforces limits.
 */
export const milestoneDraft = z.object({
  key: z.string().describe("Short unique slug, e.g. 'first-internship'"),
  horizon: z.enum(HORIZONS),
  title: z.string().describe("Under 80 characters, action-oriented"),
  description: z.string().describe("One or two sentences"),
  why: z.string().describe("Why this matters for this specific user"),
  category: z.enum(CATEGORIES).nullable(),
  parent_key: z
    .string()
    .nullable()
    .describe("Key of the longer-horizon milestone this supports"),
});

export const priorityDraft = z.object({
  title: z.string(),
  why: z.string(),
  category: z.enum(CATEGORIES),
  milestone_key: z.string().nullable(),
});

export const actionDraft = z.object({
  title: z.string().describe("One concrete action, under 100 characters"),
  description: z.string().describe("How to do it, 1-3 sentences"),
  why: z
    .string()
    .describe("Why this matters for the user's goals, 1-2 sentences"),
  category: z.enum(CATEGORIES),
  estimated_minutes: z.number().int(),
  difficulty: z.enum(DIFFICULTIES),
  milestone_ref: z
    .string()
    .nullable()
    .describe("Id or key of the milestone it advances, from the provided list"),
});

export const initialPlanDraft = z.object({
  title: z.string().describe("Short roadmap name"),
  north_star: z.string().describe("The long-term direction in one sentence"),
  mode: z.enum(["directed", "exploring"]),
  summary: z
    .string()
    .describe("2-3 sentences explaining the shape of the plan to the user"),
  milestones: z.array(milestoneDraft),
  weekly_priorities: z.array(priorityDraft),
  today: actionDraft,
});

export const weeklyPrioritiesDraft = z.object({
  priorities: z.array(priorityDraft),
});

export type MilestoneDraft = z.infer<typeof milestoneDraft>;
export type PriorityDraft = z.infer<typeof priorityDraft>;
export type ActionDraft = z.infer<typeof actionDraft>;
export type InitialPlanDraft = z.infer<typeof initialPlanDraft>;

// ---------------------------------------------------------------------------
// Sanitizers — make any (model or rules) output safe to persist.
// ---------------------------------------------------------------------------
const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

export const HORIZON_LIMITS: Record<Horizon, [min: number, max: number]> = {
  long_term: [1, 2],
  year: [1, 4],
  term: [1, 4],
  month: [1, 4],
  week: [0, 5],
  today: [0, 0],
};

export function sanitizeAction(a: ActionDraft): ActionDraft {
  return {
    title: clip(a.title, 140),
    description: clip(a.description, 600),
    why: clip(a.why, 500),
    category: a.category,
    estimated_minutes: Math.min(
      60,
      Math.max(5, Math.round(a.estimated_minutes || 15)),
    ),
    difficulty: a.difficulty,
    milestone_ref: a.milestone_ref,
  };
}

export function sanitizePlan(plan: InitialPlanDraft): InitialPlanDraft {
  const seen = new Set<string>();
  const perHorizon = new Map<Horizon, number>();
  const milestones: MilestoneDraft[] = [];
  for (const m of plan.milestones) {
    if (m.horizon === "today") continue;
    const key = clip(m.key || m.title, 60)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    if (!key || seen.has(key) || !m.title.trim()) continue;
    const count = perHorizon.get(m.horizon) ?? 0;
    if (count >= HORIZON_LIMITS[m.horizon][1]) continue;
    perHorizon.set(m.horizon, count + 1);
    seen.add(key);
    milestones.push({
      ...m,
      key,
      title: clip(m.title, 120),
      description: clip(m.description, 600),
      why: clip(m.why, 500),
    });
  }
  // Drop dangling or self parent references.
  for (const m of milestones) {
    if (m.parent_key !== null) {
      const pk = m.parent_key.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      m.parent_key = seen.has(pk) && pk !== m.key ? pk : null;
    }
  }
  const priorities = plan.weekly_priorities.slice(0, 5).map((p) => ({
    ...p,
    title: clip(p.title, 140),
    why: clip(p.why, 400),
    milestone_key:
      p.milestone_key &&
      seen.has(p.milestone_key.toLowerCase().replace(/[^a-z0-9]+/g, "-"))
        ? p.milestone_key.toLowerCase().replace(/[^a-z0-9]+/g, "-")
        : null,
  }));
  return {
    title: clip(plan.title, 120),
    north_star: clip(plan.north_star, 300),
    mode: plan.mode,
    summary: clip(plan.summary, 800),
    milestones,
    weekly_priorities: priorities,
    today: sanitizeAction(plan.today),
  };
}

/** A plan is usable when it covers the long view down to this month. */
export function isUsablePlan(plan: InitialPlanDraft): boolean {
  const has = (h: Horizon) => plan.milestones.some((m) => m.horizon === h);
  return (
    has("long_term") &&
    has("year") &&
    (has("term") || has("month")) &&
    plan.weekly_priorities.length >= 2
  );
}
