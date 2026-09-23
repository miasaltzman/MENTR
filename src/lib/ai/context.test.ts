import { describe, expect, it } from "vitest";
import { demoStudent, exploringAdult } from "../../../tests/fixtures/contexts";
import { renderMentorContext } from "./context";

describe("renderMentorContext", () => {
  it("includes the essentials for a student", () => {
    const text = renderMentorContext(demoStudent);
    expect(text).toContain("College / university student");
    expect(text).toContain("San Diego State University");
    expect(text).toContain(
      "Major(s): Artificial Intelligence; minor(s): Data Science",
    );
    expect(text).toContain("AI Product Management");
    expect(text).toContain("Technology Entrepreneurship (curious)");
  });

  it("treats unknowns as 'not sure yet' rather than omitting or inventing", () => {
    const text = renderMentorContext(exploringAdult);
    expect(text).toContain("Career interests: not sure yet");
    expect(text).toContain("Goals: not sure yet");
    expect(text).not.toContain("## Education");
  });

  it("stays compact", () => {
    const busy = {
      ...demoStudent,
      memories: Array.from({ length: 50 }, (_, i) => ({
        kind: "fact" as const,
        content: `memory ${i}`,
      })),
    };
    const text = renderMentorContext(busy);
    expect(text.match(/memory \d+/g)).toHaveLength(15);
    expect(text.length).toBeLessThan(6000);
  });
});
