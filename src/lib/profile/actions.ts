"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { generateInitialPlan } from "@/lib/plan/service";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function deleteMemory(memoryId: string): Promise<Result> {
  const user = await requireOnboardedUser();
  const id = z.uuid().safeParse(memoryId);
  if (!id.success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("mentor_memories")
    .delete()
    .eq("id", id.data)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn’t remove that." };
  revalidatePath("/profile");
  return { ok: true };
}

/** Rebuilds the roadmap from the current profile. The old one is archived, not deleted. */
export async function rebuildPlan(): Promise<Result> {
  const user = await requireOnboardedUser();
  const supabase = await createClient();
  try {
    await generateInitialPlan(supabase, user.id);
  } catch (err) {
    console.error(
      "[profile] rebuild failed",
      err instanceof Error ? err.message : err,
    );
    return {
      ok: false,
      error: "Couldn’t rebuild your plan. Please try again.",
    };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const prefsSchema = z.object({
  daily_reminder: z.enum(["off", "daily"]),
  daily_reminder_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  opportunity_alerts: z.enum(["off", "important", "all"]),
  industry_updates: z.enum(["off", "daily_digest", "weekly_digest"]),
  weekly_checkin: z.boolean(),
  weekly_checkin_day: z.number().int().min(1).max(7),
  channel_email: z.boolean(),
});

export async function saveNotificationPreferences(
  input: z.input<typeof prefsSchema>,
): Promise<Result> {
  const user = await requireOnboardedUser();
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid preferences." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id" });
  if (error) return { ok: false, error: "Couldn’t save your preferences." };
  revalidatePath("/settings/notifications");
  return { ok: true };
}
