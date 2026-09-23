import { isStudent, type MentorContext } from "@/lib/ai/context";
import type {
  ActionDraft,
  Category,
  Difficulty,
  InitialPlanDraft,
  MilestoneDraft,
  PriorityDraft,
} from "./schemas";

/**
 * Deterministic, rules-based planning. Used when no AI provider is configured
 * and whenever the model is unavailable. Personalizes with the user's own
 * data and never invents organizations, opportunities, or facts.
 */

type Segment =
  | "student"
  | "high_school"
  | "graduate"
  | "professional"
  | "changer"
  | "founder"
  | "explorer";

export function segmentOf(ctx: MentorContext): Segment {
  switch (ctx.profile.userType) {
    case "college_student":
      return "student";
    case "high_school_student":
      return "high_school";
    case "recent_graduate":
      return "graduate";
    case "working_professional":
      return "professional";
    case "career_changer":
      return "changer";
    case "entrepreneur":
      return "founder";
    default:
      return "explorer";
  }
}

/** The career the user is aiming at, if they've named one. */
export function targetOf(ctx: MentorContext): string | null {
  return (
    ctx.careerInterests.find((c) => c.certainty !== "no_idea")?.label ??
    ctx.careerInterests[0]?.label ??
    ctx.professional?.desiredNextRole ??
    ctx.professional?.desiredCareer ??
    null
  );
}

export function isExploring(ctx: MentorContext): boolean {
  if (segmentOf(ctx) === "founder")
    return ctx.venture?.hasIdea === "no_idea" || !ctx.venture?.ideaSummary;
  return ctx.profile.careerCertainty === "no_idea" || targetOf(ctx) === null;
}

const termWord = (ctx: MentorContext) =>
  isStudent(ctx) ? "semester" : "quarter";
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function m(
  key: string,
  horizon: MilestoneDraft["horizon"],
  title: string,
  description: string,
  why: string,
  category: Category | null,
  parent_key: string | null = null,
): MilestoneDraft {
  return { key, horizon, title, description, why, category, parent_key };
}

// ---------------------------------------------------------------------------
// Roadmaps
// ---------------------------------------------------------------------------
function explorerMilestones(ctx: MentorContext): MilestoneDraft[] {
  const interests = ctx.careerInterests.map((c) => c.label);
  const curious = interests.length
    ? ` — starting with ${interests.slice(0, 3).join(", ")}`
    : "";
  return [
    m(
      "choose-direction",
      "long_term",
      "Choose a direction you’re genuinely excited about",
      "Not a forever decision — a clear enough bet to build toward for the next few years.",
      "You told me you’re not sure yet what you want. Exploring deliberately beats guessing, and it’s faster than it sounds.",
      "career_exploration",
    ),
    m(
      "test-paths",
      "year",
      "Test 2–3 possible paths with small real-world experiments",
      "Projects, conversations, volunteering, or short courses that let you try the work, not just read about it.",
      "Doing a small version of a job tells you more than any quiz. Each experiment narrows the field.",
      "career_exploration",
      "choose-direction",
    ),
    m(
      "shortlist",
      "term",
      `Research roles and shortlist three to explore${curious}`,
      "For each: what the work looks like day to day, what skills it uses, and how people got in.",
      "A shortlist turns a fuzzy question into three concrete ones you can investigate.",
      "career_exploration",
      "test-paths",
    ),
    m(
      "conversations",
      "term",
      "Have three conversations with people doing work you’re curious about",
      "Short, curious chats — 20 minutes each — about what they actually do.",
      "People are the fastest way to learn what a job is really like, and they often open doors later.",
      "networking",
      "test-paths",
    ),
    m(
      "energy-audit",
      "month",
      "Notice what energizes you",
      "Pay attention to moments you enjoy or lose track of time — and what they have in common.",
      "Your own patterns are the best clue to work that will suit you.",
      "career_exploration",
      "shortlist",
    ),
    m(
      "first-experiment",
      "month",
      "Run one small experiment in your top-interest area",
      "A mini project, a short course module, or shadowing someone for an afternoon.",
      "Trying beats thinking. One small experiment will tell you whether to go deeper.",
      "experience",
      "test-paths",
    ),
  ];
}

