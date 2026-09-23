import type { Enums } from "@/types/database";

export const USER_TYPE_LABELS: Record<Enums<"user_type">, string> = {
  college_student: "College / university student",
  high_school_student: "High school student",
  recent_graduate: "Recent graduate",
  working_professional: "Working professional",
  entrepreneur: "Entrepreneur / aspiring founder",
  career_changer: "Career changer",
  exploring: "Exploring / not sure yet",
};

export const CATEGORY_LABELS: Record<Enums<"action_category">, string> = {
  skills: "Skills",
  networking: "Networking",
  experience: "Experience",
  career_exploration: "Career exploration",
  applications: "Applications",
  learning: "Learning",
  business: "Business",
};

export const HORIZON_LABELS: Record<Enums<"horizon">, string> = {
  long_term: "Long term",
  year: "This year",
  term: "This semester",
  month: "This month",
  week: "This week",
  today: "Today",
};

/** Non-students think in quarters, not semesters. */
export function horizonLabel(h: Enums<"horizon">, isStudent: boolean): string {
  if (h === "term") return isStudent ? "This semester" : "This quarter";
  return HORIZON_LABELS[h];
}

export const CERTAINTY_LABELS: Record<Enums<"certainty_level">, string> = {
  yes: "Yes",
  kind_of: "Kind of",
  no_idea: "Not sure yet",
};

export const RELOCATION_LABELS: Record<
  Enums<"relocation_preference">,
  string
> = {
  stay: "Stay where I am",
  specific: "Move somewhere specific",
  open: "Open to moving",
  remote: "Remote",
  not_sure: "Not sure yet",
};

export const STUDENT_TYPES: ReadonlySet<Enums<"user_type">> = new Set([
  "college_student",
  "high_school_student",
]);
