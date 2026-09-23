import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/app/page";
import { NotificationForm } from "@/components/profile/notification-form";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationSettingsPage() {
  const user = await requireOnboardedUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const prefs = data ?? {
    daily_reminder: "off" as const,
    daily_reminder_time: "09:00",
    opportunity_alerts: "important" as const,
    industry_updates: "weekly_digest" as const,
    weekly_checkin: true,
    weekly_checkin_day: 7,
    channel_email: true,
  };
  return (
    <PageContainer>
      <PageHeader
        title="Notifications"
        description="Low-frequency by default. You’re in control."
      />
      <NotificationForm
        initial={{
          daily_reminder: prefs.daily_reminder,
          daily_reminder_time: prefs.daily_reminder_time,
          opportunity_alerts: prefs.opportunity_alerts,
          industry_updates: prefs.industry_updates,
          weekly_checkin: prefs.weekly_checkin,
          weekly_checkin_day: prefs.weekly_checkin_day,
          channel_email: prefs.channel_email,
        }}
      />
    </PageContainer>
  );
}
