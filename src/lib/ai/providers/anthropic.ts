import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { toStrictJsonSchema } from "../json-schema";
import type {
  AIProvider,
  AITask,
  ChatFinal,
  ChatRequest,
  ChatStream,
  Effort,
  StructuredRequest,
  StructuredResult,
} from "../types";

// Server-side refusal fallback: if a safety classifier declines, the API
// re-runs the request on Anthropic's recommended fallback model.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

const DEFAULT_EFFORT: Record<AITask, Effort> = {
  roadmap: "high",
  checkin_review: "medium",
  weekly_priorities: "medium",
  daily_action: "medium",
  adjust_action: "low",
  mentor_chat: "medium",
  memory_extraction: "low",
  conversation_summary: "low",
};

export const SUGGESTIONS_TOOL_NAME = "offer_actions";

function logFailure(task: AITask, error: unknown) {
  const detail =
    error instanceof Anthropic.APIError
      ? `${error.constructor.name} ${error.status ?? ""}`
      : error instanceof Error
        ? error.message
        : String(error);
  console.warn(`[ai] ${task} fell back to rules: ${detail}`);
}

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic" as const;
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(opts: { model: string; apiKey?: string }) {
    this.model = opts.model;
    this.client = new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
  }

  async generateObject<T>(
    req: StructuredRequest<T>,
  ): Promise<StructuredResult<T>> {
    const fallback = (): StructuredResult<T> => ({
      data: req.fallback(),
      provider: this.name,
      model: null,
      usage: null,
      usedFallback: true,
    });

    try {
      const response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: req.maxTokens ?? 16000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
        output_config: {
          effort: req.effort ?? DEFAULT_EFFORT[req.task],
          format: betaZodOutputFormat(req.schema),
        },
      });

      if (
        response.stop_reason === "refusal" ||
        response.stop_reason === "max_tokens"
      ) {
        logFailure(req.task, new Error(`stop_reason=${response.stop_reason}`));
        return fallback();
      }
      // Validate again: the parsed output must satisfy our own schema.
      const parsed = req.schema.safeParse(response.parsed_output);
      if (!parsed.success) {
        logFailure(req.task, new Error("schema validation failed"));
        return fallback();
      }
      return {
        data: parsed.data,
        provider: this.name,
        model: response.model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        usedFallback: false,
      };
    } catch (error) {
      logFailure(req.task, error);
      return fallback();
    }
  }

  streamChat<S>(req: ChatRequest<S>): ChatStream<S> {
    let resolveFinal!: (value: ChatFinal<S>) => void;
    let rejectFinal!: (reason: unknown) => void;
    const final = new Promise<ChatFinal<S>>((resolve, reject) => {
      resolveFinal = resolve;
      rejectFinal = reject;
    });

    const client = this.client;
    const model = this.model;
    const providerName = this.name;

    async function* run(): AsyncGenerator<string> {
      let emitted = "";
      try {
        const stream = client.beta.messages.stream({
          model,
          max_tokens: 64000,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          output_config: { effort: req.effort ?? DEFAULT_EFFORT.mentor_chat },
          system: [
            {
              type: "text",
              text: req.system,
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: req.context,
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: [
            {
              name: SUGGESTIONS_TOOL_NAME,
              description:
                "Attach 1-3 concrete, optional next steps the user can add to their plan with one tap. Call at most once, at the very end of your reply, and only when there is a genuinely useful action.",
              strict: true,
              eager_input_streaming: true,
              input_schema: toStrictJsonSchema(
                req.suggestionsSchema,
              ) as Anthropic.Beta.BetaTool.InputSchema,
            },
          ],
          tool_choice: { type: "auto" },
          messages: req.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            emitted += event.delta.text;
            yield event.delta.text;
          }
        }

        const message = await stream.finalMessage();
        if (message.stop_reason === "refusal") {
          // The whole fallback chain declined; discard partial text.
          const fb = req.fallback();
          yield `\n\n${fb.text}`;
          resolveFinal({
            ...fb,
            provider: providerName,
            model: null,
            usage: null,
            usedFallback: true,
          });
          return;
        }

        let suggestions: S | null = null;
        for (const block of message.content) {
          if (
            block.type === "tool_use" &&
            block.name === SUGGESTIONS_TOOL_NAME
          ) {
            // Eager input streaming skips server-side validation: validate here.
            const parsed = req.suggestionsSchema.safeParse(block.input);
            if (parsed.success) suggestions = parsed.data;
          }
        }

        resolveFinal({
          text: emitted.trim(),
          suggestions,
          provider: providerName,
          model: message.model,
          usage: {
            inputTokens: message.usage.input_tokens,
            outputTokens: message.usage.output_tokens,
          },
          usedFallback: false,
        });
      } catch (error) {
        logFailure("mentor_chat", error);
        if (emitted.length === 0) {
          const fb = req.fallback();
          yield fb.text;
          resolveFinal({
            ...fb,
            provider: providerName,
            model: null,
            usage: null,
            usedFallback: true,
          });
        } else {
          const note =
            "\n\n_(The connection was interrupted. Ask me to continue.)_";
          yield note;
          resolveFinal({
            text: (emitted + note).trim(),
            suggestions: null,
            provider: providerName,
            model,
            usage: null,
            usedFallback: false,
          });
        }
      }
    }

    const iterator = run();
    const textStream: AsyncIterable<string> = {
      [Symbol.asyncIterator]() {
        return {
          next: () => iterator.next(),
          return: async (value?: unknown) => {
            // Consumer stopped early: settle `final` so nothing awaits forever.
            rejectFinal(new Error("stream closed before completion"));
            return iterator.return(value as never);
          },
        };
      },
    };
    final.catch(() => undefined);
    return { textStream, final };
  }
}
