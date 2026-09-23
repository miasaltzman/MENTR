import "server-only";
import { serverEnv } from "@/lib/env";
import { AnthropicProvider } from "./providers/anthropic";
import { MockProvider } from "./providers/mock";
import type { AIProvider } from "./types";

let instance: AIProvider | undefined;

/**
 * Picks the configured provider. Defaults to Anthropic when a key is present,
 * otherwise the deterministic mock (clearly labelled as demo mode in the UI).
 */
export function getAIProvider(): AIProvider {
  if (instance) return instance;
  const env = serverEnv();
  const choice =
    env.AI_PROVIDER ?? (env.ANTHROPIC_API_KEY ? "anthropic" : "mock");
  instance =
    choice === "anthropic"
      ? new AnthropicProvider({
          model: env.AI_MODEL,
          apiKey: env.ANTHROPIC_API_KEY,
        })
      : new MockProvider();
  return instance;
}

export function isMockAI(): boolean {
  return getAIProvider().name === "mock";
}
