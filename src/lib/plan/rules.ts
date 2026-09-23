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
      "Keep a simple log of moments you enjoyed or lost track of time, and what they had in common.",
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
      "Write your transition story",
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
      "Document your wins with numbers",
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
      "Keep a problem journal",
      "Write down frustrations you notice — yours and other people’s.",
      "Ideas hide in everyday annoyances. A journal makes them visible.",
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
  "campus-org": "Shortlist two campus organizations and attend one meeting",
  "network-3": "Reach out to one person working in your target field",
  "first-project": "Pick a first project and write a one-page plan",
  resume: "Update your resume with your strongest project",
  "target-list": "Save five internships to your target list",
  "learn-skill": "Do two short learning sessions",
  shortlist: "Read about two roles you’re curious about",
  conversations: "Reach out to one person doing work you’re curious about",
  "energy-audit": "Start a simple log of what energizes you",
  "first-experiment": "Choose one small experiment to try",
  story: "Draft your two-sentence transition story",
  network: "Reach out to one person in your target role",
  requirements: "Review three real job postings for your target role",
  wins: "Write down three wins with numbers",
  customer: "Write your one-sentence problem statement",
  competitors: "List three alternatives your customers use today",
  test: "Decide on one cheap test you could run",
  costs: "List every cost that goes into one unit",
  rules: "Find your local official small-business guidance",
  strengths: "List your top skills and problems they could solve",
  "problem-journal": "Write down three frustrations you notice this week",
  "talk-owners": "Ask one small-business owner how they started",
  club: "Look through your school’s clubs and pick one to try",
  "talk-to-someone":
    "Think of one person in your field of interest you could talk to",
  "skill-month": "Do two short learning sessions",
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
  const priorities: PriorityDraft[] = picks.map((x) => ({
    title: WEEKLY_STEPS[x.key] ?? `Take the next small step on “${x.title}”`,
    why: x.why,
    category: x.category ?? "career_exploration",
    milestone_key: x.key,
  }));
  priorities.push({
    title: "Do your 1% action on at least four days",
    why: "Small, steady steps are what add up. Missing a day is fine — just pick it back up.",
    category: "learning",
    milestone_key: null,
  });
  return priorities.slice(0, 5);
}

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
      ? "You don’t need to have it figured out. This plan starts by exploring deliberately — small experiments and real conversations — so your direction comes from evidence, not guesswork."
      : `This plan works backward from ${lc(north_star)}. Each layer supports the one above it, and today’s step is always tied to something bigger.`,
    milestones,
    weekly_priorities: rulesWeeklyPriorities(ctx, milestones),
    // Link today's action to the nearest-horizon milestone it advances.
    today: rulesDailyAction(ctx, {
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

const TEMPLATES: Template[] = [
  {
    id: "resume-projects",
    category: "experience",
    applies: (s, c) => college(s) && directed(s, c),
    build: (c) => ({
      why: `People hiring for ${tgt(c)} look for evidence you’ve built real things. A strong projects section is the fastest way to show it.`,
      lighter: {
        title: "List two projects you could put on your resume",
        description: "Class projects count. Just the names and one line each.",
        minutes: 5,
      },
      standard: {
        title: "Spend 15 minutes updating the projects section of your resume",
        description:
          "Pick your strongest project and rewrite it as: what you built, how, and the result.",
        minutes: 15,
      },
      stretch: {
        title: "Rewrite every project on your resume with measurable outcomes",
        description:
          "Add numbers wherever you can — users, accuracy, time saved, scale.",
        minutes: 30,
      },
    }),
  },
  {
    id: "save-internships",
    category: "applications",
    applies: (s, c) => college(s) && directed(s, c),
    build: (c) => ({
      why: `You want an internship in ${tgt(c)}. Collecting real postings now shows you deadlines and requirements before they sneak up on you.`,
      lighter: {
        title: `Find one ${tgt(c)} internship and save it`,
        description:
          "Use your school’s career portal or a job board. Note the deadline.",
        minutes: 10,
      },
      standard: {
        title: `Find two ${tgt(c)} internships and save them`,
        description: "Note each deadline and one requirement you already meet.",
        minutes: 20,
      },
      stretch: {
        title: `Find five ${tgt(c)} internships and compare their requirements`,
        description:
          "Which skills show up in most of them? That’s your study list.",
        minutes: 35,
      },
    }),
  },
  {
    id: "follow-people",
    category: "networking",
    applies: (s, c) => directed(s, c),
    build: (c) => ({
      why: `Following people who do ${tgt(c)} work is a low-effort way to learn the vocabulary, tools, and debates of the field.`,
      lighter: {
        title: `Follow one person who works in ${tgt(c)}`,
        description:
          "Someone who posts about their actual work, not just news.",
        minutes: 5,
      },
      standard: {
        title: `Follow three people working in ${tgt(c)} and save one post that teaches you something`,
        description: "Write one sentence about what you learned.",
        minutes: 10,
      },
      stretch: {
        title: `Follow five people in ${tgt(c)} and leave one thoughtful comment`,
        description:
          "A genuine question or insight — it’s how conversations start.",
        minutes: 20,
      },
    }),
  },
  {
    id: "alumni-note",
    category: "networking",
    applies: (s, c) => college(s) && directed(s, c),
    build: (c) => {
      const school = c.education?.school ? `${c.education.school} ` : "";
      return {
        why: "Alumni are the warmest possible cold contacts. One short conversation can tell you more about a role than hours of reading.",
        lighter: {
          title: `Find one ${school}alum working in ${tgt(c)}`,
          description:
            "LinkedIn’s alumni search or your school’s alumni network are good places to look.",
          minutes: 10,
        },
        standard: {
          title: `Draft a short note to one ${school}alum working in ${tgt(c)}`,
          description:
            "Three sentences: who you are, what you admire about their path, one specific question.",
          minutes: 20,
        },
        stretch: {
          title: `Send notes to two ${school}alumni working in ${tgt(c)}`,
          description: "Personalize each one. Ask for 15 minutes, not a job.",
          minutes: 30,
        },
      };
    },
  },
  {
    id: "job-description",
    category: "career_exploration",
    applies: (s, c) => directed(s, c),
    build: (c) => ({
      why: `Real job descriptions are the clearest map of what ${tgt(c)} requires — and where you already have a head start.`,
      lighter: {
        title: `Skim one ${tgt(c)} job description`,
        description: "Highlight one skill you already have.",
        minutes: 5,
      },
      standard: {
        title: `Read one ${tgt(c)} job description and highlight what you already have`,
        description:
          "Then circle the one requirement you’d most like to build next.",
        minutes: 15,
      },
      stretch: {
        title: `Compare three ${tgt(c)} job descriptions`,
        description:
          "List requirements that appear in all three and rate yourself on each.",
        minutes: 30,
      },
    }),
  },
  {
    id: "learn-skill",
    category: "learning",
    applies: (_s, c) =>
      Boolean(
        c.preferences?.skillsToLearn.length ||
        c.skills.some((k) => k.status === "target"),
      ),
    build: (c) => {
      const skill =
        c.preferences?.skillsToLearn[0] ??
        c.skills.find((k) => k.status === "target")?.name ??
        "a new skill";
      return {
        why: `You said you want to learn ${skill}. Short, regular sessions build it faster than occasional marathons.`,
        lighter: {
          title: `Spend 10 minutes on the basics of ${skill}`,
          description:
            "One short tutorial or chapter. Write down one thing you learned.",
          minutes: 10,
        },
        standard: {
          title: `Spend 20 minutes learning ${skill}`,
          description:
            "Follow along with a tutorial and try one exercise yourself.",
          minutes: 20,
        },
        stretch: {
          title: `Use ${skill} on a tiny real problem`,
          description:
            "Apply it to something from your life or coursework, even if it’s rough.",
          minutes: 40,
        },
      };
    },
  },
  {
    id: "campus-orgs",
    category: "experience",
    applies: (s) => s === "student" || s === "high_school",
    build: (c) => ({
      why: `Campus organizations give you projects, leadership experience, and people already on the path${targetOf(c) ? ` to ${targetOf(c)}` : ""}.`,
      lighter: {
        title: "Look up your school’s student organization directory",
        description: "Just find it and bookmark it.",
        minutes: 5,
      },
      standard: {
        title: "Shortlist two student organizations related to your goals",
        description:
          "Check when they meet next and put one meeting on your calendar.",
        minutes: 15,
      },
      stretch: {
        title: "Reach out to a leader of one student organization",
        description: "Ask how new members usually get involved in projects.",
        minutes: 25,
      },
    }),
  },
  {
    id: "career-center",
    category: "applications",
    applies: (s) => s === "student",
    build: () => ({
      why: "Career centers run resume reviews, mock interviews, and employer events that most students never use. It’s free leverage.",
      lighter: {
        title: "Find your career center’s events page",
        description: "Bookmark it for later.",
        minutes: 5,
      },
      standard: {
        title: "Check your career center’s upcoming events and save one",
        description:
          "Look for employer panels, info sessions, or resume workshops.",
        minutes: 10,
      },
      stretch: {
        title: "Book a resume review or advising appointment",
        description: "Bring a specific question about your target roles.",
        minutes: 20,
      },
    }),
  },
  {
    id: "project-plan",
    category: "experience",
    applies: (s, c) => directed(s, c),
    build: (c) => ({
      why: `A small project is proof you can do ${tgt(c)} work — and gives you something concrete to talk about.`,
      lighter: {
        title: "Write down three project ideas you could finish in a weekend",
        description: "Rough is fine.",
        minutes: 10,
      },
      standard: {
        title: `Write a one-page plan for a small project that shows ${tgt(c)} skills`,
        description:
          "Problem, who it’s for, what you’ll build, how you’ll know it worked.",
        minutes: 25,
      },
      stretch: {
        title: "Build the first working piece of your project",
        description: "The smallest version that does something real.",
        minutes: 45,
      },
    }),
  },
  {
    id: "questions",
    category: "networking",
    applies: (s, c) => careerSeekers(s) && Boolean(targetOf(c)),
    build: (c) => ({
      why: "Good questions make conversations with professionals easy and memorable. Prepare them before you need them.",
      lighter: {
        title: `Write one question you’d ask someone in ${tgt(c)}`,
        description: "Something you can’t easily find online.",
        minutes: 5,
      },
      standard: {
        title: `Write three questions you’d ask someone working in ${tgt(c)}`,
        description:
          "Aim for questions about their day, their path, and what they wish they’d known.",
        minutes: 10,
      },
      stretch: {
        title: "Ask one of your questions to someone this week",
        description: "In person, by message, or at an event.",
        minutes: 20,
      },
    }),
  },
  {
    id: "energy-log",
    category: "career_exploration",
    applies: (s, c) => exploring(s, c),
    build: () => ({
      why: "Your own patterns are the best clue to work that will suit you. This takes the guesswork out of “what do I want?”",
      lighter: {
        title: "Write down one moment this week you really enjoyed",
        description: "What were you doing?",
        minutes: 5,
      },
      standard: {
        title:
          "Write down three moments you felt energized recently — and what they had in common",
        description:
          "Look for patterns: people, problems, making, organizing, helping.",
        minutes: 10,
      },
      stretch: {
        title: "Turn your energy patterns into three possible directions",
        description: "For each, name one job title to look into.",
        minutes: 25,
      },
    }),
  },
  {
    id: "compare-roles",
    category: "career_exploration",
    applies: (s, c) => exploring(s, c),
    build: (c) => {
      const [a, b] = c.careerInterests.map((x) => x.label);
      const pair =
        a && b
          ? `${a} and ${b}`
          : a
            ? `${a} and one other role`
            : "two roles you’re curious about";
      return {
        why: "Comparing concrete roles side by side turns a vague question into something you can actually reason about.",
        lighter: {
          title: `Look up what a typical day looks like in ${a ?? "one role you’re curious about"}`,
          description: "One article or video is enough.",
          minutes: 10,
        },
        standard: {
          title: `Compare ${pair}: what does a typical day look like in each?`,
          description: "Note what sounds exciting and what sounds draining.",
          minutes: 20,
        },
        stretch: {
          title: `Find one person in each of ${pair} and read how they got there`,
          description: "Look for their first job and the skills they mention.",
          minutes: 30,
        },
      };
    },
  },
  {
    id: "skills-inventory",
    category: "skills",
    applies: any,
    build: () => ({
      why: "Knowing exactly what you’re good at — with examples — makes every application, conversation, and decision easier.",
      lighter: {
        title: "List three things you’re good at",
        description: "One example for each.",
        minutes: 5,
      },
      standard: {
        title: "List five skills you’ve used this year, with one example each",
        description: "Include things from classes, jobs, clubs, or life.",
        minutes: 15,
      },
      stretch: {
        title: "Turn your skill examples into three resume bullet points",
        description: "Action verb, what you did, result.",
        minutes: 25,
      },
    }),
  },
  {
    id: "wins",
    category: "experience",
    applies: (s) => worker(s),
    build: () => ({
      why: "Quantified wins are the raw material for promotions, resumes, and interviews — and they’re easy to forget.",
      lighter: {
        title: "Write down one win from the last month",
        description: "Include a number if you can.",
        minutes: 5,
      },
      standard: {
        title: "Write down three wins from the last quarter, with numbers",
        description: "Time saved, revenue, customers, quality — whatever fits.",
        minutes: 15,
      },
      stretch: {
        title: "Turn your wins into a one-paragraph brag document",
        description: "Useful for reviews, networking, and your resume.",
        minutes: 30,
      },
    }),
  },
  {
    id: "coffee-chat",
    category: "networking",
    applies: (s) => worker(s),
    build: (c) => ({
      why: `Conversations with people already doing ${tgt(c)} work are how most role changes actually happen.`,
      lighter: {
        title: `Identify one person in a role you admire`,
        description: "Inside or outside your company.",
        minutes: 5,
      },
      standard: {
        title: `Ask one person working in ${tgt(c)} for a 20-minute chat`,
        description: "Be specific about why them and what you’d like to learn.",
        minutes: 10,
      },
      stretch: {
        title: "Reach out to two people and prepare questions for each",
        description: "Tailor the questions to their path.",
        minutes: 30,
      },
    }),
  },
  {
    id: "problem-statement",
    category: "business",
    applies: founderWithIdea,
    build: () => ({
      why: "A sharp problem statement drives every later decision — who you sell to, what you build, and how you price.",
      lighter: {
        title: "Write one sentence: who has the problem you’re solving?",
        description: "Be as specific as possible.",
        minutes: 5,
      },
      standard: {
        title: "Write a one-sentence problem statement",
        description:
          "Who has the problem, how often, and what it costs them today.",
        minutes: 10,
      },
      stretch: {
        title: "Test your problem statement on two potential customers",
        description: "Do they say “yes, exactly”? Note their words.",
        minutes: 30,
      },
    }),
  },
  {
    id: "customer-list",
    category: "business",
    applies: founderWithIdea,
    build: () => ({
      why: "Talking to real potential customers is the cheapest way to find out if your idea works — before you spend money.",
      lighter: {
        title: "Write down three people who have the problem you’re solving",
        description: "Real names or specific places to find them.",
        minutes: 5,
      },
      standard: {
        title: "List five potential customers and how you could reach each one",
        description: "Friends of friends, local groups, online communities.",
        minutes: 15,
      },
      stretch: {
        title: "Have one customer conversation this week",
        description: "Ask about the problem, not your solution.",
        minutes: 30,
      },
    }),
  },
  {
    id: "alternatives",
    category: "business",
    applies: founderWithIdea,
    build: () => ({
      why: "Customers always have an alternative, even if it’s doing nothing. Your opening is in what they dislike about it.",
      lighter: {
        title: "Name one alternative your customers use today",
        description: "Even if it’s a workaround.",
        minutes: 5,
      },
      standard: {
        title:
          "List three alternatives your customers use and what they dislike about each",
        description: "Reviews and forums are great sources.",
        minutes: 20,
      },
      stretch: {
        title:
          "Write your positioning: how you’re different from each alternative",
        description: "One line per alternative.",
        minutes: 30,
      },
    }),
  },
  {
    id: "unit-cost",
    category: "business",
    applies: founderWithIdea,
    build: () => ({
      why: "If you don’t know what one unit costs you, you can’t price it — and you can’t tell whether the business can work.",
      lighter: {
        title: "List every cost that goes into one unit of your offering",
        description: "Materials, packaging, time, fees, shipping.",
        minutes: 10,
      },
      standard: {
        title: "Estimate the cost to make or deliver one unit",
        description: "Rough numbers are fine; mark which ones are guesses.",
        minutes: 20,
      },
      stretch: {
        title: "Calculate your margin at three different prices",
        description: "Price minus unit cost, as a percentage.",
        minutes: 30,
      },
    }),
  },
  {
    id: "problem-journal",
    category: "business",
    applies: founderNoIdea,
    build: () => ({
      why: "Good business ideas usually start with a real, frequent frustration. Writing them down makes them visible.",
      lighter: {
        title: "Write down one frustration you noticed today",
        description: "Yours or someone else’s.",
        minutes: 5,
      },
      standard: {
        title: "Write down three frustrations you noticed today",
        description: "Who had them, and how often do they happen?",
        minutes: 10,
      },
      stretch: {
        title: "Ask two people about the most annoying part of their week",
        description: "Listen for problems people would pay to solve.",
        minutes: 25,
      },
    }),
  },
  {
    id: "skills-to-ideas",
    category: "business",
    applies: founderNoIdea,
    build: () => ({
      why: "Businesses built on your strengths are easier to start and more fun to run.",
      lighter: {
        title: "List your top three skills",
        description: "Things people ask you for help with count.",
        minutes: 5,
      },
      standard: {
        title:
          "List your top five skills and one problem each could help solve",
        description: "Don’t filter — quantity first.",
        minutes: 15,
      },
      stretch: {
        title: "Pick your best skill-problem pair and sketch a tiny offer",
        description: "Who it’s for, what they get, what you’d charge.",
        minutes: 30,
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

  const pool = candidates.length
    ? candidates
    : TEMPLATES.filter((t) => t.id === "skills-inventory").map((t) => ({
        t,
        built: t.build(ctx),
      }));
  const seed = opts.seed ?? ctx.today;
  const scored = pool
    .map(({ t, built }) => {
      const used = recentCats.filter((c) => c === t.category).length;
      const excluded = opts.excludeCategory === t.category ? 10 : 0;
      // Prefer actions that advance an existing milestone.
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
