import { z } from "zod";
import { normalizeSearchText } from "./normalize";

/**
 * Adapter for the open Hipo "university-domains-list" dataset (MIT license):
 * https://github.com/Hipo/university-domains-list
 */
export const HIPO_SOURCE = "hipo-university-domains";
export const HIPO_DATASET_URL =
  "https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json";

const hipoRecord = z.object({
  name: z.string().min(1),
  country: z.string().min(1),
  alpha_two_code: z.string().length(2).nullable().optional(),
  "state-province": z.string().nullable().optional(),
  domains: z.array(z.string()).default([]),
  web_pages: z.array(z.string()).default([]),
});

export type UniversityUpsert = {
  name: string;
  search_name: string;
  domains: string[];
  primary_domain: string | null;
  country: string;
  country_code: string | null;
  state_region: string | null;
  website_url: string | null;
  source: string;
  source_id: string;
};

function httpUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:"
      ? u.toString()
      : null;
  } catch {
    return null;
  }
}

/** Validates and normalizes raw dataset JSON; invalid rows are skipped and counted. */
export function parseHipoDataset(raw: unknown): {
  rows: UniversityUpsert[];
  skipped: number;
} {
  if (!Array.isArray(raw)) throw new Error("Dataset is not an array");
  const byId = new Map<string, UniversityUpsert>();
  let skipped = 0;

  for (const item of raw) {
    const parsed = hipoRecord.safeParse(item);
    if (!parsed.success) {
      skipped++;
      continue;
    }
    const r = parsed.data;
    const name = r.name.trim().replace(/\s+/g, " ");
    const domains = [
      ...new Set(r.domains.map((d) => d.trim().toLowerCase()).filter(Boolean)),
    ];
    const countryCode = r.alpha_two_code?.toUpperCase() ?? null;
    // Stable identity across re-imports: country + normalized name.
    const sourceId = `${countryCode ?? r.country}:${normalizeSearchText(name)}`;
    const row: UniversityUpsert = {
      name,
      search_name: normalizeSearchText(name),
      domains,
      primary_domain: domains[0] ?? null,
      country: r.country.trim(),
      country_code: countryCode,
      state_region: r["state-province"]?.trim() || null,
      website_url: httpUrl(r.web_pages[0]),
      source: HIPO_SOURCE,
      source_id: sourceId,
    };
    const existing = byId.get(sourceId);
    if (existing) {
      // Same school listed twice: merge domains.
      existing.domains = [...new Set([...existing.domains, ...row.domains])];
      skipped++;
    } else {
      byId.set(sourceId, row);
    }
  }
  return { rows: [...byId.values()], skipped };
}
