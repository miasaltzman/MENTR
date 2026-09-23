import { z } from "zod";
import type { Enums } from "@/types/database";

/**
 * Declarative onboarding flow shared by client (rendering) and server
 * (validation + persistence). Questions adapt to the user's situation; every
 * non-essential question accepts "Not sure yet" or can be skipped.
 */

export type UserType = Enums<"user_type">;

export const NOT_SURE = "not_sure";

export type Option = { value: string; label: string; hint?: string };

type Base = {
  key: string;
  /** Mentor-voice prompt. `{name}` is replaced with the user's first name. */
  prompt: string;
  helper?: string;
  /** Which situations see this question. Omit for everyone. */
  audience?: UserType[];
  /** Core questions build the first plan; deepen questions sharpen it. */
  tier: "core" | "deepen";
  optional?: boolean;
  /** Extra condition on earlier answers. */
  when?: (answers: Answers) => boolean;
};

export type Step =
  | (Base & { kind: "text"; placeholder?: string; maxLength?: number })
  | (Base & { kind: "longtext"; placeholder?: string })
  | (Base & { kind: "choice"; options: Option[]; allowNotSure?: boolean })
  | (Base & {
      kind: "multi";
      options: Option[];
      allowCustom?: boolean;
      allowNotSure?: boolean;
      max?: number;
    })
  | (Base & {
      kind: "tags";
      suggestions: string[];
      placeholder?: string;
      max?: number;
    })
  | (Base & { kind: "school" })
  | (Base & { kind: "study"; minorsLabel?: string })
  | (Base & { kind: "schoolYear"; years: Option[] })
  | (Base & {
      kind: "number";
      min: number;
      max: number;
      stepSize: number;
      placeholder?: string;
    })
  | (Base & { kind: "location" });

// ---------------------------------------------------------------------------
// Answer schemas (one per kind). Skipped answers are stored as { skipped: true }.
// ---------------------------------------------------------------------------
const short = z.string().trim().min(1).max(200);
const long = z.string().trim().min(1).max(2000);
const tagList = z.array(z.string().trim().min(1).max(80)).max(20);

export const answerSchemas = {
  text: z.object({ value: short }),
  longtext: z.object({ value: long }),
  choice: z.object({ value: z.string().min(1).max(60) }),
  multi: z.object({
    values: z.array(z.string().trim().min(1).max(80)).max(15),
  }),
  tags: z.object({ values: tagList }),
  school: z.object({
    id: z.uuid().nullable(),
    name: short,
    location: z.string().max(200).optional(),
  }),
  study: z.object({
    major: z.string().trim().max(120).nullable(),
    secondMajor: z.string().trim().max(120).nullable(),
    minors: z.array(z.string().trim().min(1).max(120)).max(4),
  }),
  schoolYear: z.object({
    year: z.string().max(40).nullable(),
    graduation: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .nullable(),
  }),
  number: z.object({ value: z.number().finite() }),
  location: z.object({
    current: z.string().trim().max(120).nullable(),
    relocation: z
      .enum(["stay", "specific", "open", "remote", "not_sure"])
      .nullable(),
    places: z.array(z.string().trim().min(1).max(80)).max(8),
  }),
} as const;

export type AnswerFor<K extends Step["kind"]> = z.infer<
  (typeof answerSchemas)[K]
>;
export type Answer = { skipped: true } | AnswerFor<Step["kind"]>;
export type Answers = Record<string, Answer | undefined>;

export function isSkipped(a: Answer | undefined): a is { skipped: true } {
  return !!a && "skipped" in a && a.skipped === true;
}

export function choiceValue(answers: Answers, key: string): string | null {
  const a = answers[key];
  if (!a || isSkipped(a) || !("value" in a) || typeof a.value !== "string")
    return null;
  return a.value;
}

