import {
  BookOpen,
  Briefcase,
  GraduationCap,
  Newspaper,
  Route,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, PageHeader, Section } from "@/components/app/page";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Explore" };

const COMING = [
  {
    icon: Briefcase,
    title: "Opportunities",
    body: "Internships, jobs, fellowships, and events matched to your goals — pulled from real listings with source and date.",
  },
  {
    icon: Newspaper,
    title: "Stay current",
    body: "A few important developments in your field each week, with why they matter for you.",
  },
  {
    icon: Route,
    title: "Career paths",
    body: "What roles actually involve, how people get in, and how close you are — from trusted career data.",
  },
  {
    icon: BookOpen,
    title: "Resources",
    body: "A small number of high-value courses, books, and communities, each with a reason it fits you.",
  },
];

export default async function ExplorePage() {
  const user = await requireOnboardedUser();
  const supabase = await createClient();
  const { data: edu } = await supabase
    .from("education_profiles")
    .select("universities(name)")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .limit(1)
    .maybeSingle();

  return (
    <PageContainer>
      <PageHeader
        title="Explore"
        description="Real resources and opportunities, chosen for where you’re headed."
      />

      {edu?.universities ? (
        <Link
          href="/explore/campus"
          className="flex items-center gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/30"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <GraduationCap className="size-5" />
          </span>
          <span>
            <span className="block font-semibold">Your campus</span>
            <span className="block text-sm text-muted-foreground">
              Resources at {edu.universities.name}
            </span>
          </span>
        </Link>
      ) : null}

      <Section title="Coming next">
        <p className="mb-4 text-sm text-pretty text-muted-foreground">
          These are being connected to real, current data sources. We won’t show
          anything here until it comes from a source we can cite and date.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {COMING.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-2xl border border-dashed p-4">
              <Icon className="size-5 text-muted-foreground" />
              <p className="mt-3 font-medium">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </Section>
    </PageContainer>
  );
}
