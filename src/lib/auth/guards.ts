import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireUser, type SessionUser } from "./session";

/**
 * For app pages: a signed-in user who has finished onboarding.
 * Sends everyone else to /login or /onboarding.
 */
export const requireOnboardedUser = cache(async (): Promise<SessionUser> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_status")
    .eq("id", user.id)
    .single();
  if (data?.onboarding_status !== "completed") redirect("/onboarding");
  return user;
});
