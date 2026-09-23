import type { MentorContext } from "@/lib/ai/context";
import { isStudent, renderMentorContext } from "@/lib/ai/context";
import type { Difficulty } from "@/lib/plan/schemas";

const NO_HOMEWORK =
  "Actions must feel like quick wins, never homework: concrete moves like follow, save, look up, message, practice out loud, update, choose, apply, or ask Mentr. No essays, reports, write-ups, teardowns, worksheets, summaries, or reflections. The user should think “that’s easy, I can do that.”";

const NO_INVENTED_FACTS =
  "Don’t name specific companies, clubs, programs, events, people, deadlines, salaries, or statistics — you can’t verify them here. Describe what to look for instead (e.g. “your school’s data science club”, “your city’s official small-business page”). Never include URLs.";

export function initialPlanPrompt(ctx: MentorContext): string {
  const term = isStudent(ctx) ? "this semester" : "this quarter";
  return `<user_context>
${renderMentorContext(ctx)}
</user_context>

Create this person’s first roadmap.

Structure:
- Milestones across horizons: long_term (3–5 years; 1–2), year (2–4), term (${term}; 2–4), month (2–3). Give each a short slug key. When a milestone supports a longer-horizon one, set parent_key to that milestone’s key.
- 3–5 weekly_priorities for this week — small, specific moves (not projects), each tied to a milestone key where possible.
- One "today" action: 2–10 minutes, concrete enough to start immediately. Set milestone_ref to the key of the milestone it advances.
- A short title, a one-sentence north_star, and a 2–3 sentence summary written to the user explaining the shape of the plan.

Adapt to certainty:
- If they don’t know what they want, or haven’t named a target, use mode "exploring": help them discover a direction through small experiments, research, and conversations. Do not lock them into one career.
- Otherwise use mode "directed" and work backward from their target.
- For founders, follow the path problem & customer → market research → competitors → product concept → unit economics → testing → brand → legal/regulatory (checked against official local sources) → sales channels → launch, starting from their current stage. Founders without an idea should start by finding problems worth solving.

Quality bar:
- Personalize to their situation (school, year, major, work, venture stage, location, goals). Each milestone’s "why" should connect to something they told you.
- Titles are short and action-oriented. No hype or motivational filler.
- ${NO_HOMEWORK}
- ${NO_INVENTED_FACTS}`;
}

const DIFFICULTY_GUIDE: Record<Difficulty, string> = {
  lighter: "lighter: 2–5 minutes, almost effortless",
  standard: "standard: 3–10 minutes",
  stretch: "stretch: 15–20 minutes, a bit more ambitious (never more than 30)",
};

export function dailyActionPrompt(
  ctx: MentorContext,
  opts: {
    difficulty: Difficulty;
    replacing?: { title: string; reason: "different" | "lighter" | "stretch" };
  },
): string {
  const open = (ctx.roadmap?.milestones ?? []).filter(
    (m) => m.status !== "completed" && m.status !== "skipped",
  );
  const milestoneList = open.length
    ? open
        .map(
          (m) =>
            `- id: ${m.id} | ${m.horizon} | ${m.title}${m.category ? ` | ${m.category}` : ""}`,
        )
        .join("\n")
    : "(no roadmap yet)";
  const replacing = opts.replacing
    ? opts.replacing.reason === "different"
      ? `\nThey asked for something different from: “${opts.replacing.title}”. Pick a different kind of action.`
      : `\nThey asked for a ${opts.replacing.reason === "lighter" ? "smaller, easier" : "bigger, more ambitious"} version of: “${opts.replacing.title}”. Keep the same intent, change the size.`
    : "";
  return `<user_context>
${renderMentorContext(ctx)}
</user_context>

<open_milestones>
${milestoneList}
</open_milestones>

Suggest today’s single 1% action.
- Difficulty: ${DIFFICULTY_GUIDE[opts.difficulty]}.
- It must advance one of the open milestones: set milestone_ref to that milestone’s id.
- Don’t repeat anything from their recent activity; favor a category they haven’t worked on lately.
- The description is one short line on how to start; the "why" is one sentence on why it matters for their goals.
- ${NO_HOMEWORK}
- ${NO_INVENTED_FACTS}${replacing}`;
}

export function weeklyPrioritiesPrompt(
  ctx: MentorContext,
  weekStart: string,
): string {
  const open = (ctx.roadmap?.milestones ?? []).filter(
    (m) => m.status !== "completed" && m.status !== "skipped",
  );
  return `<user_context>
${renderMentorContext(ctx)}
</user_context>

<open_milestones>
${open.map((m) => `- key: ${m.id} | ${m.horizon} | ${m.title}`).join("\n") || "(none)"}
</open_milestones>

Choose 3–5 priorities for the week starting ${weekStart}. Each should move a nearer-term milestone forward (set milestone_key to its id), be achievable in a week alongside everything else in their life, and come with a one-sentence why. ${NO_HOMEWORK} ${NO_INVENTED_FACTS}`;
}