function studentMilestones(
  ctx: MentorContext,
  target: string,
): MilestoneDraft[] {
  const school = ctx.education?.school;
  const major = ctx.education?.majors[0];
  const hs = segmentOf(ctx) === "high_school";
  const learnSkill =
    ctx.preferences?.skillsToLearn[0] ??
    ctx.skills.find((s) => s.status === "target")?.name;
  const term = termWord(ctx);
  if (hs) {
    return [
      m(
        "direction",
        "long_term",
        `Head into what’s next with a clear interest in ${target}`,
        "Graduate knowing what you want to explore next and why.",
        `You’re curious about ${target}. Early exposure makes choosing a path — and standing out — much easier.`,
        "career_exploration",
      ),
      m(
        "explore-field",
        "year",
        `Get real exposure to ${target}`,
        "A club, summer program, volunteer role, or project connected to the field.",
        "Real experience tells you whether you like the work and gives you something to talk about in applications.",
        "experience",
        "direction",
      ),
      m(
        "next-step-plan",
        "year",
        "Make a plan for after high school",
        "Compare the options you’re considering and what each requires.",
        "Knowing requirements early means no surprises in senior year.",
        "career_exploration",
        "direction",
      ),
      m(
        "club",
        "term",
        `Join or start one activity related to ${target}`,
        "Look through your school’s clubs and pick one to try this " +
          term +
          ".",
        "Consistent involvement in one thing beats a long list of activities.",
        "experience",
        "explore-field",
      ),
      m(
        "talk-to-someone",
        "term",
        `Talk to one person who works in ${target}`,
        "A family friend, teacher’s contact, or local professional.",
        "Hearing how someone got there makes the path concrete.",
        "networking",
        "explore-field",
      ),
      m(
        "skill-month",
        "month",
        learnSkill
          ? `Start learning ${learnSkill}`
          : "Try one free intro course related to your interest",
        "Small, steady sessions — 20 minutes a few times a week.",
        "Skills compound. Starting now gives you a head start.",
        "learning",
        "explore-field",
      ),
    ];
  }
  return [
    m(
      "career-goal",
      "long_term",
      `Land your first role in ${target}`,
      "Graduate with evidence, experience, and relationships that make you a strong candidate.",
      `You’re aiming at ${target}. Working backward from that role tells us what to build each ${term}.`,
      "applications",
    ),
    m(
      "specialize",
      "long_term",
      `Develop a specialization within ${target}`,
      "Go deep in one area so you stand out, not just qualify.",
      "Specialists get noticed faster than generalists early in a career.",
      "skills",
      "career-goal",
    ),
    m(
      "internship",
      "year",
      `Secure an internship related to ${target}`,
      "Target roles where you’ll do real work you can talk about afterward.",
      "Internships are the strongest signal to employers and the best way to test the fit.",
      "applications",
      "career-goal",
    ),
    m(
      "portfolio",
      "year",
      `Build two projects that show ${target} skills`,
      "Small but real — something you can link to and explain.",
      "Projects are proof. They make your resume and interviews concrete.",
      "experience",
      "career-goal",
    ),
    m(
      "campus-org",
      "term",
      `Join one campus organization connected to ${target}`,
      school
        ? `Find the student organization directory for ${school} and pick one group to commit to this ${term}.`
        : `Pick one group to commit to this ${term}.`,
      "Clubs give you leadership experience, projects, and people already on the path.",
      "experience",
      "internship",
    ),
    m(
      "network-3",
      "term",
      `Meet three people working in ${target}`,
      "Alumni, guest speakers, or professionals you reach out to directly.",
      "Most internships come through people. Three real conversations change what you know and who knows you.",
      "networking",
      "internship",
    ),
    m(
      "first-project",
      "term",
      `Complete your first ${target} project`,
      major
        ? `Something that connects your ${major} coursework to real-world work.`
        : "Something you can finish in a few weeks and show others.",
      "Finishing one project matters more than planning five.",
      "experience",
      "portfolio",
    ),
    m(
      "resume",
      "month",
      "Get your resume internship-ready",
      "Projects, coursework, and experience written with outcomes.",
      "Your resume gates everything else in application season.",
      "applications",
      "internship",
    ),
    m(
      "target-list",
      "month",
      "Build a target list of internships and companies",
      "Save roles as you find them and note deadlines and requirements.",
      "Many internship deadlines come earlier than people expect. A list keeps you ahead.",
      "applications",
      "internship",
    ),
    ...(learnSkill
      ? [
          m(
            "learn-skill",
            "month",
            `Build a working foundation in ${learnSkill}`,
            "A few focused sessions a week, applied to something real.",
            `You said you want to learn ${learnSkill}, and it strengthens your case for ${target}.`,
            "learning",
            "portfolio",
          ),
        ]
      : []),
  ];
}

function professionalMilestones(
  ctx: MentorContext,
  target: string,
): MilestoneDraft[] {
  const changer = segmentOf(ctx) === "changer";
  const current = ctx.professional?.currentTitle;
  return [
    m(
      "goal",
      "long_term",
      changer ? `Make the move into ${target}` : `Step into ${target}`,
      current
        ? `From ${current} to ${target}, with a clear story for why.`
        : "With a clear story for why you’re a fit.",
      changer
        ? "Career changes work best with a plan that uses what you already know."
        : "A defined next role lets you focus effort where it counts.",
      "applications",
    ),
    m(
      "gap-close",
      "year",
      `Close the biggest skill gaps for ${target}`,
      "Identify the two or three skills that show up in every posting and build evidence for them.",
      "Hiring managers look for proof you can already do the core of the job.",
      "skills",
      "goal",
    ),
    m(
      "proof",
      "year",
      "Build visible proof of your new direction",
      changer
        ? "A project, portfolio piece, or side work in the new field."
        : "Stretch work, a project, or measurable wins in the direction you want.",
      "Proof shortens the “why should we take a chance on you?” conversation.",
      "experience",
      "goal",
    ),
    m(
      "story",
      "term",
      "Get clear on your “why this switch” story",
      "Two or three sentences that connect your past experience to where you’re headed.",
      "A crisp story makes networking and interviews dramatically easier.",
      "career_exploration",
      "goal",
    ),
    m(
      "network",
      "term",
      `Have five conversations with people in ${target}`,
      "Learn what the role really requires and who’s hiring.",
      "Most role changes happen through people who can vouch for you.",
      "networking",
      "goal",
    ),
    m(
      "requirements",
      "month",
      `Map what ${target} roles actually require`,
      "Review real postings and list recurring requirements against what you have.",
      "It turns a vague goal into a specific checklist.",
      "career_exploration",
      "gap-close",
    ),
    m(
      "wins",
      "month",
      "Know your best wins, with numbers",
      "Five accomplishments from the past year with measurable results.",
      "Quantified wins are the raw material for your resume and interviews.",
      "experience",
      "story",
    ),
  ];
}

