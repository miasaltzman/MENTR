import type { Metadata } from "next";
import { PageContainer } from "@/components/app/page";
import { type ChatMessage, ChatView } from "@/components/mentor/chat-view";
import { MentorToolbar } from "@/components/mentor/history-sheet";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { STUDENT_TYPES } from "@/lib/domain/labels";
import type { StoredSuggestion } from "@/lib/mentor/schemas";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mentor" };

const STARTERS: Record<string, string[]> = {
  student: [
    "What should I do this summer?",
    "What internship should I target?",
    "Give me a project idea",
    "I feel behind",
    "Help me prepare for a career fair",
    "What should I do before graduating?",
  ],
  pro: [
    "What should I do this week?",
    "How do I position myself for my next role?",
    "What skills should I learn?",
    "Help me prepare for a networking chat",
    "I feel stuck",
  ],
  founder: [
    "Help me build a business",
    "How do I validate my idea?",
    "How should I price this?",
    "What should I do this week?",
  ],
  explorer: [
    "I have no idea what career I want",
    "Help me compare two paths",
    "What should I do this week?",
    "I feel behind",
  ],
};

export default async function MentorPage({
  searchParams,
}: PageProps<"/mentor">) {
  const user = await requireOnboardedUser();
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: profile }, { data: conversations }] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, user_type, career_certainty")
      .eq("id", user.id)
      .single(),
    supabase
      .from("mentor_conversations")
      .select("id, title, last_message_at")
      .eq("user_id", user.id)
      .eq("kind", "chat")
      .order("last_message_at", { ascending: false })
      .limit(30),
  ]);

  const requested = typeof params.c === "string" ? params.c : null;
  const fresh = params.new === "1" || typeof params.q === "string";
  // Default to the most recent conversation unless starting fresh.
  const activeId =
    requested ?? (fresh ? null : (conversations?.[0]?.id ?? null));

  let messages: ChatMessage[] = [];
  let conversationId: string | null = null;
  if (activeId) {
    const { data } = await supabase
      .from("mentor_messages")
      .select("id, role, content, suggestions, created_at, conversation_id")
      .eq("conversation_id", activeId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (data?.length) {
      conversationId = activeId;
      messages = data.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        suggestions: (Array.isArray(m.suggestions)
          ? m.suggestions
          : []) as unknown as StoredSuggestion[],
      }));
    }
  }

  const type = profile?.user_type;
  const starterKey =
    type === "entrepreneur"
      ? "founder"
      : type === "working_professional" || type === "career_changer"
        ? "pro"
        : type === "exploring" || profile?.career_certainty === "no_idea"
          ? "explorer"
          : "student";

  return (
    <PageContainer className="pt-4 sm:pt-6">
      <MentorToolbar
        conversations={conversations ?? []}
        activeId={conversationId}
      />
      <div className="mt-4">
        <ChatView
          conversationId={conversationId}
          initialMessages={messages}
          initialPrompt={
            typeof params.q === "string" ? params.q.slice(0, 1000) : undefined
          }
          starterPrompts={STARTERS[starterKey]}
          isStudent={type ? STUDENT_TYPES.has(type) : false}
          firstName={profile?.first_name ?? null}
        />
      </div>
    </PageContainer>
  );
}
