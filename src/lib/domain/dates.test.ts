import { describe, expect, it } from "vitest";
import { addDays, greetingFor, localDate, localHour, weekStart } from "./dates";

describe("dates", () => {
  const instant = new Date("2026-09-24T03:30:00Z"); // Wed 03:30 UTC

  it("computes the user-local date across the date line", () => {
    expect(localDate("UTC", instant)).toBe("2026-09-24");
    expect(localDate("America/Los_Angeles", instant)).toBe("2026-09-23");
    expect(localDate("Not/AZone", instant)).toBe("2026-09-24");
  });

  it("finds the Monday week start", () => {
    expect(weekStart("2026-09-23")).toBe("2026-09-21"); // Wednesday
    expect(weekStart("2026-09-27")).toBe("2026-09-21"); // Sunday
    expect(weekStart("2026-09-21")).toBe("2026-09-21"); // Monday
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
  });

  it("greets by local hour", () => {
    expect(localHour("America/Los_Angeles", instant)).toBe(20);
    expect(greetingFor(8)).toBe("Good morning");
    expect(greetingFor(14)).toBe("Good afternoon");
    expect(greetingFor(20)).toBe("Good evening");
  });
});
