import {
  Bell,
  CalendarCheck,
  ChevronRight,
  ExternalLink,
  LogOut,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, Section } from "@/components/app/page";
import { ProgressSummary } from "@/components/dashboard/progress-summary";
import { MemoryList } from "@/components/profile/memory-list";
import { ProfileAnswers } from "@/components/profile/profile-answers";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { loadHomeBasics } from "@/lib/data/dashboard";
import { USER_TYPE_LABELS } from "@/lib/domain/labels";
import { loadAnswers } from "@/lib/onboarding/answers";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Profile" };
export const maxDuration = 120;

export default async function ProfilePage() {
  const user = await requireOnboardedUser();
  const supabase = await createClient();
  const [basics, answers, { data: memories }, { data: saved }] =
    await Promise.all([
      loadHomeBasics(user.id),
      loadAnswers(supabase, user.id),
      supabase
        .from("mentor_memories")
        .select("id, content")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("saved_resources")
        .select("id, university_resources(name, url), resources(title, url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

  const initial = (basics.firstName ?? user.email ?? "?")
    .charAt(0)
    .toUpperCase();
  const subtitle = [
    basics.userType ? USER_TYPE_LABELS[basics.userType] : null,
    basics.university?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PageContainer>
      <header className="flex items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
          {initial}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">
            {basics.firstName ?? "Your profile"}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {subtitle || user.email}
          </p>
        </div>
      </header>

      <Section title="Progress">
        <ProgressSummary progress={basics.progress} />
      </Section>

      <Section title="About you">
        <p className="mb-3 text-sm text-muted-foreground">
          This is what Mentr uses to personalize your plan. Edit anything,
          anytime — “not sure yet” is always fine.
        </p>
        <ProfileAnswers initialAnswers={answers} />
      </Section>

      <Section title="What Mentr remembers">
        <MemoryList memories={memories ?? []} />
      </Section>

      <Section title="Saved">
        {saved?.length ? (
          <ul className="divide-y rounded-2xl border bg-card">
            {saved.map((s) => {
              const item = s.university_resources
                ? {
                    name: s.university_resources.name,
                    url: s.university_resources.url,
                  }
                : s.resources
                  ? { name: s.resources.title, url: s.resources.url }
                  : null;
              if (!item) return null;
              return (
                <li key={s.id}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/40"
                  >
                    {item.name}
                    <ExternalLink className="size-4 text-muted-foreground" />
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Resources you save will show up here.
          </p>
        )}
      </Section>

      <Section title="Settings">
        <div className="divide-y rounded-2xl border bg-card">
          <Link
            href="/checkin"
            className="flex items-center gap-3 px-4 py-3.5 text-sm hover:bg-muted/40"
          >
            <CalendarCheck className="size-4 text-muted-foreground" />
            <span className="flex-1">Weekly check-in</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
          <Link
            href="/settings/notifications"
            className="flex items-center gap-3 px-4 py-3.5 text-sm hover:bg-muted/40"
          >
            <Bell className="size-4 text-muted-foreground" />
            <span className="flex-1">Notifications</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              className="h-auto w-full justify-start gap-3 rounded-none px-4 py-3.5 font-normal"
            >
              <LogOut className="size-4 text-muted-foreground" />
              Sign out
            </Button>
          </form>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Signed in as {user.email}
        </p>
      </Section>
    </PageContainer>
  );
}
