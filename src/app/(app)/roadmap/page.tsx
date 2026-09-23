import { ArrowRight, Compass, History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer } from "@/components/app/page";
import { AddMilestone } from "@/components/roadmap/add-milestone";
import { MilestoneItem } from "@/components/roadmap/milestone-item";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { localDate, weekStart } from "@/lib/domain/dates";
import { horizonLabel, STUDENT_TYPES } from "@/lib/domain/labels";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";

export const metadata: Metadata = { title: "Roadmap" };

const PLANNED: Exclude<Enums<"horizon">, "today" | "week">[] = [
  "long_term",
  "year",
  "term",
  "month",
];

const HORIZON_HINT: Record<string, string> = {
  long_term: "3–5 years",
  year: "Next 12 months",
  term: "Next few months",
  month: "Next few weeks",
};

export default async function RoadmapPage() {
  const user = await requireOnboardedUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, user_type")
    .eq("id", user.id)
    .single();
  const today = localDate(profile?.timezone);
  const isStudent = profile?.user_type
    ? STUDENT_TYPES.has(profile.user_type)
    : false;

  const { data: roadmap } = await supabase
    .from("roadmaps")
    .select(
      "id, title, north_star, mode, updated_at, roadmap_milestones(id, title, description, why, status, origin, horizon, position), roadmap_revisions(summary, cause, created_at)",
    )
    .eq("user_id", user.id)
    .eq("kind", "career")
    .eq("status", "active")
    .order("created_at", {
      referencedTable: "roadmap_revisions",
      ascending: false,
    })
    .limit(3, { referencedTable: "roadmap_revisions" })
    .maybeSingle();

  if (!roadmap) {
    return (
      <PageContainer>
        <h1 className="text-3xl font-semibold">Roadmap</h1>
        <p className="mt-3 text-muted-foreground">
          Your roadmap will appear here once your first plan is ready.
        </p>
      </PageContainer>
    );
  }

  const [{ data: priorities }, { data: todayAction }] = await Promise.all([
    supabase
      .from("weekly_priorities")
      .select("id, title, status")
      .eq("user_id", user.id)
      .eq("week_start", weekStart(today))
      .order("position"),
    supabase
      .from("daily_actions")
      .select("title, status")
      .eq("user_id", user.id)
      .eq("action_date", today)
      .eq("is_primary", true)
      .neq("status", "replaced")
      .maybeSingle(),
  ]);

  const byHorizon = (h: Enums<"horizon">) =>
    roadmap.roadmap_milestones
      .filter((m) => m.horizon === h)
      .sort((a, b) => a.position - b.position);
  const total = roadmap.roadmap_milestones.filter(
    (m) => m.status !== "skipped",
  ).length;
  const completed = roadmap.roadmap_milestones.filter(
    (m) => m.status === "completed",
  ).length;

  return (
    <PageContainer>
      <header>
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          {roadmap.mode === "exploring" ? (
            <>
              <Compass className="size-4" /> Exploration mode
            </>
          ) : (
            "Your roadmap"
          )}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{roadmap.title}</h1>
        {roadmap.north_star ? (
          <p className="mt-2 text-pretty text-muted-foreground">
            {roadmap.north_star}
          </p>
        ) : null}
        <p className="mt-3 text-sm text-muted-foreground tabular-nums">
          {completed} of {total} milestones complete
        </p>
      </header>

      {roadmap.mode === "exploring" ? (
        <p className="mt-6 rounded-xl bg-muted/60 p-4 text-sm text-pretty text-muted-foreground">
          This plan is built for discovery. As you learn what energizes you,
          Mentr will help you turn it into a more specific path — no need to
          decide everything now.
        </p>
      ) : null}

      <ol className="relative mt-10 space-y-10 border-l border-dashed pl-6 sm:pl-8">
        {PLANNED.map((h) => {
          const items = byHorizon(h);
          const label = horizonLabel(h, isStudent);
          return (
            <li key={h} className="relative">
              <span className="absolute top-1.5 -left-[31px] size-3 rounded-full border-2 border-background bg-primary/60 ring-4 ring-background sm:-left-[39px]" />
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold">{label}</h2>
                <span className="text-xs text-muted-foreground">
                  {HORIZON_HINT[h]}
                </span>
              </div>
              {items.length ? (
                <ul className="space-y-2">
                  {items.map((m) => (
                    <MilestoneItem key={m.id} milestone={m} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nothing here yet.
                </p>
              )}
              <div className="mt-2">
                <AddMilestone horizon={h} label={label} />
              </div>
            </li>
          );
        })}

        <li className="relative">
          <span className="absolute top-1.5 -left-[31px] size-3 rounded-full border-2 border-background bg-primary ring-4 ring-background sm:-left-[39px]" />
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">This week</h2>
            <Link href="/home" className="text-xs font-medium text-primary">
              Manage on Home
            </Link>
          </div>
          {priorities?.length ? (
            <ul className="space-y-1.5 text-sm">
              {priorities.map((p) => (
                <li
                  key={p.id}
                  className={cn(
                    "flex gap-2",
                    p.status === "done" && "text-muted-foreground line-through",
                  )}
                >
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
                  {p.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              This week’s priorities appear on your home screen.
            </p>
          )}
        </li>

        <li className="relative">
          <span className="absolute top-1.5 -left-[33px] size-4 rounded-full border-2 border-background bg-highlight ring-4 ring-background sm:-left-[41px]" />
          <h2 className="mb-3 text-lg font-semibold">Today</h2>
          <Link
            href="/home"
            className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/30"
          >
            <span
              className={cn(
                "font-medium",
                todayAction?.status === "completed" &&
                  "text-muted-foreground line-through",
              )}
            >
              {todayAction?.title ?? "Open Home to get today’s 1% action"}
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      </ol>

      {roadmap.roadmap_revisions.length ? (
        <section className="mt-12 rounded-2xl border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4 text-muted-foreground" />
            Recent changes
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {roadmap.roadmap_revisions.map((r) => (
              <li key={r.created_at} className="flex justify-between gap-4">
                <span className="line-clamp-2 text-muted-foreground">
                  {r.summary}
                </span>
                <time
                  className="shrink-0 text-xs text-muted-foreground"
                  dateTime={r.created_at}
                >
                  {new Date(r.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageContainer>
  );
}
