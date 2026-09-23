import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { renderMentorContext } from "@/lib/ai/context";
import { getAIProvider } from "@/lib/ai/provider";
import { guardUrls } from "@/lib/ai/url-guard";
import { getSessionUser } from "@/lib/auth/session";
import { loadMentorContext } from "@/lib/data/mentor-context";
import { rulesMentorReply } from "@/lib/mentor/rules-reply";
import { sanitizeSuggestions, suggestionsSchema } from "@/lib/mentor/schemas";
import {
  CHAT_SYSTEM,
  extractMemories,
  getOrCreateConversation,
  loadRecentTurns,
  maybeSummarize,
  saveMessage,
} from "@/lib/mentor/service";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const bodySchema = z.object({
  conversationId: z.uuid().nullish(),
  message: z.string().trim().min(1).max(4000),
});

/**
 * Streams a mentor reply as newline-delimited JSON events:
 *   {type:"meta", conversationId}
 *   {type:"delta", text}
 *   {type:"done", message:{id, content, suggestions}}
 *   {type:"error", error}
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "invalid_request" }, { status: 400 });
  const { message } = parsed.data;

  const supabase = await createClient();
  const [ctx, conversation] = await Promise.all([
    loadMentorContext(supabase, user.id),
    getOrCreateConversation(
      supabase,
      user.id,
      parsed.data.conversationId ?? null,
      message,
    ),
  ]);
  await saveMessage(supabase, {
    conversationId: conversation.id,
    userId: user.id,
    role: "user",
    content: message,
  });
  const turns = await loadRecentTurns(supabase, conversation.id);

  const contextBlock =
    renderMentorContext(ctx) +
    (conversation.summary
      ? `\n\n## Earlier in this conversation\n${conversation.summary}`
      : "");

  const chat = getAIProvider().streamChat({
    system: CHAT_SYSTEM,
    context: contextBlock,
    messages: turns,
    suggestionsSchema,
    fallback: () => rulesMentorReply(ctx, message),
  });

  const encoder = new TextEncoder();
  // If the client disconnects we keep generating and still save the reply,
  // so a closed tab or network blip never loses a message.
  let clientGone = false;
  const send = (
    controller: ReadableStreamDefaultController,
    event: unknown,
  ) => {
    if (clientGone) return;
    try {
      controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    } catch {
      clientGone = true;
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      send(controller, { type: "meta", conversationId: conversation.id });
      try {
        for await (const text of chat.textStream)
          send(controller, { type: "delta", text });
        const final = await chat.final;

        // Only links backed by verified records survive.
        const guarded = guardUrls(
          final.text,
          ctx.verifiedLinks.map((l) => l.url),
        );
        const suggestions = sanitizeSuggestions(final.suggestions);
        const id = await saveMessage(supabase, {
          conversationId: conversation.id,
          userId: user.id,
          role: "assistant",
          content: guarded.text,
          suggestions,
          model: final.model,
          usage: final.usage,
        });
        send(controller, {
          type: "done",
          message: { id, content: guarded.text, suggestions },
        });

        after(async () => {
          try {
            await extractMemories(
              supabase,
              user.id,
              ctx,
              message,
              guarded.text,
              id,
            );
            await maybeSummarize(supabase, conversation.id);
          } catch (err) {
            console.warn(
              "[mentor] background work failed",
              err instanceof Error ? err.message : err,
            );
          }
        });
      } catch (err) {
        console.error(
          "[mentor] chat failed",
          err instanceof Error ? err.message : err,
        );
        send(controller, {
          type: "error",
          error: "Something went wrong. Please try again.",
        });
      } finally {
        if (!clientGone) {
          try {
            controller.close();
          } catch {
            // already closed by the client
          }
        }
      }
    },
    cancel() {
      clientGone = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
