"use client";

import { ArrowUp, Check, Loader2, Map, Plus, Target } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { LogoMark } from "@/components/brand/logo";
import { Markdown } from "@/components/mentor/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { horizonLabel } from "@/lib/domain/labels";
import { acceptSuggestion } from "@/lib/mentor/actions";
import type { StoredSuggestion } from "@/lib/mentor/schemas";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  id: string | null;
  role: "user" | "assistant";
  content: string;
  suggestions: StoredSuggestion[];
  streaming?: boolean;
};

type StreamEvent =
  | { type: "meta"; conversationId: string }
  | { type: "delta"; text: string }
  | {
      type: "done";
      message: { id: string; content: string; suggestions: StoredSuggestion[] };
    }
  | { type: "error"; error: string };

function SuggestionCard({
  suggestion,
  messageId,
  index,
  isStudent,
  onAccepted,
}: {
  suggestion: StoredSuggestion;
  messageId: string | null;
  index: number;
  isStudent: boolean;
  onAccepted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const accepted = Boolean(suggestion.accepted_at);
  const isMilestone = suggestion.kind === "add_milestone";
  const Icon = isMilestone ? Map : Target;
  const cta = isMilestone
    ? `Add to roadmap · ${horizonLabel(suggestion.horizon ?? "month", isStudent)}`
    : `Make this today’s 1%${suggestion.estimated_minutes ? ` · ~${suggestion.estimated_minutes} min` : ""}`;

  return (
    <div className="rounded-2xl bg-muted/60 p-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{suggestion.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {suggestion.why}
          </p>
          <Button
            size="sm"
            variant={accepted ? "ghost" : "secondary"}
            className="mt-2.5"
            disabled={accepted || pending || !messageId}
            onClick={() =>
              startTransition(async () => {
                const r = await acceptSuggestion(messageId!, index);
                if (!r.ok) return void toast.error(r.error);
                toast.success(r.message);
                onAccepted();
              })
            }
          >
            {pending ? (
              <Loader2 className="animate-spin" />
            ) : accepted ? (
              <Check />
            ) : (
              <Plus />
            )}
            {accepted
              ? isMilestone
                ? "Added to roadmap"
                : "Set as today’s 1%"
              : cta}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ChatView({
  conversationId: initialConversationId,
  initialMessages,
  initialPrompt,
  starterPrompts,
  isStudent,
  firstName,
}: {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  initialPrompt?: string;
  starterPrompts: string[];
  isStudent: boolean;
  firstName: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(initialConversationId);
  // Reset only when the page switches to a *different* conversation (history
  // link, "New chat"). A refresh confirming the current one keeps live state.
  const [lastInitialId, setLastInitialId] = useState(initialConversationId);
  if (initialConversationId !== lastInitialId) {
    setLastInitialId(initialConversationId);
    if (initialConversationId !== conversationId && !sending) {
      setConversationId(initialConversationId);
      setMessages(initialMessages);
    }
  }
  const [input, setInput] = useState(initialPrompt ?? "");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (initialPrompt) inputRef.current?.focus();
  }, [initialPrompt]);

  const updateLast = (fn: (m: ChatMessage) => ChatMessage) =>
    setMessages((cur) => cur.map((m, i) => (i === cur.length - 1 ? fn(m) : m)));

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setInput("");
    setMessages((cur) => [
      ...cur,
      { id: null, role: "user", content: message, suggestions: [] },
      {
        id: null,
        role: "assistant",
        content: "",
        suggestions: [],
        streaming: true,
      },
    ]);

    try {
      const res = await fetch("/api/mentor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "meta") {
            setConversationId(event.conversationId);
            window.history.replaceState(
              null,
              "",
              `/mentor?c=${event.conversationId}`,
            );
          } else if (event.type === "delta") {
            updateLast((m) => ({ ...m, content: m.content + event.text }));
          } else if (event.type === "done") {
            updateLast(() => ({
              id: event.message.id,
              role: "assistant",
              content: event.message.content,
              suggestions: event.message.suggestions,
            }));
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }
    } catch {
      toast.error("Mentr couldn’t reply just now. Please try again.");
      setMessages((cur) =>
        cur.filter(
          (m) => !(m.role === "assistant" && m.streaming && !m.content),
        ),
      );
      setInput(message);
    } finally {
      setMessages((cur) =>
        cur.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
      );
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
      <div className="flex-1 space-y-6 pb-6">
        {messages.length === 0 ? (
          <div className="pt-6">
            <LogoMark className="size-10" />
            <h1 className="text-display mt-6 text-[2.5rem] sm:text-5xl">
              What’s on your mind{firstName ? `, ${firstName}` : ""}?
            </h1>
            <p className="mt-2 text-muted-foreground">
              Careers, skills, decisions, what to do next. I already know your
              goals.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {starterPrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  className="rounded-full bg-muted px-4 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              <div key={m.id ?? `u-${i}`} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-secondary px-4 py-2.5 whitespace-pre-wrap">
                  {m.content}
                </p>
              </div>
            ) : (
              <div key={m.id ?? `a-${i}`} className="flex gap-3">
                <LogoMark className="mt-0.5 size-7" />
                <div className="min-w-0 flex-1 space-y-3">
                  {m.content ? (
                    <Markdown text={m.content} />
                  ) : (
                    <p
                      className="flex items-center gap-2 text-muted-foreground"
                      role="status"
                    >
                      <Loader2 className="size-4 animate-spin" /> Thinking…
                    </p>
                  )}
                  {!m.streaming && m.suggestions.length ? (
                    <div className="space-y-2">
                      {m.suggestions.map((s, j) => (
                        <SuggestionCard
                          key={j}
                          suggestion={s}
                          messageId={m.id}
                          index={j}
                          isStudent={isStudent}
                          onAccepted={() =>
                            setMessages((cur) =>
                              cur.map((x) =>
                                x.id === m.id
                                  ? {
                                      ...x,
                                      suggestions: x.suggestions.map((y, k) =>
                                        k === j
                                          ? {
                                              ...y,
                                              accepted_at:
                                                new Date().toISOString(),
                                            }
                                          : y,
                                      ),
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ),
          )
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] rounded-3xl bg-card p-2 shadow-[0_1px_2px_oklch(0.2_0.01_70/0.06),0_12px_32px_-16px_oklch(0.2_0.01_70/0.18)] md:bottom-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Ask your mentor anything…"
            aria-label="Message"
            maxLength={4000}
            rows={1}
            className={cn(
              "max-h-40 min-h-11 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0",
            )}
          />
          <Button
            type="submit"
            size="icon"
            className="shrink-0 rounded-full"
            disabled={!input.trim() || sending}
            aria-label="Send"
          >
            {sending ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </Button>
        </div>
      </form>
    </div>
  );
}
