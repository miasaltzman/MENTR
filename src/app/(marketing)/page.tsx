import {
  ArrowDown,
  ArrowRight,
  Check,
  Compass,
  Home,
  Map,
  MessageCircle,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { Logo, LogoMark } from "@/components/brand/logo";
import { OnboardingPreview } from "@/components/marketing/onboarding-preview";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/brand";

const container = "mx-auto w-full max-w-6xl px-6 sm:px-10";

/** A believable Mentr home screen, drawn in the same type and colors as the app. */
function HomeScreenPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of the Mentr home screen: today’s step, this week’s priorities, and the next milestone."
      className="mx-auto w-full max-w-[22rem] rounded-[2.75rem] bg-foreground p-2.5 shadow-[0_50px_100px_-50px_oklch(0.2_0.01_70/0.55)]"
    >
      <div className="overflow-hidden rounded-[2.25rem] bg-background">
        <div className="flex items-center justify-between px-7 pt-4 pb-2 text-[11px] font-semibold">
          <span>9:41</span>
          <span className="h-4 w-20 rounded-full bg-foreground" aria-hidden />
          <span className="tracking-widest">•••</span>
        </div>
        <div className="px-6 pt-6 pb-4">
          <p className="text-display text-[2.1rem]">Good morning, Mia.</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Focused on AI Product Management
          </p>

          <div className="mt-7 rounded-3xl bg-card p-5 shadow-[0_1px_2px_oklch(0.2_0.01_70/0.06),0_8px_24px_-12px_oklch(0.2_0.01_70/0.12)]">
            <p className="text-xs font-medium text-primary">
              Your 1% today · 3 min
            </p>
            <p className="mt-2 text-lg leading-snug font-semibold">
              Follow one AI Product Manager on LinkedIn
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 font-medium text-primary-foreground">
                <Check className="size-3.5" /> Done
              </span>
              <span className="px-2 py-1.5 text-muted-foreground">
                Give me another
              </span>
            </div>
          </div>

          <p className="mt-8 text-sm font-semibold">This week</p>
          <ul className="mt-2 divide-y text-sm">
            {[
              ["Find 2 internships worth saving", true],
              ["Update your LinkedIn headline", false],
              ["Learn what AI PMs actually do", false],
            ].map(([t, done]) => (
              <li key={t as string} className="flex items-center gap-3 py-2.5">
                <span
                  className={
                    done
                      ? "flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      : "size-4 rounded-full border border-foreground/25"
                  }
                >
                  {done ? <Check className="size-2.5" /> : null}
                </span>
                <span
                  className={done ? "text-muted-foreground line-through" : ""}
                >
                  {t}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-sm font-semibold">Next milestone</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Build proof of product thinking
          </p>
          <div className="mt-2.5 h-1 rounded-full bg-muted">
            <div className="h-1 w-1/3 rounded-full bg-primary" />
          </div>
        </div>
        <div
          className="grid grid-cols-5 border-t px-2 pt-2.5 pb-5 text-muted-foreground"
          aria-hidden
        >
          {[Home, Map, Compass, MessageCircle, UserRound].map((Icon, i) => (
            <Icon
              key={i}
              className={
                i === 0 ? "mx-auto size-5 text-primary" : "mx-auto size-5"
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const SMALL_STEPS = [
  { minutes: 3, text: "Follow one person working in your target role." },
  { minutes: 5, text: "Save one internship you would genuinely apply to." },
  {
    minutes: 8,
    text: "Learn one concept that keeps showing up in your field.",
  },
];

const PATHS = [
  {
    who: "AI student",
    steps: [
      "Find internships",
      "Build relevant skills",
      "Meet people in the field",
    ],
  },
  {
    who: "Marketing student",
    steps: ["Explore roles", "Build experience", "Stay current"],
  },
  {
    who: "Aspiring founder",
    steps: [
      "Validate an idea",
      "Understand the numbers",
      "Launch something real",
    ],
  },
  {
    who: "Career changer",
    steps: ["Map transferable skills", "Learn what matters", "Make the move"],
  },
];

const WORLD = [
  {
    kind: "Internship",
    title: "AI Product Internship",
    meta: "Open until Oct 12",
    why: "Matched because you’re interested in AI product roles.",
  },
  {
    kind: "News",
    title: "A major AI product launch",
    meta: "2 hours ago",
    why: "Why it matters to you →",
  },
  {
    kind: "On campus",
    title: "AI Club meeting",
    meta: "Wednesday",
    why: "Relevant to your major and career interests.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className={`${container} flex items-center justify-between py-6`}>
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full px-4">
            <Link href="/login?intent=signup">Get started</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        {/* 1. Hero */}
        <section className={`${container} pt-16 pb-28 sm:pt-28 sm:pb-40`}>
          <p className="text-sm text-muted-foreground sm:text-base">
            {brand.tagline}
          </p>
          <h1 className="text-display mt-6 text-[3.6rem] sm:text-8xl lg:text-[8.75rem]">
            Know exactly
            <br />
            what to do <em className="text-primary">next.</em>
          </h1>
          <p className="mt-8 max-w-md text-lg text-pretty text-muted-foreground sm:text-xl">
            Mentr learns where you are and where you want to go — then gives you
            one useful next step at a time.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full px-7 text-base"
            >
              <Link href="/login?intent=signup">
                Get started
                <ArrowRight />
              </Link>
            </Button>
            <a
              href="#how"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              See how it works
              <ArrowDown className="size-4" />
            </a>
          </div>
        </section>

        {/* 2. Product experience */}
        <section id="how" className="scroll-mt-8 bg-muted/50 py-24 sm:py-32">
          <div
            className={`${container} grid items-center gap-16 lg:grid-cols-[1fr_auto] lg:gap-24`}
          >
            <div className="max-w-md">
              <h2 className="text-display text-5xl sm:text-6xl">
                Your path, built around you.
              </h2>
              <p className="mt-6 text-lg text-pretty text-muted-foreground">
                Open Mentr and you’ll see what matters today, what matters this
                week, and where it’s all heading. Nothing more.
              </p>
            </div>
            <HomeScreenPreview />
          </div>
        </section>

        {/* 3. Uncertainty */}
        <section className="py-24 sm:py-36">
          <div className={`${container} grid gap-14 lg:grid-cols-2 lg:gap-24`}>
            <div className="max-w-md">
              <h2 className="text-display text-5xl sm:text-6xl">
                You don’t need to have it all figured out.
              </h2>
              <p className="mt-6 text-lg text-pretty text-muted-foreground">
                Tell Mentr what you know so far — your major, your job, or just
                what you’re curious about. It helps you figure out the rest as
                you go.
              </p>
            </div>
            <div className="lg:pt-4">
              <OnboardingPreview />
            </div>
          </div>
        </section>

        {/* 4. The 1% system */}
        <section className="border-t py-24 sm:py-36">
          <div className={container}>
            <div className="max-w-xl">
              <h2 className="text-display text-5xl sm:text-6xl">
                Progress should feel small.
              </h2>
              <p className="mt-6 text-lg text-muted-foreground">
                Mentr turns big goals into tiny steps you can actually do today.
              </p>
            </div>
            <ul className="mt-14 sm:mt-20">
              {SMALL_STEPS.map((s) => (
                <li
                  key={s.minutes}
                  className="grid grid-cols-[4.5rem_1fr] items-baseline gap-4 border-t py-7 sm:grid-cols-[10rem_1fr] sm:py-9"
                >
                  <span className="text-display text-4xl sm:text-6xl">
                    {s.minutes}
                    <span className="ml-1 text-base text-muted-foreground sm:text-xl">
                      min
                    </span>
                  </span>
                  <span className="text-xl leading-snug text-pretty sm:text-3xl">
                    {s.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 5. Different paths */}
        <section className="bg-foreground py-24 text-background sm:py-36">
          <div className={container}>
            <h2 className="text-display max-w-2xl text-5xl sm:text-6xl">
              Built for wherever you’re headed.
            </h2>
            <ul className="mt-14 sm:mt-20">
              {PATHS.map((p) => (
                <li
                  key={p.who}
                  className="flex flex-col gap-3 border-t border-background/15 py-7 sm:flex-row sm:items-baseline sm:gap-10 sm:py-9"
                >
                  <span className="text-display text-3xl sm:w-72 sm:shrink-0 sm:text-4xl">
                    {p.who}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-background/70 sm:text-lg">
                    {p.steps.map((step, i) => (
                      <span
                        key={step}
                        className="inline-flex items-center gap-3"
                      >
                        {i > 0 ? (
                          <ArrowRight
                            className="size-4 text-background/40"
                            aria-hidden
                          />
                        ) : null}
                        {step}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 6. Live information */}
        <section className="py-24 sm:py-36">
          <div className={`${container} grid gap-14 lg:grid-cols-2 lg:gap-24`}>
            <div className="max-w-md">
              <h2 className="text-display text-5xl sm:text-6xl">
                Your world changes. Mentr keeps up.
              </h2>
              <p className="mt-6 text-lg text-pretty text-muted-foreground">
                Internships, news, and campus events — from real sources, with a
                line on why each one matters to you.
              </p>
            </div>
            <div>
              <ul className="divide-y border-y">
                {WORLD.map((w) => (
                  <li key={w.title} className="py-6">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {w.kind} · {w.meta}
                    </p>
                    <p className="mt-1.5 text-xl font-medium">{w.title}</p>
                    <p className="mt-1 text-muted-foreground">{w.why}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                Examples. Live opportunities and news are coming soon — always
                with the source and date.
              </p>
            </div>
          </div>
        </section>

        {/* 7. Final CTA */}
        <section className="border-t py-28 sm:py-40">
          <div className={`${container} text-center`}>
            <LogoMark className="mx-auto size-10" />
            <h2 className="text-display mx-auto mt-8 max-w-3xl text-5xl text-balance sm:text-7xl">
              You don’t need the whole plan. You just need the next step.
            </h2>
            <Button
              asChild
              size="lg"
              className="mt-12 h-12 rounded-full px-8 text-base"
            >
              <Link href="/login?intent=signup">
                Start with {brand.name}
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer
        className={`${container} flex flex-col gap-3 border-t py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between`}
      >
        <Logo className="text-foreground" />
        <p>
          © {new Date().getFullYear()} {brand.name}
        </p>
      </footer>
    </div>
  );
}
