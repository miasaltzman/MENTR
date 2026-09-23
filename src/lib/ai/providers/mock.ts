import type {
  AIProvider,
  ChatFinal,
  ChatRequest,
  ChatStream,
  StructuredRequest,
  StructuredResult,
} from "../types";

/**
 * Deterministic provider for development and tests. It returns each call's
 * rules-based fallback, so the app is fully usable without an API key. The UI
 * labels this mode so simulated guidance is never mistaken for model output.
 */
export class MockProvider implements AIProvider {
  readonly name = "mock" as const;

  async generateObject<T>(
    req: StructuredRequest<T>,
  ): Promise<StructuredResult<T>> {
    return {
      data: req.schema.parse(req.fallback()),
      provider: this.name,
      model: null,
      usage: null,
      usedFallback: true,
    };
  }

  streamChat<S>(req: ChatRequest<S>): ChatStream<S> {
    const reply = req.fallback();
    const finalValue: ChatFinal<S> = {
      text: reply.text,
      suggestions: reply.suggestions,
      provider: this.name,
      model: null,
      usage: null,
      usedFallback: true,
    };

    async function* words(): AsyncGenerator<string> {
      const parts = reply.text.split(/(\s+)/);
      for (const part of parts) {
        yield part;
        await new Promise((r) => setTimeout(r, 8));
      }
    }

    return { textStream: words(), final: Promise.resolve(finalValue) };
  }
}