/** Validates an answer for a step; returns null when invalid. */
export function parseAnswer(step: Step, raw: unknown): Answer | null {
  if (
    raw &&
    typeof raw === "object" &&
    (raw as { skipped?: unknown }).skipped === true
  ) {
    return step.optional ? { skipped: true } : null;
  }
  const parsed = answerSchemas[step.kind].safeParse(raw);
  if (!parsed.success) return null;
  const value = parsed.data;
  if (step.kind === "choice") {
    const v = (value as AnswerFor<"choice">).value;
    const allowed =
      step.options.some((o) => o.value === v) ||
      (step.allowNotSure && v === NOT_SURE);
    if (!allowed) return null;
  }
  if (step.kind === "multi") {
    const vals = (value as AnswerFor<"multi">).values;
    if (
      !step.allowCustom &&
      vals.some(
        (v) => !step.options.some((o) => o.value === v) && v !== NOT_SURE,
      )
    ) {
      return null;
    }
    if (step.max && vals.length > step.max) return null;
  }
  if (step.kind === "number") {
    const n = (value as AnswerFor<"number">).value;
    if (n < step.min || n > step.max) return null;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Shared option lists
// ---------------------------------------------------------------------------
export const USER_TYPE_OPTIONS: Option[] = [
  { value: "college_student", label: "College / university student" },
  { value: "high_school_student", label: "High school student" },
  { value: "recent_graduate", label: "Recent graduate" },
  { value: "working_professional", label: "Working professional" },
  { value: "entrepreneur", label: "Entrepreneur / aspiring founder" },
  { value: "career_changer", label: "Career changer" },
  { value: "exploring", label: "Exploring / not sure yet" },
];

const CERTAINTY_OPTIONS: Option[] = [
  { value: "yes", label: "Yes, I know", hint: "I have a clear target" },
  { value: "kind_of", label: "Kind of", hint: "A few ideas" },
  {
    value: "no_idea",
    label: "No idea yet",
    hint: "That’s a fine place to start",
  },
];

const INTEREST_LEVEL: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "kind_of", label: "Maybe" },
  { value: "no_idea", label: "Not sure yet" },
];

const CAREER_SUGGESTIONS = [
  "Product Management",
  "Software Engineering",
  "AI / Machine Learning",
  "Data Science & Analytics",
  "UX / Product Design",
  "Marketing",
  "Consulting",
  "Finance",
  "Entrepreneurship",
  "Research",
  "Healthcare",
  "Education",
  "Law",
  "Public Policy & Nonprofit",
  "Sales & Partnerships",
  "Operations",
  "Media & Content",
  "Engineering (non-software)",
];

const SKILL_SUGGESTIONS = [
  "Python",
  "SQL",
  "Excel / Sheets",
  "Writing",
  "Public speaking",
  "Research",
  "Design (Figma)",
  "JavaScript",
  "Data analysis",
  "Project management",
  "Leadership",
  "Customer service",
  "Social media",
  "Sales",
  "Teaching / tutoring",
];

const INTEREST_SUGGESTIONS = [
  "Technology",
  "AI",
  "Startups",
  "Climate & sustainability",
  "Health",
  "Design",
  "Finance & investing",
  "Education",
  "Social impact",
  "Media & storytelling",
  "Sports",
  "Gaming",
  "Music & arts",
  "Travel",
  "Science",
];

const INDUSTRY_OPTIONS: Option[] = [
  "Technology",
  "Artificial intelligence",
  "Finance",
  "Healthcare",
  "Education",
  "Consumer & retail",
  "Media & entertainment",
  "Climate & energy",
  "Government & policy",
  "Nonprofit & social impact",
  "Consulting",
  "Manufacturing",
  "Real estate",
  "Food & hospitality",
].map((label) => ({ value: label, label }));

const PRIORITY_OPTIONS: Option[] = [
  "Financial security",
  "Work-life balance",
  "Meaningful impact",
  "Fast growth",
  "Creativity",
  "Stability",
  "Flexibility / remote",
  "Autonomy",
  "Prestige",
  "Being near family",
].map((label) => ({ value: label, label }));

const STUDENT_GOALS: Option[] = [
  "Land an internship",
  "Figure out my direction",
  "Build real experience",
  "Understand my industry",
  "Meet people in my field",
  "Build projects / a portfolio",
  "Improve my grades",
  "Start something of my own",
  "Graduate with a clear path",
].map((label) => ({ value: label, label }));

const PRO_GOALS: Option[] = [
  "Get promoted",
  "Change roles",
  "Switch industries",
  "Earn more",
  "Learn new skills",
  "Grow my network",
  "Find more meaningful work",
  "Start something of my own",
  "Figure out my direction",
].map((label) => ({ value: label, label }));

const FOUNDER_GOALS: Option[] = [
  "Validate an idea",
  "Find a business idea",
  "Get first customers",
  "Launch a product",
  "Understand costs & pricing",
  "Build a brand",
  "Raise or find funding",
  "Keep my job while building",
].map((label) => ({ value: label, label }));

