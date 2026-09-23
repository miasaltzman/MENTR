import "server-only";
import { type MentorContext, renderMentorContext } from "@/lib/ai/context";
import { MENTOR_PERSONA } from "@/lib/ai/prompts/persona";
import { getAIProvider } from "@/lib/ai/provider";
import { loadMentorContext } from "@/lib/data/mentor-context";
import { addDays, weekStart } from "@/lib/domain/dates";
import { extractMemories } from "@/lib/mentor/service";
import { rulesWeeklyPriorities } from "@/lib/plan/rules";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import {
  type CheckinAnswers,
  type CheckinReview,
  checkinReview,
} from "./schemas";

/** Friday–Sunday check-ins plan the coming week; earlier ones adjust this week. */
export function targetWeek(today: string): string {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const current = weekStart(today);
  return dow === 5 || dow === 6 || dow === 0 ? addDays(current, 7) : current;
}

export function rulesCheckinReview(
  ctx: MentorContext,
  answers: CheckinAnswers,
): CheckinReview {
  const open = (ctx.roadmap?.milestones ?? []).filter(
    (m) => m.status !== "completed" && m.status !== "skipped",
  );
  const done = ctx.progress.activeDaysLast7;
  const base = rulesWeeklyPriorities(
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
  );
  const priorities = answers.nextPriority
    ? [
        {
          title: answers.nextPriority,
          why: "You named this as your biggest priority.",
          category: "career_exploration" as const,
          milestone_key: null,
        },
        ...base,
      ].slice(0, 5)
    : base;
  const rhythm =
    done >= 4
      ? `You were active on ${done} of the last 7 days — that consistency is what compounds.`
      : done > 0
        ? `You showed up on ${done} of the last 7 days. Next week, aim for one small step on most days rather than a big push.`
        : "This week was quiet, and that’s okay. Next week, start with one small step on Monday.";
  const hard = answers.difficulties
    ? " I’ve kept next week’s priorities small given what felt hard."
    : "";
  const reported =
    answers.progress.length > 140
      ? `${answers.progress.slice(0, 139)}…`
      : answers.progress;
  const progress = reported
    ? `Good to hear you moved forward: “${reported}” `
    : "";
  // Don't call a week "quiet" when the user just told us what they did.
  const rhythmText =
    reported && done === 0
      ? "Logging your 1% actions will help me see that progress next time."
      : rhythm;
  return {
    mentor_note: `${progress}${rhythmText}${hard}`,
    next_week_priorities: priorities,
    milestone_updates: [],
    new_milestones: [],
  };
}

function reviewPrompt(
  ctx: MentorContext,
  a: CheckinAnswers,
  week: string,
): string {
  const open = (ctx.roadmap?.milestones ?? []).filter(
    (m) => m.status !== "completed" && m.status !== "skipped",
  );
  return `<user_context>
${renderMentorContext(ctx)}
</user_context>

<open_milestones>
${open.map((m) => `- id: ${m.id} | ${m.horizon} | ${m.title} | ${m.status}`).join("\n") || "(none)"}
</open_milestones>

<weekly_checkin>
What they made progress on: ${a.progress || "(no answer)"}
What changed about what they want: ${a.changes || "(no answer)"}
What felt difficult: ${a.difficulties || "(no answer)"}
Biggest priority next: ${a.nextPriority || "(no answer)"}
</weekly_checkin>

Review their week and set up the week starting ${week}.
- Write a short, honest mentor note (no empty praise).
- Propose 3–5 priorities for that week. Include their stated priority if they gave one. Link each to a milestone id when it advances one.
- Only update a milestone's status when their answers clearly say so (e.g. they finished it). Use the exact ids above.
- Add at most 2 new milestones, only if their goals changed or something important is clearly missing.
- If something felt hard, make next week lighter rather than heavier.
- Don’t invent specific organizations, opportunities, or URLs.`;
}

export type CheckinResult = {
  mentorNote: string;
  week: string;
  priorities: string[];
  changes: string[];
};

