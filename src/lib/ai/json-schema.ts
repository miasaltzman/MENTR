import { z } from "zod";

type JsonSchema = { [key: string]: unknown };

/**
 * Converts a Zod schema to JSON Schema suitable for `strict: true` tools:
 * every object gets `additionalProperties: false` and lists all properties as
 * required (optional values must be modelled as nullable instead).
 */
export function toStrictJsonSchema(schema: z.ZodType): JsonSchema {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as JsonSchema;
  delete json.$schema;
  return strictify(json) as JsonSchema;
}

function strictify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictify);
  if (!node || typeof node !== "object") return node;
  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(node as JsonSchema)) {
    out[key] = strictify(value);
  }
  if (
    out.type === "object" &&
    out.properties &&
    typeof out.properties === "object"
  ) {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties as JsonSchema);
  }
  return out;
}
