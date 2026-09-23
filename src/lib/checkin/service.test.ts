import { describe, expect, it } from "vitest";
import { demoStudent } from "../../../tests/fixtures/contexts";
import { checkinReview } from "./schemas";
import { rulesCheckinReview, targetWeek } from "./service";

describe("weekly check-in", () => {
  it("plans next week on Friday–Sunday and this week otherwise", () => {
    expect(targetWeek("2026-09-25")).toBe("2026-09-28"); // Friday
    expect(targetWeek("2026-09-27")).toBe("2026-09-28"); // Sunday
    expect(targetWeek("2026-09-23")).toBe("2026-09-21"); // Wednesday
  });

  it("puts the user's own priority first and stays gentle when things felt hard", () => {
    const ctx = {
      ...demoStudent,
      roadmap: {
        id: "r",
        title: "t",
        northStar: null,
        mode: "directed" as const,
        milestones: [
          {
            id: "m1",
            horizon: "month" as const,
            title: "Get your resume internship-ready",
            status: "not_started" as const,
            category: "applications" as const,
          },
        ],
      },
    };
    const review = rulesCheckinReview(ctx, {
      progress: "",
      changes: "",
      difficulties: "Midterms took all my time",
      nextPriority: "Apply to two internships",
    });
    expect(checkinReview.safeParse(review).success).toBe(true);
    expect(review.next_week_priorities[0].title).toBe(
      "Apply to two internships",
    );
    expect(review.mentor_note).toContain("small");
    expect(review.milestone_updates).toEqual([]);
    expect(review.next_week_priorities[1].title).toBe(
      "Improve one resume bullet",
    );
  });

  it("acknowledges the progress the user reports", () => {
    const review = rulesCheckinReview(demoStudent, {
      progress: "Joined the AI club",
      changes: "",
      difficulties: "",
      nextPriority: "",
    });
    expect(review.mentor_note).toContain("Joined the AI club");
    expect(review.mentor_note).not.toContain("quiet");
  });
});
