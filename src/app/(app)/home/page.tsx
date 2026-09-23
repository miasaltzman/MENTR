import { ArrowRight, CalendarCheck, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageContainer, Section } from "@/components/app/page";
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
      ? `Building: ${b.ventureIdea}`
      : "Finding a business idea worth building.";
  }
  if (b.roadmap?.mode === "exploring") {
    return b.interests.length
      ? `Exploring ${b.interests.slice(0, 2).join(" and ")}.`
      : "Figuring out what’s next, one small step at a time.";
  }
  const target = b.interests[0];
  return target ? `Focused on ${target}.` : (b.roadmap?.northStar ?? null);
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
  const steps = basics.progress.totalCompleted;

  return (
    <PageContainer>
      <header>
        <h1 className="text-display text-[2.75rem] sm:text-6xl">
          {greetingFor(basics.hour)}
          {basics.firstName ? `, ${basics.firstName}` : ""}.
        </h1>
        {line ? (
          <p className="mt-3 text-lg text-pretty text-muted-foreground">
            {line}
          </p>
        ) : null}
      </header>

      {basics.checkinDue ? (
        <Link
          href="/checkin"
          className="group mt-8 flex items-center gap-3 text-sm font-medium text-primary"
        >
          <CalendarCheck className="size-4" />
          Your weekly check-in is ready — two minutes
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}

      <div className="mt-10">
        <Suspense fallback={<TodayActionSkeleton />}>
          <TodaySection userId={user.id} totalCompleted={steps} />
        </Suspense>
      </div>

      <Section title="This week">
        <Suspense fallback={<ListSkeleton />}>
          <PrioritiesSection userId={user.id} />
        </Suspense>
      </Section>

      {basics.roadmap ? (
        <Section title="Where you’re headed">
          <RoadmapSnapshot roadmap={basics.roadmap} isStudent={isStudent} />
        </Section>
      ) : null}

      <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-sm text-muted-foreground">
        <span>
          {steps > 0
            ? `${steps} ${steps === 1 ? "step" : "steps"} taken so far`
            : "Your first step is above"}
        </span>
        <Link
          href={`/mentor?q=${encodeURIComponent(PROMPTS[promptKey][0])}`}
          className="group inline-flex items-center gap-1.5 font-medium hover:text-foreground"
        >
          <MessageCircle className="size-4" />
          Ask Mentr: “{PROMPTS[promptKey][0]}”
        </Link>
      </footer>
    </PageContainer>
  );
}
