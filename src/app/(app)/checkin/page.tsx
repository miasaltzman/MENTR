import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/app/page";
import {
  CheckinForm,
  CheckinResultView,
} from "@/components/checkin/checkin-form";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { localDate, weekStart } from "@/lib/domain/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Weekly check-in" };
export const maxDuration = 60;

export default async function CheckinPage() {
  const user = await requireOnboardedUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const week = weekStart(localDate(profile?.timezone));
  const { data: done } = await supabase
    .from("weekly_checkins")
    .select("mentor_summary, applied_changes, completed_at")
    .eq("user_id", user.id)
    .eq("week_start", week)
    .maybeSingle();

  const applied = (done?.applied_changes ?? {}) as {
    changes?: string[];
    priorities?: string[];
    plan_week?: string;
  };

  return (
    <PageContainer>
      <PageHeader
        title="Weekly check-in"
        description={
          done?.completed_at
            ? "You’ve checked in this week. Here’s what we set up."
            : "Two minutes to look back and set up next week."
        }
      />
      {done?.completed_at ? (
        <CheckinResultView
          result={{
            mentorNote: done.mentor_summary ?? "",
            week: applied.plan_week ?? week,
            priorities: applied.priorities ?? [],
            changes: applied.changes ?? [],
          }}
        />
      ) : (
        <CheckinForm />
      )}
    </PageContainer>
  );
}