const STUDENTS: UserType[] = ["college_student", "high_school_student"];
const DEGREE_HOLDERS: UserType[] = ["college_student", "recent_graduate"];
const WORKERS: UserType[] = ["working_professional", "career_changer"];

const hasIdea = (a: Answers) =>
  choiceValue(a, "venture_has_idea") === "yes" ||
  choiceValue(a, "venture_has_idea") === "kind_of";

// ---------------------------------------------------------------------------
// The flow
// ---------------------------------------------------------------------------
export const STEPS: Step[] = [
  {
    key: "name",
    kind: "text",
    tier: "core",
    prompt:
      "Hi — I’m Mentr. I’ll help you figure out where you’re headed and what to do next. First, what should I call you?",
    placeholder: "Your first name",
    maxLength: 60,
  },
  {
    key: "user_type",
    kind: "choice",
    tier: "core",
    prompt: "Nice to meet you, {name}. What best describes you right now?",
    helper:
      "This shapes the questions I ask and the plan we build. You can change it later.",
    options: USER_TYPE_OPTIONS,
  },

  // --- Education -----------------------------------------------------------
  {
    key: "school",
    kind: "school",
    tier: "core",
    audience: DEGREE_HOLDERS,
    prompt: "Where do you go to school?",
    helper:
      "I’ll use this to point you to real campus resources like your career center.",
  },
  {
    key: "hs_school",
    kind: "text",
    tier: "core",
    audience: ["high_school_student"],
    optional: true,
    prompt: "What high school do you go to?",
    placeholder: "School name",
  },
  {
    key: "study",
    kind: "study",
    tier: "core",
    audience: DEGREE_HOLDERS,
    prompt: "What are you studying?",
    helper: "Undeclared is completely fine.",
  },
  {
    key: "year",
    kind: "schoolYear",
    tier: "core",
    audience: ["college_student"],
    prompt: "What year are you in, and when do you expect to graduate?",
    years: [
      "Freshman",
      "Sophomore",
      "Junior",
      "Senior",
      "5th year+",
      "Graduate student",
    ].map((y) => ({
      value: y.toLowerCase(),
      label: y,
    })),
  },
  {
    key: "hs_year",
    kind: "schoolYear",
    tier: "core",
    audience: ["high_school_student"],
    prompt: "What grade are you in?",
    years: ["9th", "10th", "11th", "12th"].map((y) => ({
      value: `grade ${y}`,
      label: y,
    })),
  },
  {
    key: "grad_date",
    kind: "schoolYear",
    tier: "core",
    audience: ["recent_graduate"],
    prompt: "When did you graduate?",
    years: [],
  },
  {
    key: "hs_after",
    kind: "choice",
    tier: "core",
    audience: ["high_school_student"],
    allowNotSure: true,
    prompt: "What are you thinking about after high school?",
    options: [
      { value: "four_year", label: "4-year college" },
      { value: "community_college", label: "Community college" },
      { value: "trade", label: "Trade or apprenticeship" },
      { value: "work", label: "Start working" },
      { value: "gap_year", label: "Gap year" },
    ],
  },
  {
    key: "grad_status",
    kind: "choice",
    tier: "core",
    audience: ["recent_graduate"],
    allowNotSure: true,
    prompt: "What are you doing right now?",
    options: [
      { value: "job_searching", label: "Looking for a job" },
      { value: "working", label: "Working" },
      { value: "grad_school", label: "In or applying to grad school" },
      { value: "taking_time", label: "Taking some time" },
    ],
  },

  // --- Work ----------------------------------------------------------------
  {
    key: "current_role",
    kind: "text",
    tier: "core",
    audience: [...WORKERS, "recent_graduate"],
    optional: true,
    when: (a) =>
      choiceValue(a, "user_type") !== "recent_graduate" ||
      choiceValue(a, "grad_status") === "working",
    prompt: "What do you do today?",
    placeholder: "e.g. Marketing coordinator at a SaaS company",
  },
  {
    key: "industry",
    kind: "text",
    tier: "core",
    audience: WORKERS,
    optional: true,
    prompt: "What industry are you in?",
    placeholder: "e.g. Healthcare, retail, software",
  },
  {
    key: "years_experience",
    kind: "number",
    tier: "core",
    audience: WORKERS,
    optional: true,
    prompt: "Roughly how many years of work experience do you have?",
    min: 0,
    max: 60,
    stepSize: 1,
    placeholder: "Years",
  },
  {
    key: "desired_role",
    kind: "text",
    tier: "core",
    audience: ["working_professional"],
    optional: true,
    prompt: "What would you like your next role to be?",
    helper: "Skip it if you’re not sure — we can explore options together.",
    placeholder: "e.g. Senior product designer",
  },
  {
    key: "desired_career",
    kind: "text",
    tier: "core",
    audience: ["career_changer"],
    optional: true,
    prompt: "Which career are you hoping to move into?",
    helper: "“I don’t know yet” is a real answer. Skip and we’ll explore.",
    placeholder: "e.g. UX research, nursing, data analytics",
  },
  {
    key: "stuck",
    kind: "longtext",
    tier: "core",
    audience: ["working_professional", "career_changer"],
    optional: true,
    prompt: "What feels stuck right now?",
    placeholder: "A sentence or two is plenty.",
  },
  {
    key: "constraints",
    kind: "multi",
    tier: "deepen",
    audience: ["career_changer"],
    optional: true,
    allowCustom: true,
    prompt: "Any constraints I should plan around?",
    options: [
      "Need to keep my income",
      "Limited time each week",
      "Can’t relocate",
      "Can’t afford a new degree",
      "Caregiving responsibilities",
    ].map((label) => ({ value: label, label })),
  },
  {
    key: "timeline",
    kind: "choice",
    tier: "deepen",
    audience: ["career_changer", "working_professional"],
    allowNotSure: true,
    prompt: "What timeline are you thinking?",
    options: [
      { value: "3 months", label: "Next 3 months" },
      { value: "6 months", label: "Within 6 months" },
      { value: "1 year", label: "Within a year" },
      { value: "2+ years", label: "2+ years" },
    ],
  },

  // --- Venture -------------------------------------------------------------
  {
    key: "venture_has_idea",
    kind: "choice",
    tier: "core",
    audience: ["entrepreneur"],
    prompt: "Do you already have a business idea?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "kind_of", label: "A rough one" },
      { value: "no_idea", label: "Not yet", hint: "I’ll help you find one" },
    ],
  },
  {
    key: "venture_idea",
    kind: "longtext",
    tier: "core",
    audience: ["entrepreneur"],
    when: hasIdea,
    prompt: "Tell me about it in a sentence or two.",
    placeholder:
      "e.g. Small-batch hot sauce sold at farmers markets in San Diego",
  },
  {
    key: "venture_industry",
    kind: "text",
    tier: "core",
    audience: ["entrepreneur"],
    optional: true,
    when: hasIdea,
    prompt: "What industry is it in?",
    placeholder: "e.g. Food & beverage",
  },
  {
    key: "venture_offering",
    kind: "choice",
    tier: "core",
    audience: ["entrepreneur"],
    allowNotSure: true,
    when: hasIdea,
    prompt: "Is it a product or a service — and will it be online or physical?",
    options: [
      { value: "product_online", label: "Product, online" },
      { value: "product_physical", label: "Product, in person" },
      { value: "service_online", label: "Service, online" },
      { value: "service_physical", label: "Service, in person" },
      { value: "both_both", label: "A mix" },
    ],
  },
  {
    key: "venture_stage",
    kind: "choice",
    tier: "core",
    audience: ["entrepreneur"],
    when: hasIdea,
    prompt: "What stage is it at?",
    options: [
      { value: "idea", label: "Just an idea" },
      { value: "research", label: "Researching" },
      { value: "prototype", label: "Prototype / testing" },
      { value: "launched", label: "Launched" },
    ],
  },
  {
    key: "venture_customer",
    kind: "text",
    tier: "deepen",
    audience: ["entrepreneur"],
    optional: true,
    when: hasIdea,
    prompt: "Who do you imagine buying it?",
    placeholder: "e.g. Busy parents who cook at home",
  },
  {
    key: "venture_capital",
    kind: "choice",
    tier: "deepen",
    audience: ["entrepreneur"],
    optional: true,
    allowNotSure: true,
    prompt:
      "Roughly how much could you put in to get started? Totally optional.",
    options: [
      { value: "under_500", label: "Under $500" },
      { value: "500_5k", label: "$500–$5k" },
      { value: "5k_25k", label: "$5k–$25k" },
      { value: "25k_plus", label: "$25k+" },
    ],
  },
  {
    key: "venture_problems",
    kind: "longtext",
    tier: "core",
    audience: ["entrepreneur"],
    optional: true,
    when: (a) => !hasIdea(a),
    prompt:
      "What problems or frustrations do you notice in your life, work, or community?",
    helper: "Good businesses often start here. Anything counts.",
    placeholder: "e.g. It’s hard to find affordable after-school care near me",
  },

  // --- Direction (everyone) --------------------------------------------------
  {
    key: "skills",
    kind: "tags",
    tier: "core",
    optional: true,
    prompt: "What are you already good at? Add a few skills.",
    helper: "Classes, jobs, hobbies — it all counts.",
    suggestions: SKILL_SUGGESTIONS,
    max: 15,
  },
  {
    key: "interests",
    kind: "tags",
    tier: "deepen",
    optional: true,
    prompt: "What topics do you genuinely enjoy?",
    suggestions: INTEREST_SUGGESTIONS,
    max: 12,
  },
  {
    key: "career_certainty",
    kind: "choice",
    tier: "core",
    audience: [
      "college_student",
      "high_school_student",
      "recent_graduate",
      "working_professional",
      "career_changer",
      "exploring",
    ],
    prompt: "Do you already know exactly what you want to do?",
    options: CERTAINTY_OPTIONS,
  },
  {
    key: "career_interests",
    kind: "tags",
    tier: "core",
    optional: true,
    audience: [
      "college_student",
      "high_school_student",
      "recent_graduate",
      "working_professional",
      "career_changer",
      "exploring",
    ],
    prompt: "Which careers are you curious about? Add as many as you like.",
    helper:
      "Anything that sounds even a little interesting. We’ll explore them together.",
    suggestions: CAREER_SUGGESTIONS,
    max: 8,
  },
  {
    key: "vision",
    kind: "longtext",
    tier: "deepen",
    optional: true,
    prompt: "What would make you feel really successful five years from now?",
    placeholder: "No wrong answers. Work, life, anything.",
  },
  {
    key: "industries",
    kind: "multi",
    tier: "deepen",
    optional: true,
    allowCustom: true,
    allowNotSure: true,
    prompt: "Which industries interest you?",
    options: INDUSTRY_OPTIONS,
    max: 8,
  },
  {
    key: "location",
    kind: "location",
    tier: "deepen",
    optional: true,
    prompt: "Where are you now — and where would you like to be?",
    helper:
      "Helps me suggest opportunities, events, and cities that fit. No need to decide anything.",
  },
  {
    key: "priorities",
    kind: "multi",
    tier: "deepen",
    optional: true,
    prompt:
      "What matters most to you in the life you’re building? Pick up to 4.",
    options: PRIORITY_OPTIONS,
    max: 4,
  },
  {
    key: "gpa",
    kind: "number",
    tier: "deepen",
    audience: ["college_student"],
    optional: true,
    prompt: "What’s your GPA? Completely optional.",
    helper: "Only used to flag programs with GPA requirements. Skip anytime.",
    min: 0,
    max: 5,
    stepSize: 0.01,
    placeholder: "e.g. 3.4",
  },
  {
    key: "grad_school",
    kind: "choice",
    tier: "deepen",
    audience: DEGREE_HOLDERS,
    optional: true,
    prompt: "Are you considering grad school at some point?",
    options: INTEREST_LEVEL,
  },
  {
    key: "entrepreneurship",
    kind: "choice",
    tier: "deepen",
    audience: [...STUDENTS, "recent_graduate", ...WORKERS, "exploring"],
    optional: true,
    prompt: "Could you see yourself starting something of your own someday?",
    options: INTEREST_LEVEL,
  },
  {
    key: "companies",
    kind: "tags",
    tier: "deepen",
    optional: true,
    audience: [
      "college_student",
      "recent_graduate",
      "working_professional",
      "career_changer",
      "exploring",
    ],
    prompt: "Any companies or organizations you admire?",
    suggestions: [],
    placeholder: "Type a name and press Enter",
    max: 10,
  },
  {
    key: "learn",
    kind: "tags",
    tier: "deepen",
    optional: true,
    prompt: "Any skills you want to learn?",
    suggestions: [
      "SQL",
      "Python",
      "Public speaking",
      "Product management",
      "Design",
      "Negotiation",
      "Writing",
      "Financial modeling",
      "Sales",
    ],
    max: 10,
  },
  {
    key: "salary_goal",
    kind: "text",
    tier: "deepen",
    optional: true,
    audience: [
      "college_student",
      "recent_graduate",
      "working_professional",
      "career_changer",
    ],
    prompt: "Do you have a salary goal in mind? Optional.",
    placeholder: "e.g. $80k+ within 3 years",
    maxLength: 80,
  },

  // --- Goals (last core question) --------------------------------------------
  {
    key: "goals",
    kind: "multi",
    tier: "core",
    optional: true,
    allowCustom: true,
    prompt: "Last one for now: what do you most want from the next year?",
    helper: "Pick a few, or add your own.",
    options: STUDENT_GOALS,
    max: 5,
  },
];

