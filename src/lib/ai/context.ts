import {
  CATEGORY_LABELS,
  CERTAINTY_LABELS,
  HORIZON_LABELS,
  RELOCATION_LABELS,
  STUDENT_TYPES,
  USER_TYPE_LABELS,
} from "@/lib/domain/labels";
import type { Enums } from "@/types/database";

/**
 * The compact, structured picture of a user that every AI call receives.
 * Built from the database by `loadMentorContext`; rendered to text by
 * `renderMentorContext`. Deliberately small — never the whole database.
 */
export type MentorContext = {
  today: string;
  profile: {
    firstName: string | null;
    userType: Enums<"user_type"> | null;
    location: string | null;
    relocation: Enums<"relocation_preference"> | null;
    preferredLocations: string[];
    openToRemote: boolean | null;
    careerCertainty: Enums<"certainty_level"> | null;
  };
  education: {
    level: string;
    school: string | null;
    yearInSchool: string | null;
    expectedGraduation: string | null;
    majors: string[];
    minors: string[];
  } | null;
  professional: {
    currentTitle: string | null;
    industry: string | null;
    yearsExperience: number | null;
    desiredNextRole: string | null;
    desiredCareer: string | null;
    stuckPoints: string | null;
    constraints: string | null;
    timeline: string | null;
  } | null;
  venture: {
    hasIdea: Enums<"certainty_level"> | null;
    ideaSummary: string | null;
    industry: string | null;
    offeringType: string | null;
    channel: string | null;
    stage: string | null;
    targetCustomer: string | null;
  } | null;
  preferences: {
    industries: string[];
    companiesAdmired: string[];
    lifestylePriorities: string[];
    skillsToLearn: string[];
    fiveYearVision: string | null;
    gradSchoolInterest: Enums<"certainty_level"> | null;
    entrepreneurshipInterest: Enums<"certainty_level"> | null;
  } | null;
  careerInterests: {
    label: string;
    certainty: Enums<"certainty_level"> | null;
  }[];
  goals: { title: string; horizon: Enums<"horizon"> }[];
  skills: {
    name: string;
    category: Enums<"skill_category">;
    status: "current" | "target";
  }[];
  roadmap: {
    id: string;
    title: string;
    northStar: string | null;
    mode: "directed" | "exploring";
    milestones: {
      id: string;
      horizon: Enums<"horizon">;
      title: string;
      status: Enums<"milestone_status">;
      category: Enums<"action_category"> | null;
    }[];
  } | null;
  recentActions: {
    date: string;
    title: string;
    category: Enums<"action_category">;
    status: Enums<"action_status">;
  }[];
  progress: { totalCompleted: number; activeDaysLast7: number };
  memories: { kind: Enums<"memory_kind">; content: string }[];
  /** Verified campus resources — the only URLs the mentor may cite. */
  verifiedLinks: { name: string; url: string }[];
};

export function isStudent(ctx: MentorContext): boolean {
  return (
    ctx.profile.userType !== null && STUDENT_TYPES.has(ctx.profile.userType)
  );
}

const unsure = "not sure yet";
const list = (xs: string[], max = 8) =>
  xs.length ? xs.slice(0, max).join(", ") : unsure;
const val = (x: string | number | null | undefined) =>
  x === null || x === undefined || x === "" ? unsure : String(x);

