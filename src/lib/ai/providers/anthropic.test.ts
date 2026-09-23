import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const parse = vi.fn();
const stream = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status?: number;
  }
  class Anthropic {
    static APIError = APIError;
    beta = { messages: { parse, stream } };
  }
  return { default: Anthropic };
});

const { AnthropicProvider } = await import("./anthropic");

const schema = z.object({ title: z.string() });
const request = {
  task: "daily_action" as const,
  system: "sys",
  prompt: "prompt",
  schema,
  fallback: () => ({ title: "rules-based" }),
};

function makeStream(events: unknown[], finalMessage: unknown) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const e of events) yield e;
    },
    finalMessage: async () => finalMessage,
  };
}

describe("AnthropicProvider.generateObject", () => {
  const provider = new AnthropicProvider({
    model: "claude-opus-5",
    apiKey: "test",
  });
  beforeEach(() => {
    parse.mockReset();
    stream.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("returns validated model output and opts into server-side fallbacks", async () => {
    parse.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: { title: "from model" },
      model: "claude-opus-5",
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const result = await provider.generateObject(request);
    expect(result).toMatchObject({
      data: { title: "from model" },
      usedFallback: false,
    });
    const params = parse.mock.calls[0][0];
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toContain("server-side-fallback-2026-07-01");
    expect(params.output_config.effort).toBe("medium");
  });

  it("falls back to rules on refusal", async () => {
    parse.mockResolvedValue({
      stop_reason: "refusal",
      parsed_output: null,
      usage: {},
    });
    const result = await provider.generateObject(request);
    expect(result).toMatchObject({
      data: { title: "rules-based" },
      usedFallback: true,
    });
  });

  it("falls back to rules on API errors", async () => {
    parse.mockRejectedValue(new Error("network down"));
    const result = await provider.generateObject(request);
    expect(result.usedFallback).toBe(true);
  });

  it("falls back when output fails our schema", async () => {
    parse.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: { wrong: true },
      model: "m",
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    expect((await provider.generateObject(request)).usedFallback).toBe(true);
  });
});

describe("AnthropicProvider.streamChat", () => {
  const provider = new AnthropicProvider({
    model: "claude-opus-5",
    apiKey: "test",
  });
  const suggestionsSchema = z.object({
    items: z.array(z.object({ title: z.string() })),
  });
  const chat = {
    system: "sys",
    context: "ctx",
    messages: [
      { role: "user" as const, content: "What should I do this week?" },
    ],
    suggestionsSchema,
    fallback: () => ({ text: "fallback reply", suggestions: null }),
  };

  beforeEach(() => {
    stream.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("streams text and captures validated suggestions from the tool call", async () => {
    stream.mockReturnValue(
      makeStream(
        [
          {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Build " },
          },
          {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "a case study." },
          },
        ],
        {
          stop_reason: "tool_use",
          model: "claude-opus-5",
          usage: { input_tokens: 100, output_tokens: 20 },
          content: [
            { type: "text", text: "Build a case study." },
            {
              type: "tool_use",
              name: "offer_actions",
              input: { items: [{ title: "Draft outline" }] },
            },
          ],
        },
      ),
    );
    const s = provider.streamChat(chat);
    let text = "";
    for await (const chunk of s.textStream) text += chunk;
    const final = await s.final;
    expect(text).toBe("Build a case study.");
    expect(final.suggestions).toEqual({ items: [{ title: "Draft outline" }] });
    expect(final.usedFallback).toBe(false);
    const params = stream.mock.calls[0][0];
    expect(params.tools[0].strict).toBe(true);
    expect(params.system[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("uses the rules-based reply when the request fails before any text", async () => {
    stream.mockImplementation(() => {
      throw new Error("boom");
    });
    const s = provider.streamChat(chat);
    let text = "";
    for await (const chunk of s.textStream) text += chunk;
    expect(text).toBe("fallback reply");
    expect((await s.final).usedFallback).toBe(true);
  });
});
