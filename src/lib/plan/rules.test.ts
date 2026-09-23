import { describe, expect, it } from "vitest";
import type { MentorContext } from "@/lib/ai/context";
import { demoStudent, exploringAdult } from "../../../tests/fixtures/contexts";
import { rulesDailyAction, rulesInitialPlan } from "./rules";
import { initialPlanDraft, isUsablePlan, sanitizePlan } from "./schemas";

const founder: MentorContext = {
  ...exploringAdult,
  profile: {
    ...exploringAdult.profile,
    userType: "entrepreneur",
    careerCertainty: null,
  },
  venture: {
    hasIdea: "yes",
    ideaSummary: "Small-batch hot sauce sold at farmers markets",
    industry: "Food",
    offeringType: "product",
    channel: "physical",
    stage: "idea",
    targetCustomer: null,
  },
};
const founderNoIdea: MentorContext = {
  ...founder,
  venture: { ...founder.venture!, hasIdea: "no_idea", ideaSummary: null },
};
const professional: MentorContext = {
  ...exploringAdult,
  profile: {
    ...exploringAdult.profile,
    userType: "working_professional",
    careerCertainty: "yes",
  },
  professional: {
    currentTitle: "Marketing coordinator",
    industry: "Software",
    yearsExperience: 3,
    desiredNextRole: "Product marketing manager",
    desiredCareer: null,
    stuckPoints: null,
    constraints: null,
    timeline: null,
  },
};

describe("rulesInitialPlan", () => {
  it("builds a directed, personalized plan for the demo student", () => {
    const plan = rulesInitialPlan(demoStudent);
    expect(plan.mode).toBe("directed");
    expect(plan.title).toBe("Path to AI Product Management");
    expect(plan.milestones.some((m) => m.title.includes("internship"))).toBe(
      true,
    );
    expect(
      plan.milestones.some((m) =>
        m.description.includes("San Diego State University"),
      ),
    ).toBe(true);
    expect(plan.today.milestone_ref).not.toBeNull();
  });

  it("explores instead of committing when the user is unsure", () => {
    const plan = rulesInitialPlan(exploringAdult);
    expect(plan.mode).toBe("exploring");
    expect(plan.title).toBe("Finding your direction");
    expect(plan.today.category).toBe("career_exploration");
  });

  it("follows the idea-to-launch path for founders, including permits for physical businesses", () => {
    const plan = rulesInitialPlan(founder);
    expect(plan.title).toBe("From idea to launch");
    expect(plan.milestones.map((m) => m.key)).toEqual(
      expect.arrayContaining(["validate", "economics", "rules"]),
    );
    expect(plan.today.category).toBe("business");
    expect(rulesInitialPlan(founderNoIdea).title).toBe(
      "Finding your business idea",
    );
  });

  it.each([
    ["student", demoStudent],
    ["explorer", exploringAdult],
    ["founder", founder],
    ["founder without idea", founderNoIdea],
    ["professional", professional],
  ])("produces a valid, usable, sanitized plan for %s", (_name, ctx) => {
    const plan = sanitizePlan(initialPlanDraft.parse(rulesInitialPlan(ctx)));
    expect(isUsablePlan(plan)).toBe(true);
    const keys = new Set(plan.milestones.map((m) => m.key));
    for (const m of plan.milestones)
      if (m.parent_key) expect(keys.has(m.parent_key)).toBe(true);
    expect(plan.weekly_priorities.length).toBeGreaterThanOrEqual(3);
    expect(plan.weekly_priorities.length).toBeLessThanOrEqual(5);
  });
});

describe("rulesDailyAction", () => {
  const milestones = [{ ref: "m1", category: "experience" as const }];

  it("returns different sizes of the same step for easier / harder", () => {
    const standard = rulesDailyAction(demoStudent, { milestones, seed: "x" });
    const lighter = rulesDailyAction(demoStudent, {
      milestones,
      seed: "x",
      difficulty: "lighter",
    });
    const stretch = rulesDailyAction(demoStudent, {
      milestones,
      seed: "x",
      difficulty: "stretch",
    });
    expect(lighter.estimated_minutes).toBeLessThan(standard.estimated_minutes);
    expect(stretch.estimated_minutes).toBeGreaterThan(
      standard.estimated_minutes,
    );
    expect(new Set([lighter.why, standard.why, stretch.why]).size).toBe(1);
  });

  it("avoids recently used actions when replacing", () => {
    const first = rulesDailyAction(demoStudent, { milestones, seed: "y" });
    const next = rulesDailyAction(demoStudent, {
      milestones,
      seed: "y",
      avoidTitles: [first.title],
    });
    expect(next.title).not.toBe(first.title);
  });

  it("prefers categories the user hasn't worked on recently", () => {
    const busy: MentorContext = {
      ...demoStudent,
      recentActions: Array.from({ length: 5 }, (_, i) => ({
        date: `2026-09-${10 + i}`,
        title: `n${i}`,
        category: "networking" as const,
        status: "completed" as const,
      })),
    };
    for (const seed of ["a", "b", "c", "d"]) {
      expect(rulesDailyAction(busy, { milestones, seed }).category).not.toBe(
        "networking",
      );
    }
  });

  it("keeps actions small and meaningful", () => {
    for (const ctx of [
      demoStudent,
      exploringAdult,
      founder,
      founderNoIdea,
      professional,
    ]) {
      const a = rulesDailyAction(ctx, { milestones: [] });
      expect(a.estimated_minutes).toBeGreaterThanOrEqual(5);
      expect(a.estimated_minutes).toBeLessThanOrEqual(45);
      expect(a.why.length).toBeGreaterThan(20);
    }
  });
});

describe("sanitizePlan", () => {
  it("dedupes keys, caps horizons, and drops dangling references", () => {
    const base = rulesInitialPlan(demoStudent);
    const messy = {
      ...base,
      milestones: [
        ...base.milestones,
        { ...base.milestones[0] },
        ...Array.from({ length: 6 }, (_, i) => ({
          ...base.milestones[0],
          key: `lt-${i}`,
          parent_key: "missing",
        })),
      ],
      weekly_priorities: [...base.weekly_priorities, ...base.weekly_priorities],
      today: { ...base.today, estimated_minutes: 500 },
    };
    const clean = sanitizePlan(messy);
    expect(
      clean.milestones.filter((m) => m.horizon === "long_term").length,
    ).toBeLessThanOrEqual(2);
    expect(
      clean.milestones.every(
        (m) => m.parent_key === null || m.parent_key !== "missing",
      ),
    ).toBe(true);
    expect(clean.weekly_priorities.length).toBeLessThanOrEqual(5);
    expect(clean.today.estimated_minutes).toBe(60);
  });
});

describe("resizeRulesAction", () => {
  it("keeps the same idea when making an action easier or harder", async () => {
    const { resizeRulesAction } = await import("./rules");
    const original = rulesDailyAction(demoStudent, {
      milestones: [],
      seed: "z",
    });
    const easier = resizeRulesAction(
      demoStudent,
      { title: original.title, milestone_ref: "m-1" },
      "lighter",
    );
    expect(easier).not.toBeNull();
    expect(easier!.why).toBe(original.why);
    expect(easier!.category).toBe(original.category);
    expect(easier!.estimated_minutes).toBeLessThan(original.estimated_minutes);
    expect(easier!.milestone_ref).toBe("m-1");
    expect(
      resizeRulesAction(
        demoStudent,
        { title: "Unknown", milestone_ref: null },
        "lighter",
      ),
    ).toBeNull();
  });
});