/** Renders the context as compact text for prompts (~1-2k tokens max). */
export function renderMentorContext(ctx: MentorContext): string {
  const lines: string[] = [];
  const p = ctx.profile;
  lines.push(`# About the user (today is ${ctx.today})`);
  lines.push(`- Name: ${p.firstName ?? "unknown"}`);
  lines.push(
    `- Situation: ${p.userType ? USER_TYPE_LABELS[p.userType] : unsure}`,
  );
  lines.push(`- Lives in: ${val(p.location)}`);
  lines.push(
    `- Future location: ${p.relocation ? RELOCATION_LABELS[p.relocation] : unsure}` +
      (p.preferredLocations.length ? ` (${list(p.preferredLocations)})` : "") +
      (p.openToRemote ? "; open to remote" : ""),
  );
  lines.push(
    `- Knows what they want to do: ${p.careerCertainty ? CERTAINTY_LABELS[p.careerCertainty] : unsure}`,
  );

  if (ctx.education) {
    const e = ctx.education;
    lines.push("", "## Education");
    lines.push(
      `- ${e.level.replace("_", " ")} at ${val(e.school)}, year: ${val(e.yearInSchool)}`,
    );
    lines.push(
      `- Major(s): ${list(e.majors)}; minor(s): ${e.minors.length ? list(e.minors) : "none"}`,
    );
    if (e.expectedGraduation)
      lines.push(`- Expected graduation: ${e.expectedGraduation}`);
  }

  if (ctx.professional) {
    const w = ctx.professional;
    lines.push("", "## Work");
    lines.push(
      `- Current: ${val(w.currentTitle)} in ${val(w.industry)} (${val(w.yearsExperience)} yrs)`,
    );
    if (w.desiredNextRole) lines.push(`- Wants next: ${w.desiredNextRole}`);
    if (w.desiredCareer) lines.push(`- Target career: ${w.desiredCareer}`);
    if (w.stuckPoints) lines.push(`- Feels stuck on: ${w.stuckPoints}`);
    if (w.constraints) lines.push(`- Constraints: ${w.constraints}`);
    if (w.timeline) lines.push(`- Timeline: ${w.timeline}`);
  }

  if (ctx.venture) {
    const v = ctx.venture;
    lines.push("", "## Venture");
    lines.push(
      `- Has an idea: ${v.hasIdea ? CERTAINTY_LABELS[v.hasIdea] : unsure}`,
    );
    if (v.ideaSummary) lines.push(`- Idea: ${v.ideaSummary}`);
    lines.push(
      `- Industry: ${val(v.industry)}; offering: ${val(v.offeringType)}; channel: ${val(v.channel)}; stage: ${val(v.stage)}`,
    );
    if (v.targetCustomer) lines.push(`- Target customer: ${v.targetCustomer}`);
  }

  lines.push("", "## Direction");
  lines.push(
    `- Career interests: ${
      ctx.careerInterests.length
        ? ctx.careerInterests
            .map((c) =>
              c.certainty === "no_idea" ? `${c.label} (curious)` : c.label,
            )
            .join(", ")
        : unsure
    }`,
  );
  lines.push(
    `- Goals: ${ctx.goals.length ? ctx.goals.map((g) => `${g.title} [${HORIZON_LABELS[g.horizon]}]`).join("; ") : unsure}`,
  );
  if (ctx.preferences) {
    const pr = ctx.preferences;
    lines.push(`- Industries: ${list(pr.industries)}`);
    if (pr.companiesAdmired.length)
      lines.push(`- Admires: ${list(pr.companiesAdmired)}`);
    if (pr.lifestylePriorities.length)
      lines.push(`- Lifestyle priorities: ${list(pr.lifestylePriorities)}`);
    if (pr.skillsToLearn.length)
      lines.push(`- Wants to learn: ${list(pr.skillsToLearn)}`);
    if (pr.fiveYearVision)
      lines.push(`- Five-year vision: ${pr.fiveYearVision}`);
    if (pr.gradSchoolInterest)
      lines.push(
        `- Grad school interest: ${CERTAINTY_LABELS[pr.gradSchoolInterest]}`,
      );
    if (pr.entrepreneurshipInterest)
      lines.push(
        `- Entrepreneurship interest: ${CERTAINTY_LABELS[pr.entrepreneurshipInterest]}`,
      );
  }

  const current = ctx.skills
    .filter((s) => s.status === "current")
    .map((s) => s.name);
  const target = ctx.skills
    .filter((s) => s.status === "target")
    .map((s) => s.name);
  lines.push(`- Current skills: ${list(current, 12)}`);
  if (target.length) lines.push(`- Skills to build: ${list(target, 12)}`);

  if (ctx.roadmap) {
    const r = ctx.roadmap;
    lines.push(
      "",
      `## Roadmap: ${r.title}${r.mode === "exploring" ? " (exploration mode)" : ""}`,
    );
    if (r.northStar) lines.push(`- North star: ${r.northStar}`);
    const open = r.milestones.filter(
      (m) => m.status !== "completed" && m.status !== "skipped",
    );
    const done = r.milestones.filter((m) => m.status === "completed");
    for (const m of open.slice(0, 12)) {
      lines.push(
        `- [${HORIZON_LABELS[m.horizon]}] ${m.title}${m.status === "in_progress" ? " (in progress)" : ""} {id:${m.id}}`,
      );
    }
    if (done.length)
      lines.push(
        `- Completed: ${done
          .slice(0, 8)
          .map((m) => m.title)
          .join("; ")}`,
      );
  }

  lines.push("", "## Recent activity");
  lines.push(
    `- ${ctx.progress.totalCompleted} growth actions completed so far; active ${ctx.progress.activeDaysLast7} of the last 7 days`,
  );
  for (const a of ctx.recentActions.slice(0, 7)) {
    lines.push(
      `- ${a.date}: ${a.title} (${CATEGORY_LABELS[a.category]}, ${a.status})`,
    );
  }

  if (ctx.memories.length) {
    lines.push("", "## Things the user has told you");
    for (const m of ctx.memories.slice(0, 15))
      lines.push(`- (${m.kind}) ${m.content}`);
  }

  if (ctx.verifiedLinks.length) {
    lines.push("", "## Verified links you may share (no others)");
    for (const l of ctx.verifiedLinks.slice(0, 15))
      lines.push(`- ${l.name}: ${l.url}`);
  }

  return lines.join("\n");
}
