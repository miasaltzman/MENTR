import "server-only";
import type { MentorContext } from "@/lib/ai/context";
import { MENTOR_PERSONA } from "@/lib/ai/prompts/persona";
import {
  dailyActionPrompt,
  initialPlanPrompt,
  weeklyPrioritiesPrompt,
} from "@/lib/ai/prompts/plan";
import { getAIProvider } from "@/lib/ai/provider";
import { loadMentorContext } from "@/lib/data/mentor-context";
import { weekStart } from "@/lib/domain/dates";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import {
  resizeRulesAction,
  rulesDailyAction,
  rulesInitialPlan,
  rulesWeeklyPriorities,
} from "./rules";
import {
  actionDraft,
  type ActionDraft,
  type Difficulty,
  initialPlanDraft,
  isUsablePlan,
  type PriorityDraft,
  sanitizeAction,
  sanitizePlan,
  weeklyPrioritiesDraft,
} from "./schemas";

type Db = ServerSupabase;
export type DailyAction = Tables<"daily_actions">;

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? "unknown error"}`);
}

// ---------------------------------------------------------------------------
// Initial plan
// ---------------------------------------------------------------------------
export async function generateInitialPlan(
  supabase: Db,
  userId: string,
): Promise<{ roadmapId: string; usedFallback: boolean }> {
  const ctx = await loadMentorContext(supabase, userId);
  const ai = getAIProvider();

  const result = await ai.generateObject({
    task: "roadmap",
    system: MENTOR_PERSONA,
    prompt: initialPlanPrompt(ctx),
    schema: initialPlanDraft,
    fallback: () => rulesInitialPlan(ctx),
  });
  let plan = sanitizePlan(result.data);
  let usedFallback = result.usedFallback;
  if (!isUsablePlan(plan)) {
    plan = sanitizePlan(rulesInitialPlan(ctx));
    usedFallback = true;
  }

  // Archive any previous active roadmap (one active per kind).
  const archive = await supabase
    .from("roadmaps")
    .update({ status: "archived" })
    .eq("user_id", userId)
    .eq("kind", "career")
    .eq("status", "active");
  if (archive.error) fail("archive roadmap", archive.error);

  const roadmapId = crypto.randomUUID();
  const inserted = await supabase.from("roadmaps").insert({
    id: roadmapId,
    user_id: userId,
    kind: "career",
    title: plan.title,
    north_star: plan.north_star,
    mode: plan.mode,
    origin: usedFallback ? "system" : "ai",
  });
  if (inserted.error) fail("insert roadmap", inserted.error);

  const idByKey = new Map(
    plan.milestones.map((m) => [m.key, crypto.randomUUID()]),
  );
  const position = new Map<string, number>();
  const rows = plan.milestones.map((m) => {
    const p = position.get(m.horizon) ?? 0;
    position.set(m.horizon, p + 1);
    return {
      id: idByKey.get(m.key)!,
      roadmap_id: roadmapId,
      user_id: userId,
      parent_id: m.parent_key ? (idByKey.get(m.parent_key) ?? null) : null,
      horizon: m.horizon,
      title: m.title,
      description: m.description,
      why: m.why,
      category: m.category,
      position: p,
      origin: usedFallback ? ("system" as const) : ("ai" as const),
    };
  });
  // Self-referencing FKs are checked at statement end, so one insert is fine.
  const ms = await supabase.from("roadmap_milestones").insert(rows);
  if (ms.error) fail("insert milestones", ms.error);

  await supabase.from("roadmap_revisions").insert({
    roadmap_id: roadmapId,
    user_id: userId,
    cause: "initial",
    summary: plan.summary,
  });

  const week = weekStart(ctx.today);
  await replaceWeeklyPriorities(
    supabase,
    userId,
    week,
    plan.weekly_priorities,
    idByKey,
    usedFallback,
  );
  await insertTodayAction(
    supabase,
    userId,
    ctx.today,
    plan.today,
    idByKey,
    usedFallback,
  );

  return { roadmapId, usedFallback };
}

async function replaceWeeklyPriorities(
  supabase: Db,
  userId: string,
  week: string,
  priorities: PriorityDraft[],
  idByRef: Map<string, string>,
  usedFallback: boolean,
) {
  const del = await supabase
    .from("weekly_priorities")
    .delete()
    .eq("user_id", userId)
    .eq("week_start", week);
  if (del.error) fail("clear priorities", del.error);
  if (!priorities.length) return;
  const ins = await supabase.from("weekly_priorities").insert(
    priorities.map((p, i) => ({
      user_id: userId,
      week_start: week,
      title: p.title,
      why: p.why,
      category: p.category,
      milestone_id: p.milestone_key
        ? (idByRef.get(p.milestone_key) ?? null)
        : null,
      position: i,
      origin: usedFallback ? ("system" as const) : ("ai" as const),
    })),
  );
  if (ins.error) fail("insert priorities", ins.error);
}

async function insertTodayAction(
  supabase: Db,
  userId: string,
  date: string,
  draft: ActionDraft,
  idByRef: Map<string, string>,
  usedFallback: boolean,
): Promise<DailyAction | null> {
  const a = sanitizeAction(draft);
  const { data, error } = await supabase
    .from("daily_actions")
    .insert({
      user_id: userId,
      action_date: date,
      title: a.title,
      description: a.description,
      why: a.why,
      category: a.category,
      estimated_minutes: a.estimated_minutes,
      difficulty: a.difficulty,
      milestone_id: a.milestone_ref
        ? (idByRef.get(a.milestone_ref) ?? null)
        : null,
      origin: usedFallback ? "system" : "ai",
    })
    .select("*")
    .single();
  if (error) {
    // Another request already created today's action.
    if (error.code === "23505") return null;
    fail("insert action", error);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Daily action
// ---------------------------------------------------------------------------
function milestoneRefs(ctx: MentorContext): Map<string, string> {
  // Model output references milestones by id; accept ids verbatim.
  return new Map((ctx.roadmap?.milestones ?? []).map((m) => [m.id, m.id]));
}

async function draftDailyAction(
  ctx: MentorContext,
  opts: {
    difficulty: Difficulty;
    replacing?: {
      title: string;
      reason: "different" | "lighter" | "stretch";
      milestoneId?: string | null;
    };
    avoidTitles: string[];
  },
) {
  const open = (ctx.roadmap?.milestones ?? []).filter(
    (m) => m.status !== "completed" && m.status !== "skipped",
  );
  const replacingCategory =
    opts.replacing?.reason === "different"
      ? ctx.recentActions[0]?.category
      : undefined;
  const result = await getAIProvider().generateObject({
    task:
      opts.replacing && opts.replacing.reason !== "different"
        ? "adjust_action"
        : "daily_action",
    system: MENTOR_PERSONA,
    prompt: dailyActionPrompt(ctx, opts),
    schema: actionDraft,
    fallback: () =>
      (opts.replacing && opts.replacing.reason !== "different"
        ? resizeRulesAction(
            ctx,
            {
              title: opts.replacing.title,
              milestone_ref: opts.replacing.milestoneId ?? null,
            },
            opts.difficulty,
          )
        : null) ??
      rulesDailyAction(ctx, {
        milestones: open.map((m) => ({ ref: m.id, category: m.category })),
        avoidTitles:
          opts.replacing?.reason === "different"
            ? opts.avoidTitles
            : opts.avoidTitles.filter((t) => t !== opts.replacing?.title),
        difficulty: opts.difficulty,
        seed: `${ctx.today}:${opts.avoidTitles.length}`,
        excludeCategory: replacingCategory,
      }),
  });
  return { draft: result.data, usedFallback: result.usedFallback };
}

export async function getTodayAction(
  supabase: Db,
  userId: string,
  today: string,
): Promise<DailyAction | null> {
  const { data, error } = await supabase
    .from("daily_actions")
    .select("*")
    .eq("user_id", userId)
    .eq("action_date", today)
    .eq("is_primary", true)
    .neq("status", "replaced")
    .maybeSingle();
  if (error) fail("load today action", error);
  return data;
}

/** Returns today's action, generating one if the user doesn't have it yet. */
export async function ensureTodayAction(
  supabase: Db,
  userId: string,
): Promise<DailyAction> {
  const ctx = await loadMentorContext(supabase, userId);
  const existing = await getTodayAction(supabase, userId, ctx.today);
  if (existing) return existing;

  const { draft, usedFallback } = await draftDailyAction(ctx, {
    difficulty: "standard",
    avoidTitles: ctx.recentActions.map((a) => a.title),
  });
  const created = await insertTodayAction(
    supabase,
    userId,
    ctx.today,
    draft,
    milestoneRefs(ctx),
    usedFallback,
  );
  return created ?? (await getTodayAction(supabase, userId, ctx.today))!;
}

export async function completeAction(
  supabase: Db,
  userId: string,
  actionId: string,
  reflection?: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("daily_actions")
    .update({ status: "completed", completed_at: now })
    .eq("id", actionId)
    .eq("user_id", userId)
    .in("status", ["pending", "skipped"])
    .select("id, milestone_id")
    .maybeSingle();
  if (error) fail("complete action", error);
  if (!data) return; // already completed or not found
  await supabase.from("action_completions").upsert(
    {
      action_id: actionId,
      user_id: userId,
      completed_at: now,
      reflection: reflection?.trim() || null,
    },
    { onConflict: "action_id" },
  );
  if (data.milestone_id) {
    await supabase
      .from("roadmap_milestones")
      .update({ status: "in_progress" })
      .eq("id", data.milestone_id)
      .eq("status", "not_started");
  }
}

export async function undoCompleteAction(
  supabase: Db,
  userId: string,
  actionId: string,
): Promise<void> {
  const { error } = await supabase
    .from("daily_actions")
    .update({ status: "pending", completed_at: null })
    .eq("id", actionId)
    .eq("user_id", userId)
    .eq("status", "completed");
  if (error) fail("undo action", error);
  await supabase
    .from("action_completions")
    .delete()
    .eq("action_id", actionId)
    .eq("user_id", userId);
}

export async function skipAction(
  supabase: Db,
  userId: string,
  actionId: string,
  reason?: string | null,
) {
  const { error } = await supabase
    .from("daily_actions")
    .update({ status: "skipped", skip_reason: reason?.trim() || null })
    .eq("id", actionId)
    .eq("user_id", userId)
    .eq("status", "pending");
  if (error) fail("skip action", error);
}

/**
 * Replaces today's action with a different one, or a lighter / stretch
 * version of the same idea. The old action is kept as history.
 */
export async function replaceAction(
  supabase: Db,
  userId: string,
  actionId: string,
  mode: "different" | "lighter" | "stretch",
): Promise<DailyAction> {
  const { data: current, error } = await supabase
    .from("daily_actions")
    .select("*")
    .eq("id", actionId)
    .eq("user_id", userId)
    .single();
  if (error || !current) fail("load action", error);
  if (current.status === "replaced")
    throw new Error("Action was already replaced");

  const ctx = await loadMentorContext(supabase, userId);
  const history = await supabase
    .from("daily_actions")
    .select("title")
    .eq("user_id", userId)
    .eq("action_date", current.action_date);
  const avoidTitles = [
    ...new Set([
      ...(history.data ?? []).map((h) => h.title),
      ...ctx.recentActions.map((a) => a.title),
    ]),
  ];

  const difficulty: Difficulty =
    mode === "different" ? current.difficulty : mode;
  const { draft, usedFallback } = await draftDailyAction(
    {
      ...ctx,
      recentActions: [
        {
          date: current.action_date,
          title: current.title,
          category: current.category,
          status: current.status,
        },
        ...ctx.recentActions,
      ],
    },
    {
      difficulty,
      replacing: {
        title: current.title,
        reason: mode,
        milestoneId: current.milestone_id,
      },
      avoidTitles,
    },
  );

  // Retire the current action first (one live primary action per day).
  const retire = await supabase
    .from("daily_actions")
    .update({ status: "replaced" })
    .eq("id", current.id)
    .eq("user_id", userId);
  if (retire.error) fail("retire action", retire.error);

  const refs = milestoneRefs(ctx);
  const created = await insertTodayAction(
    supabase,
    userId,
    current.action_date,
    // Keep the milestone link when resizing the same idea.
    mode === "different"
      ? draft
      : {
          ...draft,
          milestone_ref: draft.milestone_ref ?? current.milestone_id,
        },
    refs,
    usedFallback,
  );
  if (!created) throw new Error("Could not create replacement action");
  await supabase
    .from("daily_actions")
    .update({ replaced_by_id: created.id })
    .eq("id", current.id);
  return created;
}

// ---------------------------------------------------------------------------
// Weekly priorities
// ---------------------------------------------------------------------------
export async function ensureWeeklyPriorities(
  supabase: Db,
  userId: string,
): Promise<Tables<"weekly_priorities">[]> {
  const ctx = await loadMentorContext(supabase, userId);
  const week = weekStart(ctx.today);
  const existing = await supabase
    .from("weekly_priorities")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", week)
    .order("position");
  if (existing.error) fail("load priorities", existing.error);
  if (existing.data.length || !ctx.roadmap) return existing.data;

  const open = ctx.roadmap.milestones.filter(
    (m) => m.status !== "completed" && m.status !== "skipped",
  );
  const result = await getAIProvider().generateObject({
    task: "weekly_priorities",
    system: MENTOR_PERSONA,
    prompt: weeklyPrioritiesPrompt(ctx, week),
    schema: weeklyPrioritiesDraft,
    fallback: () => ({
      priorities: rulesWeeklyPriorities(
        ctx,
        open.map((m) => ({
          key: m.id,
          horizon: m.horizon,
          title: m.title,
          description: "",
          why: `This moves “${m.title}” forward.`,
          category: m.category,
          parent_key: null,
        })),
      ),
    }),
  });
  const priorities = result.data.priorities.slice(0, 5);
  await replaceWeeklyPriorities(
    supabase,
    userId,
    week,
    priorities,
    milestoneRefs(ctx),
    result.usedFallback,
  );
  const reloaded = await supabase
    .from("weekly_priorities")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", week)
    .order("position");
  return reloaded.data ?? [];
}

export async function saveReflection(
  supabase: Db,
  userId: string,
  actionId: string,
  reflection: string,
) {
  const { error } = await supabase
    .from("action_completions")
    .update({ reflection: reflection.trim().slice(0, 1000) || null })
    .eq("action_id", actionId)
    .eq("user_id", userId);
  if (error) fail("save reflection", error);
}