/** Goal options depend on who the user is. */
export function goalOptionsFor(userType: UserType | null): Option[] {
  if (userType === "entrepreneur") return FOUNDER_GOALS;
  if (userType === "working_professional" || userType === "career_changer")
    return PRO_GOALS;
  return STUDENT_GOALS;
}

/** Resolve a step for display (adapts options that depend on earlier answers). */
export function resolveStep(step: Step, answers: Answers): Step {
  const graduated = choiceValue(answers, "user_type") === "recent_graduate";
  if (graduated && step.key === "school")
    return { ...step, prompt: "Where did you go to school?" };
  if (graduated && step.key === "study")
    return { ...step, prompt: "What did you study?" };
  if (step.key === "goals" && step.kind === "multi") {
    return {
      ...step,
      options: goalOptionsFor(
        choiceValue(answers, "user_type") as UserType | null,
      ),
    };
  }
  return step;
}

/** Steps that apply given the answers so far, in order. */
export function applicableSteps(
  answers: Answers,
  tier: "core" | "all" = "all",
): Step[] {
  const userType = choiceValue(answers, "user_type") as UserType | null;
  return STEPS.filter((s) => {
    if (tier === "core" && s.tier !== "core") return false;
    if (s.audience && (!userType || !s.audience.includes(userType)))
      return false;
    if (s.when && !s.when(answers)) return false;
    return true;
  })
    .map((s, i) => ({
      s,
      rank: (s.tier === "deepen" ? 2 : s.key === "goals" ? 1 : 0) * 1000 + i,
    }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ s }) => resolveStep(s, answers));
}

