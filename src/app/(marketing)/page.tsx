import Link from "next/link";
import { ArrowRight, Compass, Map, Target } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/brand";

const pillars = [
  {
    icon: Compass,
    title: "Where you are",
    body: "Your education, experience, skills, and what you’re still figuring out. “Not sure yet” is a real answer here.",
  },
  {
    icon: Map,
    title: "Where you’re going",
    body: "A living roadmap from the next five years down to this week — rebuilt as your goals and experience change.",
  },
  {
    icon: Target,
    title: "What to do today",
    body: "One small, meaningful action a day. Usually 5–30 minutes, always tied to something you care about.",
  },
];

const principles = [
  "Recommendations always come with a reason.",
  "Opportunities and news come from real, cited sources — never invented.",
  "Progress over streaks. Missing a day doesn’t erase anything.",
  "Private by default. Your plan is yours.",
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/login?intent=signup">Get started</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pt-16 pb-20 sm:px-8 sm:pt-24">
          <p className="text-sm font-medium text-primary">{brand.tagline}</p>
          <h1 className="mt-4 max-w-3xl text-4xl leading-[1.05] font-semibold sm:text-6xl">
            Know exactly what to do{" "}
            <span className="font-display font-normal italic">next.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
            {brand.name} is a personal mentor that learns your goals, builds a
            path toward them, and hands you one concrete step every day. Get 1%
            better — and actually know why it matters.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="rounded-full px-6">
              <Link href="/login?intent=signup">
                Start with a 5-minute conversation
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>

        <section className="border-y bg-card/60">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-3">
            {pillars.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">{title}</h2>
                <p className="mt-2 text-pretty text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-3xl font-semibold">
              Built to make you feel less lost.
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground">
              Most people don’t fall behind for lack of effort. They fall behind
              because nobody told them which clubs matter, which skills to
              build, or what the next step even is. {brand.name} closes that
              gap.
            </p>
            <ul className="mt-6 space-y-3">
              {principles.map((p) => (
                <li key={p} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <figure
            aria-label="Example of a daily 1% action"
            className="rounded-2xl border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium tracking-wide text-primary uppercase">
                Your 1% today
              </span>
              <span>~15 min · Experience</span>
            </div>
            <p className="mt-3 text-xl font-semibold">
              Write a one-page teardown of an AI feature you use every week.
            </p>
            <div className="mt-4 rounded-xl bg-muted p-4 text-sm">
              <p className="font-medium">Why this matters</p>
              <p className="mt-1 text-muted-foreground">
                You want to move into AI product management. A short teardown is
                evidence you can connect technical capability to user needs —
                and it becomes your first portfolio piece.
              </p>
            </div>
            <figcaption className="mt-4 text-xs text-muted-foreground">
              Example only. Your actions are generated from your own goals.
            </figcaption>
          </figure>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Logo className="text-foreground" />
          <p>
            © {new Date().getFullYear()} {brand.name}. {brand.tagline}
          </p>
        </div>
      </footer>
    </div>
  );
}