function founderMilestones(ctx: MentorContext): MilestoneDraft[] {
  const v = ctx.venture;
  const idea = v?.ideaSummary ?? "your idea";
  const physical = v?.channel === "physical" || v?.channel === "both";
  const stage = v?.stage ?? "idea";
  const launched = stage === "launched";
  return [
    m(
      "launch",
      "long_term",
      launched
        ? "Grow to consistent, profitable sales"
        : "Launch and get to your first paying customers",
      `Take ${lc(idea)} from ${stage} to a business people pay for.`,
      "Every step below is sequenced to reduce risk before you spend real money.",
      "business",
    ),
    m(
      "validate",
      "year",
      "Prove people want it",
      "Evidence from real customers — conversations, pre-orders, or sales.",
      "Validation before investment is the single biggest predictor of not wasting money.",
      "business",
      "launch",
    ),
    m(
      "economics",
      "year",
      "Know your unit economics",
      "Cost per unit, price, margin, and how many sales you need to break even.",
      "If the math doesn’t work at small scale, it rarely fixes itself at large scale.",
      "business",
      "launch",
    ),
    m(
      "customer",
      "term",
      "Define the problem and the customer precisely",
      v?.targetCustomer
        ? `Sharpen who exactly: “${v.targetCustomer}”.`
        : "Who has the problem, how often, and what it costs them.",
      "A precise customer makes every other decision — pricing, channel, brand — easier.",
      "business",
      "validate",
    ),
    m(
      "competitors",
      "term",
      "Map the alternatives",
      "What customers use today and what they dislike about it.",
      "Your positioning comes from the gaps in what already exists.",
      "business",
      "validate",
    ),
    m(
      "test",
      "month",
      "Run one small test with real customers",
      "A landing page, a pop-up, samples, or a pilot — something cheap and fast.",
      "A small real test beats months of planning.",
      "business",
      "validate",
    ),
    m(
      "costs",
      "month",
      "Estimate costs and pricing",
      "List every cost per unit and try a few price points.",
      "You need these numbers before talking to retailers, marketplaces, or investors.",
      "business",
      "economics",
    ),
    ...(physical
      ? [
          m(
            "rules",
            "month",
            "Check permits and rules that apply to you",
            "Find your city or county’s official small-business guidance and note what applies.",
            "Physical businesses — especially food — often need specific permits. Official sources only.",
            "business",
            "launch",
          ),
        ]
      : []),
  ];
}

function founderExplorerMilestones(): MilestoneDraft[] {
  return [
    m(
      "find-idea",
      "long_term",
      "Find a business idea worth betting on",
      "One grounded in a real problem, your strengths, and a market you can reach.",
      "The best ideas usually come from problems you see up close, not brainstorming in a vacuum.",
      "business",
    ),
    m(
      "problem-bank",
      "year",
      "Build a bank of real problems",
      "Collect problems you and others experience, with evidence of how painful they are.",
      "A large pool of real problems makes it easy to spot a good opportunity.",
      "business",
      "find-idea",
    ),
    m(
      "validate-one",
      "year",
      "Validate your most promising idea",
      "Talk to potential customers and run one cheap test.",
      "Validation tells you whether to commit before you spend money.",
      "business",
      "find-idea",
    ),
    m(
      "strengths",
      "term",
      "Match your skills to opportunities",
      "List what you’re good at and what problems those skills could solve.",
      "Businesses built on your strengths are easier to start and sustain.",
      "business",
      "problem-bank",
    ),
    m(
      "problem-journal",
      "month",
      "Collect problems worth solving",
      "Notice everyday frustrations — yours and other people’s.",
      "Ideas hide in everyday annoyances. Noticing them is the first step.",
      "business",
      "problem-bank",
    ),
    m(
      "talk-owners",
      "month",
      "Talk to two small-business owners",
      "Ask how they started and what they wish they’d known.",
      "Real founders shortcut years of guessing.",
      "networking",
      "validate-one",
    ),
  ];
}

export function rulesMilestones(ctx: MentorContext): MilestoneDraft[] {
  const seg = segmentOf(ctx);
  const target = targetOf(ctx);
  if (seg === "founder")
    return isExploring(ctx)
      ? founderExplorerMilestones()
      : founderMilestones(ctx);
  if (isExploring(ctx) || !target) return explorerMilestones(ctx);
  if (seg === "professional" || seg === "changer")
    return professionalMilestones(ctx, target);
  return studentMilestones(ctx, target);
}

