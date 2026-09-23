"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

const suggestionSchema = z.object({
  universityId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  url: z.url({ protocol: /^https?$/ }).max(500),
  note: z.string().trim().max(500).optional(),
});

export async function suggestCampusLink(
  input: z.input<typeof suggestionSchema>,
) {
  const user = await requireOnboardedUser();
  const parsed = suggestionSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false as const,
      error: "Add a name and a full link (https://…).",
    };
  const supabase = await createClient();
  const { error } = await supabase.from("resource_suggestions").insert({
    user_id: user.id,
    university_id: parsed.data.universityId,
    name: parsed.data.name,
    url: parsed.data.url,
    note: parsed.data.note || null,
  });
  if (error)
    return { ok: false as const, error: "Couldn’t save your suggestion." };
  return { ok: true as const };
}

export async function toggleSavedCampusResource(
  resourceId: string,
  save: boolean,
) {
  const user = await requireOnboardedUser();
  const id = z.uuid().safeParse(resourceId);
  if (!id.success) return { ok: false as const };
  const supabase = await createClient();
  const { error } = save
    ? await supabase
        .from("saved_resources")
        .insert({ user_id: user.id, university_resource_id: id.data })
    : await supabase
        .from("saved_resources")
        .delete()
        .eq("user_id", user.id)
        .eq("university_resource_id", id.data);
  revalidatePath("/explore/campus");
  revalidatePath("/profile");
  return { ok: !error || error.code === "23505" };
}
