"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { acceptSuggestion as accept, type AcceptResult } from "./service";

export async function acceptSuggestion(
  messageId: string,
  index: number,
): Promise<AcceptResult> {
  const user = await requireOnboardedUser();
  const id = z.uuid().safeParse(messageId);
  const i = z.number().int().min(0).max(10).safeParse(index);
  if (!id.success || !i.success)
    return { ok: false, error: "Invalid request." };
  const result = await accept(await createClient(), user.id, id.data, i.data);
  // Don't refresh the chat itself — that would interrupt the conversation.
  if (result.ok) {
    revalidatePath("/home");
    revalidatePath("/roadmap");
  }
  return result;
}

export async function deleteConversation(
  conversationId: string,
): Promise<{ ok: boolean }> {
  const user = await requireOnboardedUser();
  const id = z.uuid().safeParse(conversationId);
  if (!id.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("mentor_conversations")
    .delete()
    .eq("id", id.data)
    .eq("user_id", user.id);
  revalidatePath("/mentor");
  return { ok: !error };
}