/** Week-sized first steps for rules-based milestones, keyed by milestone key. */
const WEEKLY_STEPS: Record<string, string> = {
  "campus-org": "Find one campus organization to try",
  "network-3": "Message one person working in your target field",
  "first-project": "Choose which project idea you want to build",
  resume: "Improve one resume bullet",
  "target-list": "Save two internships worth applying to",
  "learn-skill": "Try two short learning sessions",
  shortlist: "Look into two roles you’re curious about",
  conversations: "Message one person doing work you’re curious about",
  "energy-audit": "Notice what you enjoy this week",
  "first-experiment": "Pick one small thing to try",
  story: "Get your “why this switch” answer down to one sentence",
  network: "Message one person in your target role",
  requirements: "Look at three real job postings",
  wins: "Remember one win from this quarter",
  customer: "Say who has the problem, in one sentence",
  competitors: "Find one alternative customers use today",
  test: "Pick one cheap way to test demand",
  costs: "Look up what your materials cost",
  rules: "Find your city’s official small-business page",
  strengths: "Pick one skill people ask you for help with",
  "problem-journal": "Notice three everyday frustrations",
  "talk-owners": "Ask one small-business owner how they started",
  club: "Pick one club to try",
  "talk-to-someone": "Think of one person in your field of interest to talk to",
  "skill-month": "Try two short learning sessions",
};

export function rulesWeeklyPriorities(
  ctx: MentorContext,
  milestones: MilestoneDraft[],
): PriorityDraft[] {
  const near = milestones.filter(
    (x) =>
      x.horizon === "month" || x.horizon === "term" || x.horizon === "week",
  );
  const picks = near.slice(0, 3);
  // Saved milestones are keyed by id; recover the rules key from the title.
  const stepKeyByTitle = new Map(
    rulesMilestones(ctx).map((r) => [r.title, r.key]),
  );
  const priorities: PriorityDraft[] = picks.map((x) => ({
    title:
      WEEKLY_STEPS[x.key] ??
      WEEKLY_STEPS[stepKeyByTitle.get(x.title) ?? ""] ??
      `Take the next small step on “${x.title}”`,
    why: x.why,
    category: x.category ?? "career_exploration",
    milestone_key: x.key,
  }));
  priorities.push({
    title: "Take your 1% step on a few days this week",
    why: "Small steps add up. Missing a day is fine.",
    category: "learning",
    milestone_key: null,
  });
  return priorities.slice(0, 5);
}

const FIRST_DAY = [
  "dream-company",
  "follow-person",
  "explore-path",
  "customers",
  "notice-problem",
  "ask-focus",
];

export function rulesInitialPlan(ctx: MentorContext): InitialPlanDraft {
  const milestones = rulesMilestones(ctx);
  const exploring = isExploring(ctx);
  const target = targetOf(ctx);
  const seg = segmentOf(ctx);
  const title =
    seg === "founder"
      ? exploring
        ? "Finding your business idea"
        : "From idea to launch"
      : exploring || !target
        ? "Finding your direction"
        : `Path to ${target}`;
  const north_star =
    milestones.find((x) => x.horizon === "long_term")?.title ??
    "Build a career you’re excited about";
  return {
    title,
    north_star,
    mode: exploring ? "exploring" : "directed",
    summary: exploring
      ? "You don’t need it all figured out. We’ll start by exploring — small experiments and real conversations — and let your direction come from what you learn."
      : `Working backward from: ${lc(north_star)}. Every small step ties to something bigger.`,
    milestones,
    weekly_priorities: rulesWeeklyPriorities(ctx, milestones),
    // Link today's action to the nearest-horizon milestone it advances.
    today: rulesDailyAction(ctx, {
      // Day one should feel inviting: the lightest, most concrete steps.
      preferIds: FIRST_DAY,
      milestones: [...milestones]
        .reverse()
        .map((x) => ({ ref: x.key, category: x.category })),
    }),
  };
}

// ---------------------------------------------------------------------------
// Daily 1% actions
// ---------------------------------------------------------------------------
type Level = { title: string; description: string; minutes: number };
type Template = {
  id: string;
  category: Category;
  applies: (seg: Segment, ctx: MentorContext) => boolean;
  build: (ctx: MentorContext) => {
    why: string;
    lighter: Level;
    standard: Level;
    stretch: Level;
  };
};

const any = () => true;
const college = (s: Segment) => s === "student" || s === "graduate";
const student = (s: Segment) => s === "student" || s === "high_school";
const careerSeekers = (s: Segment) => s !== "founder";
const worker = (s: Segment) => s === "professional" || s === "changer";
const founderWithIdea = (s: Segment, c: MentorContext) =>
  s === "founder" && !isExploring(c);
const founderNoIdea = (s: Segment, c: MentorContext) =>
  s === "founder" && isExploring(c);
const directed = (s: Segment, c: MentorContext) =>
  careerSeekers(s) && !isExploring(c);
const exploring = (s: Segment, c: MentorContext) =>
  careerSeekers(s) && isExploring(c);
const tgt = (c: MentorContext) =>
  targetOf(c) ?? "the field you’re curious about";

const ROLE_SUFFIXES: [RegExp, string][] = [
  [/management$/i, "Manager"],
  [/engineering$/i, "Engineer"],
  [/design$/i, "Designer"],
  [/data science$/i, "Data Scientist"],
  [/analytics$/i, "Analyst"],
  [/consulting$/i, "Consultant"],
  [/research$/i, "Researcher"],
  [/marketing$/i, "Marketer"],
  [/entrepreneurship$/i, "Founder"],
];

