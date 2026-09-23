"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { checkinAnswers } from "./schemas";
import { type CheckinResult, runCheckin } from "./service";

export async function submitCheckin(
  input: unknown,
): Promise<{ ok: true; result: CheckinResult } | { ok: false; error: string }> {
  const user = await requireOnboardedUser();
  const parsed = checkinAnswers.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Please shorten your answers a little." };
  try {
    const result = await runCheckin(await createClient(), user.id, parsed.data);
    revalidatePath("/home");
    revalidatePath("/roadmap");
    return { ok: true, result };
  } catch (err) {
    console.error("[checkin] failed", err instanceof Error ? err.message : err);
    return {
      ok: false,
      error: "We couldn’t save your check-in. Please try again.",
    };
  }
}
