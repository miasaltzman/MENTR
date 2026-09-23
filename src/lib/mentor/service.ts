import "server-only";
import type { MentorContext } from "@/lib/ai/context";
import { MENTOR_PERSONA } from "@/lib/ai/prompts/persona";
import { getAIProvider } from "@/lib/ai/provider";
import type { ChatTurn } from "@/lib/ai/types";
import { localDate } from "@/lib/domain/dates";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import {
  conversationSummary,
  memoryExtraction,
  type StoredSuggestion,
} from "./schemas";

type Db = ServerSupabase;

/** Stable chat guidance appended to the persona (cached with it). */
export const CHAT_SYSTEM = `${MENTOR_PERSONA}

In this chat:
- Use what you know about the user (in the context block) naturally — don’t recite it back.
- If a question is ambiguous or you’re missing something important, ask one short question first. Keep replies brief — lead with what you’d do next.
- When a concrete next step would genuinely help, attach it with the offer_actions tool so the user can add it with one tap. Use "set_today" for a 2–10 minute quick win to do today and "add_milestone" for a bigger goal. Don’t mention the tool by name; just end your reply naturally.`;

const HISTORY_LIMIT = 20;
const SUMMARIZE_AFTER = 30;

export async function getOrCreateConversation(
  supabase: Db,
  userId: string,
  conversationId: string | null,
  firstMessage: string,
): Promise<{ id: string; summary: string | null; created: boolean }> {
  if (conversationId) {
    const { data } = await supabase
      .from("mentor_conversations")
      .select("id, summary")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (data) return { ...data, created: false };
  }
  const title = firstMessage.replace(/\s+/g, " ").trim().slice(0, 80);
  const { data, error } = await supabase
    .from("mentor_conversations")
    .insert({ user_id: userId, title })
    .select("id, summary")
    .single();
  if (error || !data) throw new Error(`create conversation: ${error?.message}`);
  return { ...data, created: true };
}

export async function loadRecentTurns(
  supabase: Db,
  conversationId: string,
): Promise<ChatTurn[]> {
  const { data, error } = await supabase
    .from("mentor_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw new Error(`load history: ${error.message}`);
  const turns = (data ?? [])
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));
  // The API requires the first turn to come from the user.
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}

