import { describe, expect, it } from "vitest";
import { demoStudent, exploringAdult } from "../../../tests/fixtures/contexts";
import { rulesMentorReply } from "./rules-reply";
import { sanitizeSuggestions, suggestionsSchema } from "./schemas";

describe("rulesMentorReply", () => {
  it.each([
    "I feel behind",
    "What should I do this summer?",
    "Give me a project idea",
    "Help me prepare for a career fair",
    "I have no idea what career I want",
    "Help me build a business",
    "What should I do this week?",
    "Should I change majors?",
  ])("answers “%s” with valid, personalized output and no URLs", (q) => {
    const r = rulesMentorReply(demoStudent, q);
    expect(r.text.length).toBeGreaterThan(80);
    expect(r.text).not.toMatch(/https?:\/\//);
    if (r.suggestions)
      expect(suggestionsSchema.safeParse(r.suggestions).success).toBe(true);
  });

  it("uses the user's own details", () => {
    expect(
      rulesMentorReply(demoStudent, "what should I do this summer").text,
    ).toContain("AI Product Management");
    expect(
      rulesMentorReply(exploringAdult, "what should I do this summer").text,
    ).toContain("the field you’re exploring");
  });
});

describe("sanitizeSuggestions", () => {
  it("normalizes kinds, clamps minutes, and caps count", () => {
    const out = sanitizeSuggestions({
      items: [
        {
          kind: "set_today",
          title: " Do it ",
          why: "w",
          horizon: "year",
          category: null,
          estimated_minutes: 500,
        },
        {
          kind: "add_milestone",
          title: "M",
          why: "w",
          horizon: null,
          category: null,
          estimated_minutes: 3,
        },
        {
          kind: "add_milestone",
          title: "",
          why: "w",
          horizon: null,
          category: null,
          estimated_minutes: null,
        },
        {
          kind: "add_milestone",
          title: "A",
          why: "w",
          horizon: "year",
          category: null,
          estimated_minutes: null,
        },
        {
          kind: "add_milestone",
          title: "B",
          why: "w",
          horizon: "year",
          category: null,
          estimated_minutes: null,
        },
      ],
    });
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({
      title: "Do it",
      horizon: null,
      estimated_minutes: 60,
    });
    expect(out[1]).toMatchObject({ horizon: "month", estimated_minutes: null });
  });
});
