import { describe, expect, it } from "vitest";
import { isOnSchoolDomain, siteSearchUrl } from "./resources";

describe("campus helpers", () => {
  it("builds a site-restricted search", () => {
    expect(siteSearchUrl("sdsu.edu", "career center")).toBe(
      "https://www.google.com/search?q=site%3Asdsu.edu%20career%20center",
    );
  });
  it("accepts only the school's own domains and subdomains", () => {
    expect(isOnSchoolDomain("https://career.sdsu.edu/x", ["sdsu.edu"])).toBe(
      true,
    );
    expect(isOnSchoolDomain("https://sdsu.edu", ["sdsu.edu"])).toBe(true);
    expect(isOnSchoolDomain("https://notsdsu.edu", ["sdsu.edu"])).toBe(false);
    expect(isOnSchoolDomain("https://sdsu.edu.evil.com", ["sdsu.edu"])).toBe(
      false,
    );
    expect(isOnSchoolDomain("not a url", ["sdsu.edu"])).toBe(false);
  });
});