export async function runCheckin(
  supabase: ServerSupabase,
  userId: string,
  answers: CheckinAnswers,
): Promise<CheckinResult> {
  const ctx = await loadMentorContext(supabase, userId);
  const reviewedWeek = weekStart(ctx.today);
  const planWeek = targetWeek(ctx.today);

  const result = await getAIProvider().generateObject({
    task: "checkin_review",
    system: MENTOR_PERSONA,
    prompt: reviewPrompt(ctx, answers, planWeek),
    schema: checkinReview,
    fallback: () => rulesCheckinReview(ctx, answers),
  });
  const review = result.data;
  const origin = result.usedFallback
    ? ("system" as const)
    : ("checkin" as const);
  const openIds = new Set(
    (ctx.roadmap?.milestones ?? [])
      .filter((m) => m.status !== "completed" && m.status !== "skipped")
      .map((m) => m.id),
  );
  const titleById = new Map(
    (ctx.roadmap?.milestones ?? []).map((m) => [m.id, m.title]),
  );
  const changes: string[] = [];

  if (ctx.roadmap) {
    for (const u of review.milestone_updates
      .filter((x) => openIds.has(x.milestone_id))
      .slice(0, 5)) {
      const { error } = await supabase
        .from("roadmap_milestones")
        .update({
          status: u.status,
          completed_at:
            u.status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", u.milestone_id)
        .eq("user_id", userId);
      if (!error) {
        const verb =
          u.status === "completed"
            ? "Marked done"
            : u.status === "skipped"
              ? "Set aside"
              : "Started";
        changes.push(`${verb}: ${titleById.get(u.milestone_id)}`);
      }
    }
    for (const m of review.new_milestones.slice(0, 2)) {
      const title = m.title.trim().slice(0, 200);
      if (!title) continue;
      const { error } = await supabase.from("roadmap_milestones").insert({
        roadmap_id: ctx.roadmap.id,
        user_id: userId,
        horizon: m.horizon,
        title,
        why: m.why.slice(0, 500),
        category: m.category,
        position: 99,
        origin,
      });
      if (!error) changes.push(`Added: ${title}`);
    }
  }

  const priorities = review.next_week_priorities
    .slice(0, 5)
    .filter((p) => p.title.trim());
  await supabase
    .from("weekly_priorities")
    .delete()
    .eq("user_id", userId)
    .eq("week_start", planWeek)
    .eq("status", "open");
  if (priorities.length) {
    await supabase.from("weekly_priorities").insert(
      priorities.map((p, i) => ({
        user_id: userId,
        week_start: planWeek,
        title: p.title.slice(0, 300),
        why: p.why.slice(0, 400),
        category: p.category,
        milestone_id:
          p.milestone_key && openIds.has(p.milestone_key)
            ? p.milestone_key
            : null,
        position: i,
        origin,
      })),
    );
  }

  const note = review.mentor_note.trim().slice(0, 1500);
  if (ctx.roadmap) {
    await supabase.from("roadmap_revisions").insert({
      roadmap_id: ctx.roadmap.id,
      user_id: userId,
      cause: "checkin",
      summary: changes.length
        ? `Weekly check-in: ${changes.join("; ")}`
        : "Weekly check-in: priorities updated",
      changes: changes as unknown as Json,
    });
  }

  const { error } = await supabase.from("weekly_checkins").upsert(
    {
      user_id: userId,
      week_start: reviewedWeek,
      progress_note: answers.progress || null,
      changes_note: answers.changes || null,
      difficulties_note: answers.difficulties || null,
      next_priority_note: answers.nextPriority || null,
      mentor_summary: note,
      applied_changes: {
        changes,
        priorities: priorities.map((p) => p.title),
        plan_week: planWeek,
      } as unknown as Json,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_start" },
  );
  if (error) throw new Error(`save checkin: ${error.message}`);

  // Remember durable facts from what they shared (best effort).
  const shared = [
    answers.progress,
    answers.changes,
    answers.difficulties,
    answers.nextPriority,
  ]
    .filter(Boolean)
    .join("\n");
  if (shared) {
    const { data: conv } = await supabase
      .from("mentor_conversations")
      .insert({
        user_id: userId,
        kind: "checkin",
        title: `Check-in ${reviewedWeek}`,
      })
      .select("id")
      .single();
    if (conv) {
      const { data: msg } = await supabase
        .from("mentor_messages")
        .insert({
          conversation_id: conv.id,
          user_id: userId,
          role: "user",
          content: shared,
        })
        .select("id")
        .single();
      await supabase.from("mentor_messages").insert({
        conversation_id: conv.id,
        user_id: userId,
        role: "assistant",
        content: note,
      });
      if (msg)
        await extractMemories(
          supabase,
          userId,
          ctx,
          shared,
          note,
          msg.id,
        ).catch(() => undefined);
    }
  }

  return {
    mentorNote: note,
    week: planWeek,
    priorities: priorities.map((p) => p.title),
    changes,
  };
}
