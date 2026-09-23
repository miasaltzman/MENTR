import type { MentorContext } from "@/lib/ai/context";
import { isExploring, segmentOf, targetOf } from "@/lib/plan/rules";
import type { Suggestions } from "./schemas";

/**
 * Deterministic mentor replies for demo mode and model outages. They use the
 * user's own context, recognise common questions, and never invent facts.
 */
type Reply = { text: string; suggestions: Suggestions | null };

const has = (msg: string, ...words: string[]) =>
  words.some((w) => msg.includes(w));

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
      text: `${name}feeling behind is really common — and usually a sign you care, not that you’re failing. Most people who look “ahead” just started one small thing earlier.\n\nHere’s what I’d do:\n- Pick **one** thing that matters most this week${focus ? ` (I’d suggest: ${focus.title.toLowerCase()})` : ""}.\n- Do one 15-minute step on it today.\n- Ignore the rest for now — it’ll still be there next week.\n\nWhat feels most urgent to you right now?`,
      suggestions: {
        items: [
          {
            kind: "set_today",
            title: "Write down the one thing that matters most this week",
            why: "Narrowing to one priority turns a vague feeling of being behind into a concrete next step.",
            horizon: null,
            category: "career_exploration",
            estimated_minutes: 10,
          },
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
      text: `${name}not knowing yet is a fine place to start. The trick is to explore with small experiments instead of trying to think your way to an answer.\n\nA simple approach:\n1. **Notice energy.** For a week, jot down moments you enjoyed or lost track of time.\n2. **Shortlist three roles**${interests.length ? ` — you mentioned ${interests.slice(0, 3).join(", ")}, which is a good start` : ""}.\n3. **Try a tiny version of each** — a short project, a conversation with someone in the role, or a free intro course.\n\nAfter a few weeks you’ll have evidence instead of guesses. Want me to add a “test three paths” milestone to your roadmap?`,
      suggestions: {
        items: [
          {
            kind: "add_milestone",
            title: "Test three possible career paths with small experiments",
            why: "Trying small versions of each path gives you real evidence about what fits.",
            horizon: "term",
            category: "career_exploration",
            estimated_minutes: null,
          },
        ],
      },
    };
  }

  if (has(msg, "summer")) {
    const role = target ?? "the field you’re exploring";
    return {
      text: `${name}a good summer does one of three things: gets you **real experience**, builds **proof** (projects you can show), or grows your **network**. Ideally two.\n\nFor ${role}, in order of impact:\n- **An internship or research role** — apply early; many programs recruit months ahead.\n- **A substantial project** — something you can demo and explain in interviews.\n- **Structured learning + people** — a course plus a few conversations with people in ${role}.\n\nI can’t see live postings yet, so check ${school ? `${school}’s career portal` : "your career portal and job boards"} for current deadlines. Want me to add a summer milestone to your roadmap?`,
      suggestions: {
        items: [
          {
            kind: "add_milestone",
            title: `Line up a summer experience related to ${role}`,
            why: "Summer is the easiest time to build experience that changes your next application.",
            horizon: "term",
            category: "applications",
            estimated_minutes: null,
          },
        ],
      },
    };
  }

  if (has(msg, "project")) {
    const role = target ?? "your area of interest";
    const skill = ctx.preferences?.skillsToLearn[0];
    return {
      text: `${name}here’s a project shape that works well for ${role}:\n\n**Pick a real problem you’ve seen up close** — at school, work, or in a community you’re part of. Then:\n1. Write a one-page brief: who has the problem, how they handle it today, what “better” looks like.\n2. Build the smallest version that helps${skill ? ` (a good chance to practice ${skill})` : ""}.\n3. Show it to three people and write down what they say.\n4. Write a short case study: problem, approach, what you learned, what you’d do next.\n\nThat case study is the part employers remember. Want to start today?`,
      suggestions: {
        items: [
          {
            kind: "set_today",
            title: "Write a one-page brief for a small project",
            why: `A clear brief makes the project finishable — and becomes the start of your case study for ${role}.`,
            horizon: null,
            category: "experience",
            estimated_minutes: 25,
          },
          {
            kind: "add_milestone",
            title: "Finish one project and write a case study",
            why: "A finished project with a write-up is strong evidence of what you can do.",
            horizon: "term",
            category: "experience",
            estimated_minutes: null,
          },
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
      text: `${name}a little preparation makes these conversations much easier.\n\n**Before:** have a 20-second intro — who you are, what you’re interested in${target ? ` (${target})` : ""}, and one thing you’ve done that shows it.\n\n**Good questions to ask:**\n- What does a typical week look like for someone early in this role?\n- What distinguishes the strongest interns or new hires you’ve seen?\n- What do you wish you’d known when you started?\n\n**After:** send a short thank-you within a day that mentions something specific you talked about.\n\nWant me to make “draft your 20-second intro” today’s action?`,
      suggestions: {
        items: [
          {
            kind: "set_today",
            title: "Draft your 20-second introduction",
            why: "A crisp intro makes every networking conversation easier to start.",
            horizon: null,
            category: "networking",
            estimated_minutes: 10,
          },
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
        text: `${name}the best business ideas usually come from problems you see up close, not from brainstorming. Start a **problem journal**: for a week, write down frustrations you notice — yours and other people’s — and how often they happen.\n\nThen look for overlap with what you’re good at. A problem that’s frequent, painful, and close to your skills is worth testing.\n\nWant to make the problem journal today’s action?`,
        suggestions: {
          items: [
            {
              kind: "set_today",
              title: "Write down three frustrations you noticed today",
              why: "Real, frequent problems are where good business ideas come from.",
              horizon: null,
              category: "business",
              estimated_minutes: 10,
            },
          ],
        },
      };
    }
    return {
      text: `${name}for “${idea}”, the next most valuable thing is evidence that people want it before you spend much money.\n\n1. **Talk to five potential customers** about the problem (not your solution).\n2. **Estimate unit costs** — materials, packaging, time, fees — so you know your margin at a few price points.\n3. **Run one cheap test**: pre-orders, a small batch, or a pop-up.\n\nFor anything regulatory — permits, licenses, food rules — rely on your city or county’s official guidance; rules vary a lot by location.`,
      suggestions: {
        items: [
          {
            kind: "add_milestone",
            title: "Have five customer conversations",
            why: "Customer conversations are the cheapest way to validate the idea.",
            horizon: "month",
            category: "business",
            estimated_minutes: null,
          },
        ],
      },
    };
  }

  if (has(msg, "this week", "today", "what should i do", "next step")) {
    return {
      text: `${name}here’s where I’d focus${focus ? `: **${focus.title}**` : ""}.\n\nKeep it small — one meaningful step a day beats a big push once a week. Your 1% action on the home screen is picked to move this forward, and your weekly priorities break it into chunks.\n\nIf something’s making this week harder than usual, tell me and we’ll adjust.`,
      suggestions: null,
    };
  }

  const direction = target
    ? `toward ${target}`
    : "toward a direction you’re excited about";
  return {
    text: `${name}good question. I want to give you advice that fits your situation, so a quick check: what outcome are you hoping for here — a decision, a plan, or just a sounding board?\n\nIn the meantime, the principle I’d apply: favor small actions that build real evidence ${direction} — projects, conversations, and applications — over more research.`,
    suggestions: null,
  };
}