export async function saveMessage(
  supabase: Db,
  input: {
    conversationId: string;
    userId: string;
    role: "user" | "assistant";
    content: string;
    suggestions?: StoredSuggestion[];
    model?: string | null;
    usage?: { inputTokens: number; outputTokens: number } | null;
  },
): Promise<string> {
  const { data, error } = await supabase
    .from("mentor_messages")
    .insert({
      conversation_id: input.conversationId,
      user_id: input.userId,
      role: input.role,
      content: input.content,
      suggestions: (input.suggestions ?? []) as unknown as Json,
      model: input.model ?? null,
      input_tokens: input.usage?.inputTokens ?? null,
      output_tokens: input.usage?.outputTokens ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`save message: ${error?.message}`);
  await supabase
    .from("mentor_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", input.conversationId);
  return data.id;
}

/** Extracts durable facts from a turn into mentor_memories. Best effort. */
export async function extractMemories(
  supabase: Db,
  userId: string,
  ctx: MentorContext,
  userMessage: string,
  reply: string,
  sourceMessageId: string,
): Promise<void> {
  const known =
    ctx.memories.map((m) => `- ${m.content}`).join("\n") || "(none)";
  const result = await getAIProvider().generateObject({
    task: "memory_extraction",
    system:
      "You maintain a mentor's notes about one user. Record only durable, useful facts the user stated about themselves: goals, constraints, preferences, decisions, experiences, concerns. Ignore small talk and anything the mentor said. Return an empty list when nothing new was learned.",
    prompt: `<already_known>\n${known}\n</already_known>\n\n<user_message>\n${userMessage}\n</user_message>\n\n<mentor_reply>\n${reply}\n</mentor_reply>\n\nReturn 0–3 new memories that aren’t already known.`,
    schema: memoryExtraction,
    fallback: () => ({ memories: [] }),
  });
  const existing = new Set(ctx.memories.map((m) => m.content.toLowerCase()));
  const rows = result.data.memories
    .map((m) => ({ ...m, content: m.content.trim().slice(0, 300) }))
    .filter((m) => m.content && !existing.has(m.content.toLowerCase()))
    .slice(0, 3)
    .map((m) => ({
      user_id: userId,
      kind: m.kind,
      content: m.content,
      importance: Math.min(5, Math.max(1, Math.round(m.importance))),
      source_message_id: sourceMessageId,
    }));
  if (rows.length) await supabase.from("mentor_memories").insert(rows);
}

/** Keeps long conversations cheap: folds older turns into a rolling summary. */
export async function maybeSummarize(
  supabase: Db,
  conversationId: string,
): Promise<void> {
  const { count } = await supabase
    .from("mentor_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);
  if (!count || count < SUMMARIZE_AFTER || count % 10 !== 0) return;

  const [{ data: conv }, { data: older }] = await Promise.all([
    supabase
      .from("mentor_conversations")
      .select("summary")
      .eq("id", conversationId)
      .single(),
    supabase
      .from("mentor_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .range(HISTORY_LIMIT, HISTORY_LIMIT + 40),
  ]);
  if (!older?.length) return;
  const transcript = [...older]
    .reverse()
    .map(
      (m) =>
        `${m.role === "user" ? "User" : "Mentor"}: ${m.content.slice(0, 1500)}`,
    )
    .join("\n\n");
  const result = await getAIProvider().generateObject({
    task: "conversation_summary",
    system:
      "Summarize a mentoring conversation for the mentor’s future reference.",
    prompt: `<previous_summary>\n${conv?.summary ?? "(none)"}\n</previous_summary>\n\n<older_messages>\n${transcript}\n</older_messages>\n\nWrite an updated summary.`,
    schema: conversationSummary,
    fallback: () => ({ summary: conv?.summary ?? "" }),
  });
  if (result.usedFallback || !result.data.summary.trim()) return;
  await supabase
    .from("mentor_conversations")
    .update({
      summary: result.data.summary.trim().slice(0, 2000),
      summarized_through: older[0].created_at,
    })
    .eq("id", conversationId);
}

export type AcceptResult =
  { ok: true; message: string } | { ok: false; error: string };

/**
 * Applies a suggestion from a stored assistant message. The suggestion is
 * read from the database — never trusted from the client.
 */
export async function acceptSuggestion(
  supabase: Db,
  userId: string,
  messageId: string,
  index: number,
): Promise<AcceptResult> {
  const { data: msg } = await supabase
    .from("mentor_messages")
    .select("id, suggestions, role")
    .eq("id", messageId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!msg || msg.role !== "assistant")
    return { ok: false, error: "Suggestion not found." };
  const items = (Array.isArray(msg.suggestions)
    ? msg.suggestions
    : []) as unknown as StoredSuggestion[];
  const s = items[index];
  if (!s) return { ok: false, error: "Suggestion not found." };
  if (s.accepted_at) return { ok: true, message: "Already added." };

  if (s.kind === "add_milestone") {
    const { data: roadmap } = await supabase
      .from("roadmaps")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", "career")
      .eq("status", "active")
      .maybeSingle();
    if (!roadmap)
      return { ok: false, error: "You don’t have an active roadmap yet." };
    const horizon = s.horizon ?? "month";
    const { data: ms, error } = await supabase
      .from("roadmap_milestones")
      .insert({
        roadmap_id: roadmap.id,
        user_id: userId,
        horizon,
        title: s.title,
        why: s.why,
        category: s.category,
        position: 99,
        origin: "chat",
        source_message_id: msg.id,
      })
      .select("id")
      .single();
    if (error || !ms)
      return { ok: false, error: "Couldn’t add that to your roadmap." };
    await supabase.from("roadmap_revisions").insert({
      roadmap_id: roadmap.id,
      user_id: userId,
      cause: "chat",
      summary: `Added from a mentor conversation: ${s.title}`,
      changes: [{ milestone_id: ms.id, added: true }],
    });
  } else {
    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", userId)
      .single();
    const today = localDate(profile?.timezone);
    const { data: current } = await supabase
      .from("daily_actions")
      .select("id, status")
      .eq("user_id", userId)
      .eq("action_date", today)
      .eq("is_primary", true)
      .neq("status", "replaced")
      .maybeSingle();
    if (current?.status === "completed") {
      return {
        ok: false,
        error: "You’ve already finished today’s 1% — try this one tomorrow.",
      };
    }
    if (current)
      await supabase
        .from("daily_actions")
        .update({ status: "replaced" })
        .eq("id", current.id);
    const { data: created, error } = await supabase
      .from("daily_actions")
      .insert({
        user_id: userId,
        action_date: today,
        title: s.title,
        why: s.why,
        category: s.category ?? "learning",
        estimated_minutes: s.estimated_minutes ?? 15,
        origin: "chat",
      })
      .select("id")
      .single();
    if (error || !created)
      return { ok: false, error: "Couldn’t set that as today’s action." };
    if (current)
      await supabase
        .from("daily_actions")
        .update({ replaced_by_id: created.id })
        .eq("id", current.id);
  }

  items[index] = { ...s, accepted_at: new Date().toISOString() };
  await supabase
    .from("mentor_messages")
    .update({ suggestions: items as unknown as Json })
    .eq("id", msg.id);
  return {
    ok: true,
    message:
      s.kind === "add_milestone"
        ? "Added to your roadmap."
        : "Set as today’s 1%.",
  };
}
