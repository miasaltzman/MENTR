import { describe, expect, it } from "vitest";
import { isProtectedPath, safeNextPath } from "./redirects";

describe("safeNextPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeNextPath("/roadmap?view=week")).toBe("/roadmap?view=week");
  });
  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "evil",
    "",
    null,
    "/a\nb",
  ])("rejects %s", (value) => {
    expect(safeNextPath(value as string | null)).toBe("/home");
  });
});

describe("isProtectedPath", () => {
  it("protects app routes and their children", () => {
    expect(isProtectedPath("/home")).toBe(true);
    expect(isProtectedPath("/mentor/abc")).toBe(true);
  });
  it("does not protect public routes or lookalikes", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/homepage")).toBe(false);
  });
});
