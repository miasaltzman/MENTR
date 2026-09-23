import {
  ExternalLink,
  Search,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, PageHeader, Section } from "@/components/app/page";
import {
  SaveResourceButton,
  SuggestLinkForm,
} from "@/components/campus/campus-client";
import { Button } from "@/components/ui/button";
import { requireOnboardedUser } from "@/lib/auth/guards";
import {
  DISCOVERY_TOPICS,
  RESOURCE_TYPE_LABELS,
  siteSearchUrl,
} from "@/lib/campus/resources";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Campus" };

const fmt = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

export default async function CampusPage() {
  const user = await requireOnboardedUser();
  const supabase = await createClient();
  const { data: edu } = await supabase
    .from("education_profiles")
    .select(
      "school_name, universities(id, name, domains, primary_domain, website_url, city, state_region, country, source)",
    )
    .eq("user_id", user.id)
    .eq("is_current", true)
    .limit(1)
    .maybeSingle();

  const uni = edu?.universities;
  if (!uni) {
    return (
      <PageContainer>
        <PageHeader
          title="Campus"
          description={
            edu?.school_name
              ? `We haven’t matched ${edu.school_name} to our university directory yet, so we can’t show verified campus resources.`
              : "Campus resources appear here when you add a college or university to your profile."
          }
        />
        <Button asChild variant="outline">
          <Link href="/profile">Update your school</Link>
        </Button>
      </PageContainer>
    );
  }

  const [{ data: resources }, { data: saved }] = await Promise.all([
    supabase
      .from("university_resources")
      .select(
        "id, type, name, description, url, source_name, source_url, verification_status, last_verified_at",
      )
      .eq("university_id", uni.id)
      .in("verification_status", ["verified", "unverified"])
      .order("type"),
    supabase
      .from("saved_resources")
      .select("university_resource_id")
      .eq("user_id", user.id),
  ]);
  const savedIds = new Set((saved ?? []).map((s) => s.university_resource_id));
  const verified = (resources ?? []).filter(
    (r) => r.verification_status === "verified",
  );
  const unverified = (resources ?? []).filter(
    (r) => r.verification_status === "unverified",
  );
  const coveredTypes = new Set(verified.map((r) => r.type));
  const domain = uni.primary_domain ?? uni.domains[0] ?? null;
  const location = [uni.city, uni.state_region, uni.country]
    .filter(Boolean)
    .join(", ");

  return (
    <PageContainer>
      <PageHeader title={uni.name} description={location || undefined} />

      {uni.website_url ? (
        <a
          href={uni.website_url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between gap-3 border-y py-4"
        >
          <span>
            <span className="block font-medium">Official website</span>
            <span className="block text-xs text-muted-foreground">
              {new URL(uni.website_url).hostname} · from the open
              university-domains directory
            </span>
          </span>
          <ExternalLink className="size-4 text-muted-foreground" />
        </a>
      ) : null}

      <Section title="Verified resources">
        {verified.length ? (
          <ul className="divide-y border-y">
            {verified.map((r) => (
              <li key={r.id} className="flex items-start gap-3 py-4">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
                <div className="min-w-0 flex-1">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                  >
                    {r.name}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {RESOURCE_TYPE_LABELS[r.type]}
                  </p>
                  {r.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {r.description}
                    </p>
                  ) : null}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Verified
                    {r.last_verified_at
                      ? ` · last checked ${fmt(r.last_verified_at)}`
                      : ""}
                    {r.source_name ? ` · source: ${r.source_name}` : ""}
                  </p>
                </div>
                <SaveResourceButton
                  resourceId={r.id}
                  saved={savedIds.has(r.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-l-2 pl-4 text-sm text-pretty text-muted-foreground">
            We haven’t verified specific resources for {uni.name} yet. Rather
            than guess at links, we show searches of the school’s own website
            below so you can find the official pages.
          </p>
        )}
      </Section>

      {unverified.length ? (
        <Section title="Found, not yet verified">
          <ul className="divide-y border-y">
            {unverified.map((r) => (
              <li key={r.id} className="flex items-start gap-3 py-4">
                <ShieldQuestion className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                  >
                    {r.name}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {RESOURCE_TYPE_LABELS[r.type]} · not yet verified —
                    double-check before relying on it
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {domain ? (
        <Section title={`Search ${domain}`}>
          <p className="mb-3 text-sm text-muted-foreground">
            These open a web search limited to {domain}. They’re searches, not
            verified pages.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {DISCOVERY_TOPICS.filter((t) => !coveredTypes.has(t.type)).map(
              (t) => (
                <li key={t.type}>
                  <a
                    href={siteSearchUrl(domain, t.query)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-full items-start gap-3 rounded-2xl bg-muted/60 p-4 transition-colors hover:bg-muted"
                  >
                    <Search className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="block text-sm font-medium">
                        {RESOURCE_TYPE_LABELS[t.type]}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t.why}
                      </span>
                    </span>
                  </a>
                </li>
              ),
            )}
          </ul>
        </Section>
      ) : null}

      <div className="mt-8">
        <SuggestLinkForm universityId={uni.id} />
      </div>
    </PageContainer>
  );
}
