import "server-only";
import { cache } from "react";
import { localDate, localHour, weekStart } from "@/lib/domain/dates";
import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/types/database";

export type RoadmapSummary = {
  id: string;
  title: string;
  northStar: string | null;
  mode: "directed" | "exploring";
  total: number;
  completed: number;
  current: Pick<
    Tables<"roadmap_milestones">,
    "id" | "title" | "horizon" | "status" | "why"
  > | null;
};

export type Progress = {
  totalCompleted: number;
  byCategory: Partial<Record<Enums<"action_category">, number>>;
  activeDaysLast7: number;
  milestonesCompleted: number;
};

const NEAR_FIRST: Enums<"horizon">[] = [
  "week",
  "month",
  "term",
  "year",
  "long_term",
];

export const loadHomeBasics = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("first_name, timezone, user_type")
    .eq("id", userId)
    .single();
  if (error || !profile) throw new Error("Profile not found");

  const today = localDate(profile.timezone);
  const week = weekStart(today);

  const [roadmap, progress, interests, venture, education, checkin, prefs] =
    await Promise.all([
      supabase
        .from("roadmaps")
        .select(
          "id, title, north_star, mode, roadmap_milestones(id, title, horizon, status, why, position)",
        )
        .eq("user_id", userId)
        .eq("kind", "career")
        .eq("status", "active")
        .maybeSingle(),
      supabase.rpc("get_progress_summary", { p_today: today }),
      supabase
        .from("career_interests")
        .select("label")
        .eq("user_id", userId)
        .order("position")
        .limit(3),
      supabase
        .from("venture_profiles")
        .select("idea_summary")
        .eq("user_id", userId)
        .eq("is_primary", true)
        .maybeSingle(),
      supabase
        .from("education_profiles")
        .select("university_id, universities(name)")
        .eq("user_id", userId)
        .eq("is_current", true)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("weekly_checkins")
        .select("completed_at")
        .eq("user_id", userId)
        .eq("week_start", week)
        .maybeSingle(),
      supabase
        .from("notification_preferences")
        .select("weekly_checkin, weekly_checkin_day")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  let roadmapSummary: RoadmapSummary | null = null;
  if (roadmap.data) {
    const ms = roadmap.data.roadmap_milestones;
    const open = (s: string) => s === "not_started" || s === "in_progress";
    const byNear = [...ms].sort(
      (a, b) =>
        NEAR_FIRST.indexOf(a.horizon) - NEAR_FIRST.indexOf(b.horizon) ||
        a.position - b.position,
    );
    const current =
      byNear.find(
        (m) => m.status === "in_progress" && m.horizon !== "long_term",
      ) ??
      byNear.find((m) => open(m.status) && m.horizon !== "long_term") ??
      null;
    roadmapSummary = {
      id: roadmap.data.id,
      title: roadmap.data.title,
      northStar: roadmap.data.north_star,
      mode: roadmap.data.mode === "exploring" ? "exploring" : "directed",
      total: ms.filter((m) => m.status !== "skipped").length,
      completed: ms.filter((m) => m.status === "completed").length,
      current: current
        ? {
            id: current.id,
            title: current.title,
            horizon: current.horizon,
            status: current.status,
            why: current.why,
          }
        : null,
    };
  }

  const p = (progress.data ?? {}) as Record<string, unknown>;
  const progressSummary: Progress = {
    totalCompleted: Number(p.total_completed ?? 0),
    byCategory: (p.by_category ?? {}) as Progress["byCategory"],
    activeDaysLast7: Number(p.active_days_last_7 ?? 0),
    milestonesCompleted: Number(p.milestones_completed ?? 0),
  };

  const hour = localHour(profile.timezone);
  // ISO day of week in the user's timezone (1 = Monday ... 7 = Sunday).
  const isoDow = new Date(`${today}T12:00:00Z`).getUTCDay() || 7;
  const checkinDay = prefs.data?.weekly_checkin_day ?? 7;
  return {
    today,
    week,
    hour,
    firstName: profile.first_name,
    userType: profile.user_type,
    roadmap: roadmapSummary,
    progress: progressSummary,
    interests: (interests.data ?? []).map((i) => i.label),
    ventureIdea: venture.data?.idea_summary ?? null,
    university: education.data?.universities
      ? {
          id: education.data.university_id!,
          name: education.data.universities.name,
        }
      : null,
    // Offered from the chosen day through the end of the week, until done.
    checkinDue:
      (prefs.data?.weekly_checkin ?? true) &&
      !checkin.data?.completed_at &&
      isoDow >= checkinDay,
  };
});

export type HomeBasics = Awaited<ReturnType<typeof loadHomeBasics>>;
