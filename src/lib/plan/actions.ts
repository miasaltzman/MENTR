"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  completeAction,
  replaceAction,
  saveReflection,
  skipAction,
  undoCompleteAction,
} from "./service";

export type ActionResult = { ok: true } | { ok: false; error: string };

const id = z.uuid();

async function run(
  label: string,
  fn: (userId: string) => Promise<unknown>,
): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  try {
    await fn(user.id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    console.error(
      `[plan] ${label} failed`,
      err instanceof Error ? err.message : err,
    );
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function completeDailyAction(
  actionId: string,
  reflection?: string,
): Promise<ActionResult> {
  const parsed = id.safeParse(actionId);
  if (!parsed.success) return { ok: false, error: "Invalid action." };
  const note =
    typeof reflection === "string" ? reflection.slice(0, 1000) : null;
  return run("complete", async (userId) =>
    completeAction(await createClient(), userId, parsed.data, note),
  );
}

export async function undoDailyAction(actionId: string): Promise<ActionResult> {
  const parsed = id.safeParse(actionId);
  if (!parsed.success) return { ok: false, error: "Invalid action." };
  return run("undo", async (userId) =>
    undoCompleteAction(await createClient(), userId, parsed.data),
  );
}

export async function skipDailyAction(actionId: string): Promise<ActionResult> {
  const parsed = id.safeParse(actionId);
  if (!parsed.success) return { ok: false, error: "Invalid action." };
  return run("skip", async (userId) =>
    skipAction(await createClient(), userId, parsed.data),
  );
}

const modeSchema = z.enum(["different", "lighter", "stretch"]);

export async function replaceDailyAction(
  actionId: string,
  mode: "different" | "lighter" | "stretch",
): Promise<ActionResult> {
  const parsedId = id.safeParse(actionId);
  const parsedMode = modeSchema.safeParse(mode);
  if (!parsedId.success || !parsedMode.success)
    return { ok: false, error: "Invalid request." };
  return run("replace", async (userId) =>
    replaceAction(await createClient(), userId, parsedId.data, parsedMode.data),
  );
}

export async function setPriorityStatus(
  priorityId: string,
  done: boolean,
): Promise<ActionResult> {
  const parsed = id.safeParse(priorityId);
  if (!parsed.success) return { ok: false, error: "Invalid priority." };
  return run("priority", async (userId) => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("weekly_priorities")
      .update({ status: done ? "done" : "open" })
      .eq("id", parsed.data)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  });
}

export async function saveActionReflection(
  actionId: string,
  reflection: string,
): Promise<ActionResult> {
  const parsed = id.safeParse(actionId);
  if (!parsed.success || typeof reflection !== "string")
    return { ok: false, error: "Invalid request." };
  return run("reflection", async (userId) =>
    saveReflection(await createClient(), userId, parsed.data, reflection),
  );
}
