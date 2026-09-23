import { describe, expect, it } from "vitest";
import { guardUrls } from "./url-guard";

const allowed = ["https://career.example.edu/internships"];

describe("guardUrls", () => {
  it("keeps markdown links to verified URLs", () => {
    const input =
      "See [the career center](https://career.example.edu/internships).";
    expect(guardUrls(input, allowed)).toEqual({ text: input, removed: [] });
  });

  it("matches verified URLs regardless of trailing slash or case", () => {
    const input = "Go to https://Career.example.edu/internships/ today";
    expect(guardUrls(input, allowed).removed).toEqual([]);
  });

  it("strips invented markdown links but keeps the label", () => {
    const { text, removed } = guardUrls(
      "Apply to [this internship](https://fake-jobs.example.com/ai-pm).",
      allowed,
    );
    expect(text).toBe("Apply to this internship (unverified link removed).");
    expect(removed).toEqual(["https://fake-jobs.example.com/ai-pm"]);
  });

  it("strips bare invented URLs", () => {
    const { text, removed } = guardUrls(
      "Try https://made-up.example.org/page, it’s great",
      allowed,
    );
    expect(text).toBe("Try (unverified link removed), it’s great");
    expect(removed).toHaveLength(1);
  });

  it("leaves text without links untouched", () => {
    expect(guardUrls("No links here.", allowed).text).toBe("No links here.");
  });
});
