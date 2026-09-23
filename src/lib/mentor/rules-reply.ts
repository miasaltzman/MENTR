import type { MentorContext } from "@/lib/ai/context";
import { isExploring, roleNoun, segmentOf, targetOf } from "@/lib/plan/rules";
import type { Suggestions } from "./schemas";

/**
 * Deterministic mentor replies for demo mode and model outages. Short,
 * personal, "here’s what I’d do next" — built from the user's own context,
 * never inventing facts, and never handing out homework.
 */
type Reply = { text: string; suggestions: Suggestions | null };

const has = (msg: string, ...words: string[]) =>
  words.some((w) => msg.includes(w));

function today(
  title: string,
  why: string,
  category: NonNullable<Suggestions["items"][number]["category"]>,
  minutes: number,
) {
  return {
    kind: "set_today" as const,
    title,
    why,
    horizon: null,
    category,
    estimated_minutes: minutes,
  };
}

function milestone(
  title: string,
  why: string,
  horizon: "year" | "term" | "month",
  category: NonNullable<Suggestions["items"][number]["category"]>,
) {
  return {
    kind: "add_milestone" as const,
    title,
    why,
    horizon,
    category,
    estimated_minutes: null,
  };
}

export function rulesMentorReply(ctx: MentorContext, message: string): Reply {
  const msg = message.toLowerCase();
  const name = ctx.profile.firstName ? `${ctx.profile.firstName}, ` : "";
  const target = targetOf(ctx);
  const seg = segmentOf(ctx);
  const focus = ctx.roadmap?.milestones.find(
    (m) => m.status === "in_progress" || m.status === "not_started",
  );
  const school = ctx.education?.school;

  if (has(msg, "behind", "overwhelm", "stressed", "anxious", "lost")) {
    return {
      text: `${name}that feeling is really common — and it usually means you care. Most people who look “ahead” just started one small thing earlier.\n\nHere’s what I’d do: pick **one** thing that matters this week${focus ? ` (I’d go with ${focus.title.toLowerCase()})` : ""}, take one tiny step on it today, and let the rest wait.\n\nWhat feels most urgent right now?`,
      suggestions: {
        items: [
          today(
            "Pick the one thing that matters most this week",
            "One clear priority turns a vague feeling into a next step.",
            "career_exploration",
            2,
          ),
        ],
      },
    };
  }

  if (
    has(
      msg,
      "no idea",
      "don't know what",
      "dont know what",
      "not sure what career",
      "which career",
      "compare",
    )
  ) {
    const interests = ctx.careerInterests.map((c) => c.label);
    return {
      text: `${name}not knowing yet is a fine place to start. You don’t need to think your way to an answer — try small things and notice what pulls you in.\n\nHere’s what I’d do:\n- Pick three roles to look into${interests.length ? ` — ${interests.slice(0, 3).join(", ")} is a good start` : ""}.\n- Spend five minutes on a “day in the life” video for each.\n- Talk to one person doing the one that sounds best.\n\nWant to start with the first one today?`,
      suggestions: {
        items: [
          today(
            interests[0]
              ? `Explore ${interests[0]} for 5 minutes`
              : "Explore one career path for 5 minutes",
            "Seeing a real day in a role tells you more than any quiz.",
            "career_exploration",
            5,
          ),
          milestone(
            "Try three possible paths with small experiments",
            "Small real-world tries give you evidence instead of guesses.",
            "term",
            "career_exploration",
          ),
        ],
      },
    };
  }

  if (has(msg, "summer")) {
    const role = target ?? "the field you’re exploring";
    return {
      text: `${name}a good summer gets you **real experience**, something you can **show**, or **people** who know you. Ideally two of the three.\n\nFor ${role}, I’d aim for an internship or research role first — and start looking early, since many recruit months ahead. If that doesn’t land, a small project plus a few conversations with people in ${role} is a strong plan B.\n\nI can’t see live postings yet, so ${school ? `${school}’s career portal` : "your career portal and job boards"} are the place to check.`,
      suggestions: {
        items: [
          today(
            "Save one internship you’d actually apply to",
            "Real postings show you what employers want — and when deadlines hit.",
            "applications",
            5,
          ),
          milestone(
            `Line up a summer experience in ${role}`,
            "Summer is the easiest time to build experience that changes your next application.",
            "term",
            "applications",
          ),
        ],
      },
    };
  }

  if (has(msg, "project")) {
    const role = target ?? "your area of interest";
    return {
      text: `${name}here’s what I’d do: pick a real problem you’ve seen up close — at school, at work, or somewhere you spend time — and build the smallest thing that helps.\n\n1. Choose the problem.\n2. Build a tiny first version.\n3. Show it to three people.\n4. Share what you learned in a short post.\n\nThat last step is what people in ${role} will remember. Start with step one today?`,
      suggestions: {
        items: [
          today(
            "Choose which project idea you want to build",
            `Deciding is the hardest part — once you pick, the next steps are small.`,
            "experience",
            5,
          ),
          milestone(
            "Finish one small project you can show people",
            "Something real you built is the strongest proof of what you can do.",
            "term",
            "experience",
          ),
        ],
      },
    };
  }

  if (
    has(
      msg,
      "career fair",
      "recruiter",
      "networking",
      "coffee chat",
      "informational",
    )
  ) {
    return {
      text: `${name}a little prep goes a long way.\n\n**Have a 20-second intro:** who you are, what you’re interested in${target ? ` (${target})` : ""}, and one thing you’ve done that shows it.\n\n**Good questions:**\n- What does a typical week look like early in this role?\n- What makes a new hire stand out?\n- What do you wish you’d known when you started?\n\nAfterward, a short thank-you within a day that mentions something specific.`,
      suggestions: {
        items: [
          today(
            "Say your 20-second intro out loud once",
            "Saying it once makes it easy when it counts.",
            "networking",
            3,
          ),
        ],
      },
    };
  }

  if (
    seg === "founder" ||
    has(msg, "business", "startup", "idea", "customers", "pricing", "price")
  ) {
    const idea = ctx.venture?.ideaSummary;
    if (!idea || isExploring(ctx)) {
      return {
        text: `${name}the best ideas usually start as everyday annoyances, not brainstorms. For the next week, just notice what frustrates you and the people around you — and how often.\n\nThen look for overlap with what you’re good at. A problem that’s frequent, painful, and close to your skills is worth testing.`,
        suggestions: {
          items: [
            today(
              "Notice one everyday frustration today",
              "Real, frequent problems are where good ideas come from.",
              "business",
              2,
            ),
          ],
        },
      };
    }
    return {
      text: `${name}for “${idea}”, the most valuable thing right now is evidence that people want it — before you spend much money.\n\nHere’s what I’d do next:\n- Talk to a few potential customers about the problem (not your idea).\n- Look up what similar things sell for.\n- Run one cheap test, like pre-orders or a small batch.\n\nFor permits or regulations, rely on your city or county’s official guidance — rules vary a lot by place.`,
      suggestions: {
        items: [
          today(
            "Name three people who have the problem you’re solving",
            "Customer conversations are the cheapest way to validate an idea.",
            "business",
            5,
          ),
          milestone(
            "Have five customer conversations",
            "Five real conversations tell you more than months of planning.",
            "month",
            "business",
          ),
        ],
      },
    };
  }

  if (has(msg, "this week", "today", "what should i do", "next step")) {
    return {
      text: `${name}here’s where I’d focus${focus ? `: **${focus.title}**` : ""}.\n\nOne small step a day beats a big push once a week. Your 1% on the home screen is picked to move this forward — start there.\n\nIf something’s making this week harder than usual, tell me and we’ll adjust.`,
      suggestions: null,
    };
  }

  const direction = target
    ? `toward ${target}`
    : "toward something you’re excited about";
  return {
    text: `${name}good question. Quick check so I give you something useful: are you after a decision, a plan, or just a sounding board?\n\nMeanwhile, my rule of thumb: small moves that build real evidence ${direction} — people, projects, applications — beat more research.`,
    suggestions: target
      ? {
          items: [
            today(
              `Follow one ${roleNoun(target)} on LinkedIn`,
              "Seeing what people in your target role talk about helps you understand the job.",
              "networking",
              3,
            ),
          ],
        }
      : null,
  };
}
