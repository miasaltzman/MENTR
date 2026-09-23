import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { normalizeSearchText } from "@/lib/universities/normalize";

const querySchema = z.object({
  q: z.string().trim().min(2).max(100),
  country: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .optional(),
});

export type UniversitySearchResult = {
  id: string;
  name: string;
  location: string;
  domain: string | null;
};

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = querySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
    country: request.nextUrl.searchParams.get("country") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ results: [] });

  const query = normalizeSearchText(parsed.data.q);
  if (query.length < 2) return NextResponse.json({ results: [] });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_universities", {
    p_query: query,
    p_country_code: parsed.data.country?.toUpperCase(),
    p_limit: 8,
  });
  if (error) {
    console.error("[universities] search failed", error.message);
    return NextResponse.json({ error: "search_failed" }, { status: 502 });
  }

  const results: UniversitySearchResult[] = (data ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    location: [u.city, u.state_region, u.country].filter(Boolean).join(", "),
    domain: u.primary_domain,
  }));
  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