/**
 * A person in the user's target field: "AI Product Management" becomes
 * "AI Product Manager"; unknown fields become "person working in <field>".
 */
export function roleNoun(field: string | null): string {
  if (!field) return "person working in a field you’re curious about";
  const clean = field.replace(/\s*&.*$/, "").trim();
  for (const [re, noun] of ROLE_SUFFIXES) {
    if (re.test(clean)) return clean.replace(re, noun);
  }
  return `person working in ${field}`;
}

const industryOf = (c: MentorContext) =>
  c.preferences?.industries[0] ??
  targetOf(c) ??
  c.careerInterests[0]?.label ??
  "your field";
const skillOf = (c: MentorContext) =>
  c.preferences?.skillsToLearn[0] ??
  c.skills.find((k) => k.status === "target")?.name ??
  null;

/*
 * The daily action library. Every step should feel like "oh, that’s easy —
 * I can do that": mostly 2–10 minutes, a bigger version around 15–20.
 * Never writing assignments, reports, or reflections.
 */
const TEMPLATES: Template[] = [
  {
    id: "dream-company",
    category: "career_exploration",
    applies: (s, c) => directed(s, c),
    build: (c) => {
      const verb =
        student(segmentOf(c)) || segmentOf(c) === "graduate"
          ? "intern at"
          : "work at";
      // "AI Product Management" -> "AI company"; otherwise just "company".
      const acronym = targetOf(c)?.match(/^([A-Z]{2,})\b/)?.[1];
      const field = acronym ? `${acronym} ` : "";
      return {
        why: "Knowing which companies actually interest you makes it easier to target internships, people to follow, and skills to build.",
        lighter: {
          title: "Think of one product you love and who makes it",
          description: "That company might be worth a closer look.",
          minutes: 2,
        },
        standard: {
          title: `Find one ${field}company you’d be excited to ${verb}`,
          description: "Just one. Save its careers page for later.",
          minutes: 5,
        },
        stretch: {
          title: `Find three companies you’d be excited to ${verb}`,
          description: "Save each careers page so they’re easy to find.",
          minutes: 15,
        },
      };
    },
  },
  {
    id: "follow-person",
    category: "networking",
    applies: (s, c) => directed(s, c),
    build: (c) => {
      const role = roleNoun(targetOf(c));
      return {
        why: "Seeing what people in your target role talk about helps you understand the job before you apply.",
        lighter: {
          title: `Look at one ${role}’s profile`,
          description: "Notice where they started.",
          minutes: 2,
        },
        standard: {
          title: `Follow one ${role} on LinkedIn`,
          description: "Pick someone who posts about their actual work.",
          minutes: 3,
        },
        stretch: {
          title: `Follow three people in ${tgt(c)} and save one post`,
          description: "Keep the one that taught you something.",
          minutes: 10,
        },
      };
    },
  },
  {
    id: "save-internship",
    category: "applications",
    applies: (s, c) => college(s) && directed(s, c),
    build: (c) => ({
      why: "Real postings show you what employers want — and when deadlines hit.",
      lighter: {
        title: `Search “${tgt(c)} intern” and skim what’s out there`,
        description: "No saving needed yet.",
        minutes: 3,
      },
      standard: {
        title: "Save one internship you’d actually apply to",
        description: "Check your school’s career portal or a job board.",
        minutes: 5,
      },
      stretch: {
        title: "Apply to one internship you’ve saved",
        description: "Done is better than perfect.",
        minutes: 20,
      },
    }),
  },
  {
    id: "save-role",
    category: "applications",
    applies: (s, c) => worker(s) && directed(s, c),
    build: (c) => ({
      why: "Real postings are the clearest picture of what the next role asks for.",
      lighter: {
        title: `Search for “${tgt(c)}” jobs and skim one`,
        description: "Just see what’s out there.",
        minutes: 3,
      },
      standard: {
        title: `Save one ${tgt(c)} role you’d genuinely want`,
        description: "Even if you’re not ready to apply.",
        minutes: 5,
      },
      stretch: {
        title: "Apply to one role you’ve saved",
        description: "Done is better than perfect.",
        minutes: 20,
      },
    }),
  },
  {
    id: "linkedin-headline",
    category: "skills",
    applies: (s, c) => directed(s, c),
    build: (c) => ({
      why: "It’s the first thing recruiters and people in your field see.",
      lighter: {
        title: `See how two people in ${tgt(c)} word their headlines`,
        description: "Borrow what works.",
        minutes: 3,
      },
      standard: {
        title: "Update your LinkedIn headline to say where you’re headed",
        description: "One line is enough.",
        minutes: 5,
      },
      stretch: {
        title: "Refresh your LinkedIn headline and About section",
        description: "Ask Mentr if you want a second opinion.",
        minutes: 15,
      },
    }),
  },
  {
    id: "resume-bullet",
    category: "experience",
    applies: (s) => careerSeekers(s) && s !== "high_school",
    build: () => ({
      why: "One strong bullet does more than a page of vague ones.",
      lighter: {
        title: "Pick the resume bullet you like least",
        description: "That’s the one to fix next.",
        minutes: 2,
      },
      standard: {
        title: "Ask Mentr to sharpen one resume bullet",
        description: "Paste it into chat and ask for a stronger version.",
        minutes: 5,
      },
      stretch: {
        title: "Improve three resume bullets with Mentr",
        description: "Start with your most recent experience.",
        minutes: 15,
      },
    }),
  },
  {
    id: "learn-concept",
    category: "learning",
    applies: any,
    build: (c) => {
      const skill = skillOf(c);
      return {
        why: skill
          ? `You said you want to learn ${skill}. A few minutes at a time adds up fast.`
          : "Knowing the vocabulary makes everything else in the field easier to follow.",
        lighter: {
          title: skill
            ? `Look up one ${skill} term you’ve heard but don’t get`
            : "Look up one term you’ve heard but don’t fully get",
          description: "A quick search is plenty.",
          minutes: 3,
        },
        standard: {
          title: skill
            ? `Spend 5 minutes on the basics of ${skill}`
            : `Learn one concept that keeps coming up in ${industryOf(c)}`,
          description: "A short video or article is perfect.",
          minutes: 5,
        },
        stretch: {
          title: skill
            ? `Watch one short tutorial on ${skill}`
            : `Watch one short explainer about ${industryOf(c)}`,
          description: "Something under 20 minutes.",
          minutes: 20,
        },
      };
    },
  },
  {
    id: "alumni",
    category: "networking",
    applies: (s, c) => college(s) && directed(s, c),
    build: (c) => {
      const school = c.education?.school ? `${c.education.school} ` : "";
      return {
        why: "Alumni are the warmest cold contacts there are — you already have something in common.",
        lighter: {
          title: "Open your school’s alumni page on LinkedIn",
          description: "Search your school, then tap Alumni.",
          minutes: 2,
        },
        standard: {
          title: `Look up one ${school}alum working in ${tgt(c)}`,
          description: "Just find them. No message needed yet.",
          minutes: 5,
        },
        stretch: {
          title: "Send one alum a short, friendly note",
          description: "Who you are, and one question about their path.",
          minutes: 10,
        },
      };
    },
  },
  {
    id: "career-event",
    category: "applications",
    applies: (s) => s === "student",
    build: () => ({
      why: "Career events are where employers and students actually meet — and most people skip them.",
      lighter: {
        title: "Find where your school lists career events",
        description: "Bookmark it.",
        minutes: 2,
      },
      standard: {
        title: "Look at one upcoming career event at your school",
        description: "Employer panels and info sessions count.",
        minutes: 5,
      },
      stretch: {
        title: "RSVP to one career event",
        description: "Put it on your calendar.",
        minutes: 8,
      },
    }),
  },
  {
    id: "campus-org",
    category: "experience",
    applies: (s) => student(s),
    build: (c) => ({
      why: `Clubs give you real projects and people already on the path${targetOf(c) ? ` to ${targetOf(c)}` : ""}.`,
      lighter: {
        title: "Find your school’s club directory",
        description: "Bookmark it for later.",
        minutes: 2,
      },
      standard: {
        title: "Find one campus organization related to your goals",
        description: "Check when it meets next.",
        minutes: 5,
      },
      stretch: {
        title: "Message one club to ask how to get involved",
        description: "A two-line message is plenty.",
        minutes: 8,
      },
    }),
  },
  {
    id: "interview-question",
    category: "skills",
    applies: (s, c) => directed(s, c) && s !== "high_school",
    build: (c) => ({
      why: "Saying an answer out loud once makes it far easier the next time it counts.",
      lighter: {
        title: `Read one common ${tgt(c)} interview question`,
        description: "Just think about how you’d answer.",
        minutes: 2,
      },
      standard: {
        title: `Practice answering “Why ${tgt(c)}?” out loud`,
        description: "Once is enough. Aim for 30 seconds.",
        minutes: 5,
      },
      stretch: {
        title: "Practice three interview questions with Mentr",
        description: "Ask Mentr to play the interviewer.",
        minutes: 15,
      },
    }),
  },
  {
    id: "message-someone",
    category: "networking",
    applies: (s) => careerSeekers(s),
    build: (c) => ({
      why: "Most opportunities come through people. Starting with someone you know is the easiest way in.",
      lighter: {
        title: `Think of one person who might know someone in ${tgt(c)}`,
        description: "Friends, family, old coworkers all count.",
        minutes: 2,
      },
      standard: {
        title:
          "Message one person you already know about what you’re working toward",
        description: "Keep it casual.",
        minutes: 5,
      },
      stretch: {
        title: "Ask one person for a 15-minute chat",
        description: "Be specific about what you’d like to learn.",
        minutes: 10,
      },
    }),
  },
  {
    id: "save-article",
    category: "learning",
    applies: (s) => careerSeekers(s),
    build: (c) => ({
      why: `Knowing what’s happening in ${industryOf(c)} makes you sharper in every conversation.`,
      lighter: {
        title: `Skim today’s headlines in ${industryOf(c)}`,
        description: "Two minutes is plenty.",
        minutes: 2,
      },
      standard: {
        title: `Save one article about what’s happening in ${industryOf(c)}`,
        description: "Something you’d mention in a conversation.",
        minutes: 5,
      },
      stretch: {
        title: "Read one article and tell Mentr what surprised you",
        description: "Mentr can explain why it matters for you.",
        minutes: 15,
      },
    }),
  },
  {
    id: "choose-skill",
    category: "skills",
    applies: (s) => careerSeekers(s),
    build: () => ({
      why: "Focusing on one skill beats spreading yourself thin.",
      lighter: {
        title: "Name one skill you wish you had",
        description: "Just decide.",
        minutes: 2,
      },
      standard: {
        title: "Choose one skill to focus on this month",
        description: "Pick the one that shows up most in roles you want.",
        minutes: 3,
      },
      stretch: {
        title: "Pick a skill and find one short course for it",
        description: "Free is fine.",
        minutes: 15,
      },
    }),
  },
  {
    id: "explore-path",
    category: "career_exploration",
    applies: (s, c) => exploring(s, c),
    build: (c) => {
      const [a, b] = c.careerInterests.map((x) => x.label);
      return {
        why: "Seeing a real day in a role tells you more than any quiz.",
        lighter: {
          title: "Pick one career you’re curious about",
          description: "Any one. You can change your mind.",
          minutes: 2,
        },
        standard: {
          title: a
            ? `Explore ${a} for 5 minutes`
            : "Explore one career path for 5 minutes",
          description: "Try a “day in the life” video.",
          minutes: 5,
        },
        stretch: {
          title:
            a && b
              ? `Compare ${a} and ${b}`
              : "Compare two paths you’re curious about",
          description: "Ask Mentr what a typical week looks like in each.",
          minutes: 15,
        },
      };
    },
  },
  {
    id: "notice-energy",
    category: "career_exploration",
    applies: (s, c) => exploring(s, c),
    build: () => ({
      why: "What you enjoy is the best clue to work that will suit you.",
      lighter: {
        title: "Think of the best part of your week",
        description: "What were you doing?",
        minutes: 2,
      },
      standard: {
        title: "Notice one moment today you lost track of time",
        description: "A quick note on your phone is enough.",
        minutes: 2,
      },
      stretch: {
        title: "Ask Mentr what your interests might add up to",
        description: "Share a few things you enjoy.",
        minutes: 10,
      },
    }),
  },
  {
    id: "save-posting",
    category: "career_exploration",
    applies: (s, c) => exploring(s, c),
    build: () => ({
      why: "Real postings make fuzzy careers concrete — you’ll see what the work actually is.",
      lighter: {
        title: "Search one job title that sounds interesting",
        description: "Just look.",
        minutes: 3,
      },
      standard: {
        title: "Save one job posting that sounds interesting",
        description: "Even if you’re nowhere near ready.",
        minutes: 5,
      },
      stretch: {
        title: "Save three postings from different fields",
        description: "Notice which ones pull you in.",
        minutes: 15,
      },
    }),
  },
  {
    id: "ask-focus",
    category: "career_exploration",
    applies: any,
    build: () => ({
      why: "A quick check-in keeps your week pointed at what matters most.",
      lighter: {
        title: "Ask Mentr one question you’ve been sitting on",
        description: "Anything goes.",
        minutes: 2,
      },
      standard: {
        title: "Ask Mentr what you should focus on this week",
        description: "It already knows your goals.",
        minutes: 3,
      },
      stretch: {
        title: "Talk through your next month with Mentr",
        description: "Leave with one clear priority.",
        minutes: 15,
      },
    }),
  },
  {
    id: "win",
    category: "experience",
    applies: (s) => worker(s),
    build: () => ({
      why: "Wins with numbers are what make reviews, resumes, and interviews easy.",
      lighter: {
        title: "Think of one thing you’re proud of this month",
        description: "Big or small.",
        minutes: 2,
      },
      standard: {
        title: "Save one recent win in your notes, with a number",
        description: "Time saved, customers, revenue — whatever fits.",
        minutes: 3,
      },
      stretch: {
        title: "Add your best recent win to your resume",
        description: "Ask Mentr to help phrase it.",
        minutes: 15,
      },
    }),
  },
  {
    id: "customers",
    category: "business",
    applies: founderWithIdea,
    build: () => ({
      why: "Talking to real potential customers is the cheapest way to find out if the idea works.",
      lighter: {
        title: "Name one person who has the problem you’re solving",
        description: "A real person.",
        minutes: 2,
      },
      standard: {
        title: "Name three people who have the problem you’re solving",
        description: "Real names or places to find them.",
        minutes: 5,
      },
      stretch: {
        title: "Message one of them to ask about the problem",
        description: "Ask about the problem, not your idea.",
        minutes: 10,
      },
    }),
  },
  {
    id: "alternative",
    category: "business",
    applies: founderWithIdea,
    build: () => ({
      why: "Your customers already use something. Their complaints about it are your opening.",
      lighter: {
        title: "Think of one thing customers use instead of you today",
        description: "Even a workaround counts.",
        minutes: 2,
      },
      standard: {
        title: "Find one product your customers use instead",
        description: "Save the link.",
        minutes: 5,
      },
      stretch: {
        title: "Skim five reviews of that product",
        description: "Look for the same complaint twice.",
        minutes: 15,
      },
    }),
  },
  {
    id: "price-check",
    category: "business",
    applies: founderWithIdea,
    build: () => ({
      why: "Knowing what similar things sell for keeps your pricing grounded in reality.",
      lighter: {
        title: "Look up the price of one similar product",
        description: "Just one.",
        minutes: 3,
      },
      standard: {
        title: "Look up what three similar products sell for",
        description: "Note the range.",
        minutes: 5,
      },
      stretch: {
        title: "Estimate what one unit costs you to make",
        description: "Rough numbers are fine. Mentr can help.",
        minutes: 15,
      },
    }),
  },
  {
    id: "one-liner",
    category: "business",
    applies: founderWithIdea,
    build: () => ({
      why: "If you can say it in one sentence, other people can repeat it.",
      lighter: {
        title: "Try saying your idea in one sentence",
        description: "Out loud counts.",
        minutes: 2,
      },
      standard: {
        title: "Text your one-sentence idea to a friend",
        description: "See if they get it right away.",
        minutes: 3,
      },
      stretch: {
        title: "Ask two people what they’d pay for it",
        description: "Listen more than you pitch.",
        minutes: 15,
      },
    }),
  },
  {
    id: "notice-problem",
    category: "business",
    applies: founderNoIdea,
    build: () => ({
      why: "Good business ideas usually start as an everyday annoyance someone would pay to fix.",
      lighter: {
        title: "Think of one thing that annoyed you this week",
        description: "Anything counts.",
        minutes: 2,
      },
      standard: {
        title: "Notice one everyday frustration today",
        description: "Save it in your notes.",
        minutes: 2,
      },
      stretch: {
        title: "Ask one person about the most annoying part of their week",
        description: "Listen for problems people would pay to solve.",
        minutes: 10,
      },
    }),
  },
  {
    id: "strength",
    category: "business",
    applies: founderNoIdea,
    build: () => ({
      why: "Businesses built on your strengths are easier to start and more fun to run.",
      lighter: {
        title: "Think of one thing people ask you for help with",
        description: "That’s a strength.",
        minutes: 2,
      },
      standard: {
        title: "Pick one thing people often ask you for help with",
        description: "Just name it.",
        minutes: 3,
      },
      stretch: {
        title: "Ask Mentr what businesses could come from it",
        description: "Share the skill and see what comes up.",
        minutes: 10,
      },
    }),
  },
];

