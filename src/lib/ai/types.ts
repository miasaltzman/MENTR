import type { z } from "zod";

/** Every AI call is tagged with a task so cost/effort can be tuned per route. */
export type AITask =
  | "roadmap"
  | "daily_action"
  | "adjust_action"
  | "weekly_priorities"
  | "checkin_review"
  | "mentor_chat"
  | "memory_extraction"
  | "conversation_summary";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type AIUsage = { inputTokens: number; outputTokens: number };

export type StructuredRequest<T> = {
  task: AITask;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /**
   * Deterministic, rules-based result. Used by the mock provider, and as a
   * graceful fallback when the model errors or declines.
   */
  fallback: () => T;
  effort?: Effort;
  maxTokens?: number;
};

export type StructuredResult<T> = {
  data: T;
  provider: string;
  model: string | null;
  usage: AIUsage | null;
  /** True when `fallback()` produced the data instead of the model. */
  usedFallback: boolean;
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatRequest<S> = {
  /** Stable persona/instructions (cached). */
  system: string;
  /** Per-user context block (cached per conversation). */
  context: string;
  messages: ChatTurn[];
  /** Schema for the optional structured suggestions attached to a reply. */
  suggestionsSchema: z.ZodType<S>;
  fallback: () => { text: string; suggestions: S | null };
  effort?: Effort;
};

export type ChatFinal<S> = {
  text: string;
  suggestions: S | null;
  provider: string;
  model: string | null;
  usage: AIUsage | null;
  usedFallback: boolean;
};

export type ChatStream<S> = {
  textStream: AsyncIterable<string>;
  final: Promise<ChatFinal<S>>;
};

export interface AIProvider {
  readonly name: "anthropic" | "mock";
  generateObject<T>(
    request: StructuredRequest<T>,
  ): Promise<StructuredResult<T>>;
  streamChat<S>(request: ChatRequest<S>): ChatStream<S>;
}