export function findStep(key: string): Step | undefined {
  return STEPS.find((s) => s.key === key);
}

export function renderPrompt(text: string, answers: Answers): string {
  const name = choiceValue(answers, "name");
  return name
    ? text.replace("{name}", name.split(" ")[0])
    : text.replace(", {name}", "").replace("{name}", "there");
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatMonth(ym: string | null): string | null {
  if (!ym) return null;
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/** Short human summary of an answer, used in the conversation transcript. */
export function summarizeAnswer(
  step: Step,
  answer: Answer | undefined,
): string {
  if (!answer) return "";
  if (isSkipped(answer)) return "Skipped for now";
  const label = (v: string) =>
    v === NOT_SURE
      ? "Not sure yet"
      : (("options" in step
          ? step.options.find((o) => o.value === v)?.label
          : undefined) ?? v);

  switch (step.kind) {
    case "text":
    case "longtext":
      return (answer as AnswerFor<"text">).value;
    case "choice":
      return label((answer as AnswerFor<"choice">).value);
    case "multi":
    case "tags": {
      const vals = (answer as AnswerFor<"tags">).values;
      return vals.length ? vals.map(label).join(", ") : "None for now";
    }
    case "number":
      return String((answer as AnswerFor<"number">).value);
    case "school":
      return (answer as AnswerFor<"school">).name;
    case "study": {
      const a = answer as AnswerFor<"study">;
      const parts = [
        a.major ?? "Undeclared",
        a.secondMajor,
        a.minors.length ? `minor: ${a.minors.join(", ")}` : null,
      ];
      return parts.filter(Boolean).join(" · ");
    }
    case "schoolYear": {
      const a = answer as AnswerFor<"schoolYear">;
      const year = a.year ? label(a.year) : null;
      const grad = formatMonth(a.graduation);
      const yearLabel =
        step.years.find((y) => y.value === a.year)?.label ?? year;
      return [
        yearLabel,
        grad ? (step.key === "grad_date" ? grad : `graduating ${grad}`) : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "location": {
      const a = answer as AnswerFor<"location">;
      const rel: Record<string, string> = {
        stay: "staying put",
        specific: "moving somewhere specific",
        open: "open to moving",
        remote: "prefers remote",
        not_sure: "not sure yet",
      };
      return [
        a.current,
        a.relocation ? rel[a.relocation] : null,
        a.places.length ? a.places.join(", ") : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
  }
}
