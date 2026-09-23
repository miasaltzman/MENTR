import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toStrictJsonSchema } from "./json-schema";

describe("toStrictJsonSchema", () => {
  it("closes objects and marks every property required, recursively", () => {
    const schema = z.object({
      items: z.array(
        z.object({ title: z.string(), note: z.string().nullable() }),
      ),
    });
    const json = toStrictJsonSchema(schema) as {
      additionalProperties: boolean;
      required: string[];
      properties: {
        items: { items: { additionalProperties: boolean; required: string[] } };
      };
      $schema?: string;
    };
    expect(json.$schema).toBeUndefined();
    expect(json.additionalProperties).toBe(false);
    expect(json.required).toEqual(["items"]);
    expect(json.properties.items.items.additionalProperties).toBe(false);
    expect(json.properties.items.items.required).toEqual(["title", "note"]);
  });
});
