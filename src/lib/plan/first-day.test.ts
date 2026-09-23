import { describe, expect, it } from "vitest";
import { demoStudent, exploringAdult } from "../../../tests/fixtures/contexts";
import { rulesInitialPlan } from "./rules";

describe("first day", () => {
  it("starts the demo student with an easy, inviting step", () => {
    const today = rulesInitialPlan(demoStudent).today;
    expect([
      "Find one AI company you’d be excited to intern at",
      "Follow one AI Product Manager on LinkedIn",
    ]).toContain(today.title);
    expect(today.estimated_minutes).toBeLessThanOrEqual(5);
  });

  it("starts explorers with something light", () => {
    expect(
      rulesInitialPlan(exploringAdult).today.estimated_minutes,
    ).toBeLessThanOrEqual(5);
  });
});
