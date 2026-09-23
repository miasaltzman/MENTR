import { describe, expect, it } from "vitest";
import {
  applicableSteps,
  findStep,
  parseAnswer,
  renderPrompt,
  type Answers,
} from "./flow";

const keys = (answers: Answers, tier: "core" | "all" = "all") =>
  applicableSteps(answers, tier).map((s) => s.key);

describe("onboarding flow", () => {
  it("starts with name and situation before anything else", () => {
    expect(keys({}).slice(0, 2)).toEqual(["name", "user_type"]);
  });

  it("adapts to college students", () => {
    const k = keys(
      { name: { value: "Mia" }, user_type: { value: "college_student" } },
      "core",
    );
    expect(k).toEqual(
      expect.arrayContaining([
        "school",
        "study",
        "year",
        "career_certainty",
        "career_interests",
        "goals",
      ]),
    );
    expect(k).not.toContain("current_role");
    expect(k).not.toContain("venture_has_idea");
    expect(k.at(-1)).toBe("goals");
  });

  it("puts every deepen question after the core ones", () => {
    const steps = applicableSteps({ user_type: { value: "college_student" } });
    const firstDeepen = steps.findIndex((s) => s.tier === "deepen");
    expect(steps.slice(firstDeepen).every((s) => s.tier === "deepen")).toBe(
      true,
    );
    expect(steps.map((s) => s.key)).toContain("gpa");
  });

  it("branches entrepreneurs on whether they have an idea", () => {
    const withIdea = keys(
      {
        user_type: { value: "entrepreneur" },
        venture_has_idea: { value: "yes" },
      },
      "core",
    );
    expect(withIdea).toContain("venture_idea");
    expect(withIdea).not.toContain("venture_problems");
    const without = keys(
      {
        user_type: { value: "entrepreneur" },
        venture_has_idea: { value: "no_idea" },
      },
      "core",
    );
    expect(without).toContain("venture_problems");
    expect(without).not.toContain("venture_idea");
  });

  it("shows professionals work questions and pro goals", () => {
    const steps = applicableSteps(
      { user_type: { value: "working_professional" } },
      "core",
    );
    expect(steps.map((s) => s.key)).toEqual(
      expect.arrayContaining(["current_role", "desired_role", "stuck"]),
    );
    const goals = steps.find((s) => s.key === "goals");
    expect(
      goals?.kind === "multi" &&
        goals.options.some((o) => o.value === "Get promoted"),
    ).toBe(true);
  });

  it("uses past tense for recent graduates", () => {
    const steps = applicableSteps(
      { user_type: { value: "recent_graduate" } },
      "core",
    );
    expect(steps.find((s) => s.key === "school")?.prompt).toBe(
      "Where did you go to school?",
    );
  });

  it("validates answers against the step", () => {
    const userType = findStep("user_type")!;
    expect(parseAnswer(userType, { value: "college_student" })).toEqual({
      value: "college_student",
    });
    expect(parseAnswer(userType, { value: "astronaut" })).toBeNull();
    expect(parseAnswer(userType, { skipped: true })).toBeNull(); // required
    expect(parseAnswer(findStep("gpa")!, { skipped: true })).toEqual({
      skipped: true,
    });
    expect(parseAnswer(findStep("gpa")!, { value: 7 })).toBeNull();
    expect(
      parseAnswer(findStep("career_certainty")!, { value: "no_idea" }),
    ).toEqual({ value: "no_idea" });
    expect(
      parseAnswer(findStep("industries")!, {
        values: ["Space tourism", "not_sure"],
      }),
    ).not.toBeNull();
  });

  it("personalizes prompts with the first name", () => {
    expect(
      renderPrompt("Nice to meet you, {name}.", {
        name: { value: "Mia Saltzman" },
      }),
    ).toBe("Nice to meet you, Mia.");
    expect(renderPrompt("Nice to meet you, {name}.", {})).toBe(
      "Nice to meet you.",
    );
  });
});
