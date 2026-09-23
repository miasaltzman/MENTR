import {
  ArrowRight,
  CalendarCheck,
  GraduationCap,
  MessageCircle,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageContainer, Section } from "@/components/app/page";
import { ProgressSummary } from "@/components/dashboard/progress-summary";
import { RoadmapSnapshot } from "@/components/dashboard/roadmap-snapshot";
import {
  TodayActionCard,
  TodayActionSkeleton,
} from "@/components/dashboard/today-action-card";
import { WeeklyPriorities } from "@/components/dashboard/weekly-priorities";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { loadHomeBasics, type HomeBasics } from "@/lib/data/dashboard";
import { greetingFor } from "@/lib/domain/dates";
import { STUDENT_TYPES } from "@/lib/domain/labels";
import { ensureTodayAction, ensureWeeklyPriorities } from "@/lib/plan/service";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Home" };
export const maxDuration = 60;

function contextLine(b: HomeBasics): string | null {
  if (b.userType === "entrepreneur") {
    return b.ventureIdea
      ? `You’re building: ${b.ventureIdea}`
      : "You’re looking for a business idea worth building.";
  }
  if (b.roadmap?.mode === "exploring") {
    return b.interests.length
      ? `You’re exploring a few directions, including ${b.interests.slice(0, 2).join(" and ")}.`
      : "You’re figuring out what’s next — one small experiment at a time.";
  }
  const target = b.interests[0];
  return target
    ? `You’re working toward ${target}.`
    : (b.roadmap?.northStar ?? null);
}

const PROMPTS: Record<string, string[]> = {
  student: [
    "What should I do this summer?",
    "Give me a project idea",
    "Help me prepare for a career fair",
  ],
  exploring: [
    "I have no idea what career I want",
    "Help me compare two paths",
    "What should I do this week?",
  ],
  founder: [
    "Help me validate my idea",
    "How should I price this?",
    "What should I do this week?",
  ],
  pro: [
    "How do I position myself for my next role?",
    "Help me prepare for a networking chat",
    "What skills should I learn?",
  ],
};

async function TodaySection({
  userId,
  totalCompleted,
}: {
  userId: string;
  totalCompleted: number;
}) {
  const supabase = await createClient();
  const action = await ensureTodayAction(supabase, userId);
  let milestoneTitle: string | null = null;
  if (action.milestone_id) {
    const { data } = await supabase
      .from("roadmap_milestones")
      .select("title")
      .eq("id", action.milestone_id)
      .maybeSingle();
    milestoneTitle = data?.title ?? null;
  }
  return (
    <TodayActionCard
      action={action}
      milestoneTitle={milestoneTitle}
      totalCompleted={totalCompleted}
    />
  );
}

async function PrioritiesSection({ userId }: { userId: string }) {
  const supabase = await createClient();
  const priorities = await ensureWeeklyPriorities(supabase, userId);
  return <WeeklyPriorities priorities={priorities} />;
}

function ListSkeleton() {
  return (
    <div className="space-y-2 rounded-2xl border bg-card p-4" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-5 animate-pulse rounded bg-muted"
          style={{ width: `${80 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

export default async function HomePage() {
  const user = await requireOnboardedUser();
  const basics = await loadHomeBasics(user.id);
  const isStudent = basics.userType
    ? STUDENT_TYPES.has(basics.userType)
    : false;
  const line = contextLine(basics);
  const promptKey =
    basics.userType === "entrepreneur"
      ? "founder"
      : basics.roadmap?.mode === "exploring"
        ? "exploring"
        : basics.userType === "working_professional" ||
            basics.userType === "career_changer"
          ? "pro"
          : "student";

  return (
    <PageContainer>
      <header>
        <h1 className="text-3xl font-semibold sm:text-4xl">
          {greetingFor(basics.hour)}
          {basics.firstName ? `, ${basics.firstName}` : ""}.
        </h1>
        {line ? (
          <p className="mt-2 text-pretty text-muted-foreground">{line}</p>
        ) : null}
      </header>

      {basics.checkinDue ? (
        <Link
          href="/checkin"
          className="mt-6 flex items-center gap-3 rounded-2xl border border-primary/25 bg-accent/60 p-4 transition-colors hover:bg-accent"
        >
          <CalendarCheck className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">
              Your weekly check-in is ready
            </span>
            <span className="block text-sm text-muted-foreground">
              Two minutes to look back and set up next week.
            </span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>
      ) : null}

      <div className="mt-8">
        <Suspense fallback={<TodayActionSkeleton />}>
          <TodaySection
            userId={user.id}
            totalCompleted={basics.progress.totalCompleted}
          />
        </Suspense>
      </div>

      <Section title="This week">
        <Suspense fallback={<ListSkeleton />}>
          <PrioritiesSection userId={user.id} />
        </Suspense>
      </Section>

      {basics.roadmap ? (
        <Section title="Your roadmap">
          <RoadmapSnapshot roadmap={basics.roadmap} isStudent={isStudent} />
        </Section>
      ) : null}

      <Section title="Your progress">
        <ProgressSummary progress={basics.progress} />
      </Section>

      <Section title="Recommended for you">
        <div className="grid gap-3 sm:grid-cols-2">
          {basics.university ? (
            <Link
              href="/explore/campus"
              className="group rounded-2xl border bg-card p-4 transition-colors hover:border-primary/30"
            >
              <GraduationCap className="size-5 text-primary" />
              <p className="mt-3 font-medium">Your campus resources</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Career center, advising, and more at {basics.university.name}.
              </p>
            </Link>
          ) : null}
          <div className="rounded-2xl border bg-card p-4">
            <MessageCircle className="size-5 text-primary" />
            <p className="mt-3 font-medium">Ask your mentor</p>
            <ul className="mt-2 space-y-1.5">
              {PROMPTS[promptKey].map((q) => (
                <li key={q}>
                  <Link
                    href={`/mentor?q=${encodeURIComponent(q)}`}
                    className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    “{q}”
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
    </PageContainer>
  );
}
