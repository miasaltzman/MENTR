"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { HORIZONS } from "@/lib/plan/schemas";

export type RoadmapResult =
  { ok: true; id?: string } | { ok: false; error: string };

const statusSchema = z.enum([
  "not_started",
  "in_progress",
  "completed",
  "skipped",
]);
const addSchema = z.object({
  horizon: z.enum(HORIZONS).exclude(["today"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(600).nullish(),
  why: z.string().trim().max(500).nullish(),
  sourceMessageId: z.uuid().nullish(),
});

async function activeRoadmapId(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("roadmaps")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "career")
    .eq("status", "active")
    .maybeSingle();
  return { supabase, roadmapId: data?.id ?? null };
}

export async function setMilestoneStatus(
  milestoneId: string,
  status: string,
): Promise<RoadmapResult> {
  const user = await requireOnboardedUser();
  const id = z.uuid().safeParse(milestoneId);
  const s = statusSchema.safeParse(status);
  if (!id.success || !s.success)
    return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roadmap_milestones")
    .update({
      status: s.data,
      completed_at: s.data === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", id.data)
    .eq("user_id", user.id)
    .select("roadmap_id, title")
    .single();
  if (error || !data)
    return { ok: false, error: "Couldn’t update that milestone." };

  if (s.data === "completed" || s.data === "skipped") {
    await supabase.from("roadmap_revisions").insert({
      roadmap_id: data.roadmap_id,
      user_id: user.id,
      cause: s.data === "completed" ? "milestone_completed" : "manual",
      summary: `${s.data === "completed" ? "Completed" : "Set aside"}: ${data.title}`,
      changes: [{ milestone_id: id.data, status: s.data }],
    });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addMilestone(
  input: z.input<typeof addSchema>,
): Promise<RoadmapResult> {
  const user = await requireOnboardedUser();
  const parsed = addSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Give the milestone a short title." };

  const { supabase, roadmapId } = await activeRoadmapId(user.id);
  if (!roadmapId)
    return { ok: false, error: "You don’t have an active roadmap yet." };

  const { count } = await supabase
    .from("roadmap_milestones")
    .select("id", { count: "exact", head: true })
    .eq("roadmap_id", roadmapId)
    .eq("horizon", parsed.data.horizon);

  const fromChat = Boolean(parsed.data.sourceMessageId);
  const { data, error } = await supabase
    .from("roadmap_milestones")
    .insert({
      roadmap_id: roadmapId,
      user_id: user.id,
      horizon: parsed.data.horizon,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      why: parsed.data.why ?? null,
      position: count ?? 0,
      origin: fromChat ? "chat" : "user",
      source_message_id: parsed.data.sourceMessageId ?? null,
    })
    .select("id")
    .single();
  if (error || !data)
    return { ok: false, error: "Couldn’t add that milestone." };

  await supabase.from("roadmap_revisions").insert({
    roadmap_id: roadmapId,
    user_id: user.id,
    cause: fromChat ? "chat" : "manual",
    summary: `Added: ${parsed.data.title}`,
    changes: [{ milestone_id: data.id, added: true }],
  });
  revalidatePath("/", "layout");
  return { ok: true, id: data.id };
}

export async function deleteMilestone(
  milestoneId: string,
): Promise<RoadmapResult> {
  const user = await requireOnboardedUser();
  const id = z.uuid().safeParse(milestoneId);
  if (!id.success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roadmap_milestones")
    .delete()
    .eq("id", id.data)
    .eq("user_id", user.id)
    .select("roadmap_id, title")
    .single();
  if (error || !data)
    return { ok: false, error: "Couldn’t remove that milestone." };
  await supabase.from("roadmap_revisions").insert({
    roadmap_id: data.roadmap_id,
    user_id: user.id,
    cause: "manual",
    summary: `Removed: ${data.title}`,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
