import type { Enums } from "@/types/database";

type ResourceType = Enums<"university_resource_type">;

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  career_center: "Career center",
  career_portal: "Career / job portal",
  academic_advising: "Academic advising",
  internships: "Internships",
  tutoring: "Tutoring",
  alumni: "Alumni network",
  entrepreneurship: "Entrepreneurship center",
  incubator: "Incubators & accelerators",
  research: "Undergraduate research",
  study_abroad: "Study abroad",
  scholarships: "Scholarships",
  professional_development: "Professional development",
  departments: "Departments",
  career_fairs: "Career fairs",
  student_organizations: "Student organizations",
  library: "Library",
  wellbeing: "Health & wellbeing",
  other: "Other",
};

/** What each resource is for — shown with search links when nothing is verified. */
export const DISCOVERY_TOPICS: {
  type: ResourceType;
  query: string;
  why: string;
}[] = [
  {
    type: "career_center",
    query: "career center",
    why: "Resume reviews, mock interviews, and employer events.",
  },
  {
    type: "career_portal",
    query: "handshake career portal jobs internships",
    why: "Where most schools post internships and on-campus recruiting.",
  },
  {
    type: "student_organizations",
    query: "student organizations directory",
    why: "Clubs connected to your interests and field.",
  },
  {
    type: "academic_advising",
    query: "academic advising",
    why: "Course planning, requirements, and graduation checks.",
  },
  {
    type: "research",
    query: "undergraduate research opportunities",
    why: "Work with faculty and build real experience.",
  },
  {
    type: "entrepreneurship",
    query: "entrepreneurship center incubator",
    why: "Support for starting projects and ventures.",
  },
  {
    type: "alumni",
    query: "alumni network mentoring",
    why: "Alumni who can share how they got where they are.",
  },
  {
    type: "career_fairs",
    query: "career fair",
    why: "Meet employers recruiting at your school.",
  },
  {
    type: "scholarships",
    query: "scholarships",
    why: "Funding opportunities for current students.",
  },
  { type: "tutoring", query: "tutoring center", why: "Free academic support." },
  {
    type: "study_abroad",
    query: "study abroad",
    why: "Programs to study or intern internationally.",
  },
];

/**
 * A web search restricted to the school's own domain. Presented to users as a
 * search — never as a verified resource.
 */
export function siteSearchUrl(domain: string, query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} ${query}`)}`;
}

/** A URL counts as on-campus only if it belongs to one of the school's domains. */
export function isOnSchoolDomain(url: string, domains: string[]): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}
