"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveNotificationPreferences } from "@/lib/profile/actions";
import { cn } from "@/lib/utils";

type Prefs = {
  daily_reminder: "off" | "daily";
  daily_reminder_time: string;
  opportunity_alerts: "off" | "important" | "all";
  industry_updates: "off" | "daily_digest" | "weekly_digest";
  weekly_checkin: boolean;
  weekly_checkin_day: number;
  channel_email: boolean;
};

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-full border bg-muted/50 p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm transition-colors",
            value === o.value
              ? "bg-card font-medium shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function NotificationForm({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState<Prefs>({
    ...initial,
    daily_reminder_time: initial.daily_reminder_time.slice(0, 5),
  });
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) =>
    setPrefs((p) => ({ ...p, [k]: v }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await saveNotificationPreferences(prefs);
          if (r.ok) toast.success("Preferences saved");
          else toast.error(r.error);
        });
      }}
    >
      <div className="divide-y rounded-2xl border bg-card">
        <Row
          title="Daily growth reminder"
          description="A gentle nudge with today’s 1% action."
        >
          <div className="flex items-center gap-2">
            <Segmented
              label="Daily growth reminder"
              value={prefs.daily_reminder}
              onChange={(v) => set("daily_reminder", v)}
              options={[
                { value: "off", label: "Off" },
                { value: "daily", label: "1 per day" },
              ]}
            />
            {prefs.daily_reminder === "daily" ? (
              <input
                type="time"
                aria-label="Reminder time"
                value={prefs.daily_reminder_time}
                onChange={(e) => set("daily_reminder_time", e.target.value)}
                className="h-9 rounded-md border bg-card px-2 text-sm"
              />
            ) : null}
          </div>
        </Row>
        <Row
          title="Opportunity alerts"
          description="Deadlines and strong matches for your goals."
        >
          <Segmented
            label="Opportunity alerts"
            value={prefs.opportunity_alerts}
            onChange={(v) => set("opportunity_alerts", v)}
            options={[
              { value: "off", label: "Off" },
              { value: "important", label: "Important only" },
              { value: "all", label: "All matches" },
            ]}
          />
        </Row>
        <Row
          title="Industry updates"
          description="Important developments in your field."
        >
          <Segmented
            label="Industry updates"
            value={prefs.industry_updates}
            onChange={(v) => set("industry_updates", v)}
            options={[
              { value: "off", label: "Off" },
              { value: "daily_digest", label: "Daily" },
              { value: "weekly_digest", label: "Weekly" },
            ]}
          />
        </Row>
        <Row
          title="Weekly check-in"
          description="A two-minute look back and plan for next week."
        >
          <div className="flex items-center gap-3">
            {prefs.weekly_checkin ? (
              <select
                aria-label="Check-in day"
                value={prefs.weekly_checkin_day}
                onChange={(e) =>
                  set("weekly_checkin_day", Number(e.target.value))
                }
                className="h-9 rounded-md border bg-card px-2 text-sm"
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i + 1}>
                    {d}
                  </option>
                ))}
              </select>
            ) : null}
            <Switch
              checked={prefs.weekly_checkin}
              onCheckedChange={(v) => set("weekly_checkin", v)}
              aria-label="Weekly check-in"
            />
          </div>
        </Row>
      </div>

      <div className="rounded-2xl border bg-card px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="email-channel" className="font-medium">
            Email
          </Label>
          <Switch
            id="email-channel"
            checked={prefs.channel_email}
            onCheckedChange={(v) => set("channel_email", v)}
          />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Push notifications are coming with the mobile app.
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        Mentr never sends notifications just to bring you back. Defaults are
        deliberately quiet.
      </p>
      <Button type="submit" disabled={pending} className="rounded-full px-6">
        {pending ? <Loader2 className="animate-spin" /> : null}
        Save preferences
      </Button>
    </form>
  );
}