export type DailyActionOptions = {
  /** Milestones the action may advance (ref = id or key). */
  milestones: { ref: string; category: Category | null }[];
  avoidTitles?: string[];
  difficulty?: Difficulty;
  seed?: string;
  /** Prefer a different template than the one being replaced. */
  excludeCategory?: Category;
  /** Templates to favor (e.g. the most inviting ones for a first day). */
  preferIds?: string[];
};

export function rulesDailyAction(
  ctx: MentorContext,
  opts: DailyActionOptions,
): ActionDraft {
  const seg = segmentOf(ctx);
  const difficulty = opts.difficulty ?? "standard";
  const avoid = new Set((opts.avoidTitles ?? []).map((t) => t.toLowerCase()));
  const recentCats = ctx.recentActions.map((a) => a.category);

  const candidates = TEMPLATES.filter((t) => t.applies(seg, ctx))
    .map((t) => ({ t, built: t.build(ctx) }))
    .filter(
      ({ built }) =>
        !(["lighter", "standard", "stretch"] as const).some((l) =>
          avoid.has(built[l].title.toLowerCase()),
        ),
    );

  // Everything used recently? A repeat beats no step at all.
  const pool = candidates.length
    ? candidates
    : TEMPLATES.filter((t) => t.applies(seg, ctx)).map((t) => ({
        t,
        built: t.build(ctx),
      }));
  const seed = opts.seed ?? ctx.today;
  const scored = pool
    .map(({ t, built }) => {
      const used = recentCats.filter((c) => c === t.category).length;
      const excluded = opts.excludeCategory === t.category ? 10 : 0;
      // Prefer actions that advance an existing milestone.
      const preferred = opts.preferIds?.includes(t.id) ? -5 : 0;
      const unlinked =
        opts.milestones.length &&
        !opts.milestones.some((x) => x.category === t.category)
          ? 2
          : 0;
      return {
        t,
        built,
        score:
          used * 3 +
          excluded +
          unlinked +
          preferred +
          (hash(`${seed}:${t.id}`) % 100) / 100,
      };
    })
    .sort((a, b) => a.score - b.score);

  const { t, built } = scored[0];
  const level = built[difficulty];
  const milestone =
    opts.milestones.find((x) => x.category === t.category) ?? null;
  return {
    title: level.title,
    description: level.description,
    why: built.why,
    category: t.category,
    estimated_minutes: level.minutes,
    difficulty,
    milestone_ref: milestone?.ref ?? null,
  };
}

/**
 * Resizes an existing rules-based action (same idea, different size).
 * Returns null when the action didn't come from a known template.
 */
export function resizeRulesAction(
  ctx: MentorContext,
  current: { title: string; milestone_ref: string | null },
  difficulty: Difficulty,
): ActionDraft | null {
  for (const t of TEMPLATES) {
    const built = t.build(ctx);
    const levels = [built.lighter, built.standard, built.stretch];
    if (!levels.some((l) => l.title === current.title)) continue;
    const level = built[difficulty];
    return {
      title: level.title,
      description: level.description,
      why: built.why,
      category: t.category,
      estimated_minutes: level.minutes,
      difficulty,
      milestone_ref: current.milestone_ref,
    };
  }
  return null;
}
