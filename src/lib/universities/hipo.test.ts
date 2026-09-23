import { describe, expect, it } from "vitest";
import { parseHipoDataset } from "./hipo";
import { normalizeSearchText } from "./normalize";

describe("normalizeSearchText", () => {
  it("strips accents and punctuation", () => {
    expect(normalizeSearchText("  Université de Montréal!  ")).toBe(
      "universite de montreal",
    );
    expect(normalizeSearchText("Texas A&M University")).toBe(
      "texas a m university",
    );
  });
});

describe("parseHipoDataset", () => {
  it("normalizes valid rows, skips invalid ones, and merges duplicates", () => {
    const { rows, skipped } = parseHipoDataset([
      {
        name: "San Diego State University",
        country: "United States",
        alpha_two_code: "US",
        "state-province": null,
        domains: ["SDSU.edu"],
        web_pages: ["http://www.sdsu.edu/"],
      },
      { name: "", country: "Nowhere", domains: [], web_pages: [] },
      {
        name: "San Diego State  University",
        country: "United States",
        alpha_two_code: "US",
        domains: ["mail.sdsu.edu"],
        web_pages: ["javascript:alert(1)"],
      },
    ]);
    expect(skipped).toBe(2);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "San Diego State University",
      search_name: "san diego state university",
      domains: ["sdsu.edu", "mail.sdsu.edu"],
      primary_domain: "sdsu.edu",
      country_code: "US",
      website_url: "http://www.sdsu.edu/",
      source_id: "US:san diego state university",
    });
  });

  it("rejects non-array input", () => {
    expect(() => parseHipoDataset({})).toThrow();
  });
});
