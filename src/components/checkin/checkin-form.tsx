"use client";

import { ArrowRight, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitCheckin } from "@/lib/checkin/actions";
import type { CheckinResult } from "@/lib/checkin/service";

const QUESTIONS = [
  {
    key: "progress",
    label: "What did you make progress on this week?",
    placeholder: "Big or small — it all counts.",
  },
  {
    key: "changes",
    label: "Did anything change about what you want?",
    placeholder: "New interests, doubts, decisions…",
  },
  {
    key: "difficulties",
    label: "What felt difficult?",
    placeholder: "Time, motivation, not knowing where to start…",
  },
  {
    key: "nextPriority",
    label: "What’s your biggest priority next week?",
    placeholder: "One thing is plenty.",
  },
] as const;

type Key = (typeof QUESTIONS)[number]["key"];

export function CheckinResultView({ result }: { result: CheckinResult }) {
  const week = new Date(`${result.week}T12:00:00Z`).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", timeZone: "UTC" },
  );
  return (
    <div className="space-y-8">
      <div className="flex gap-3">
        <LogoMark className="mt-0.5 size-8" />
        <p className="text-lg leading-relaxed text-pretty">
          {result.mentorNote}
        </p>
      </div>
      <section>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Priorities for the week of {week}
        </h2>
        <ul className="mt-3 divide-y rounded-2xl border bg-card">
          {result.priorities.map((p) => (
            <li key={p} className="px-4 py-3">
              {p}
            </li>
          ))}
        </ul>
      </section>
      {result.changes.length ? (
        <section>
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Roadmap updates
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {result.changes.map((c) => (
              <li key={c} className="flex gap-2">
                <Check className="mt-0.5 size-4 text-primary" />
                {c}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Button asChild className="rounded-full">
        <Link href="/home">
          Back to home
          <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}

export function CheckinForm() {
  const [values, setValues] = useState<Record<Key, string>>({
    progress: "",
    changes: "",
    difficulties: "",
    nextPriority: "",
  });
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (result) return <CheckinResultView result={result} />;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await submitCheckin(values);
          if (!r.ok) return void toast.error(r.error);
          setResult(r.result);
        });
      }}
    >
      {QUESTIONS.map((q) => (
        <div key={q.key} className="space-y-2">
          <Label htmlFor={q.key} className="text-base">
            {q.label}
          </Label>
          <Textarea
            id={q.key}
            value={values[q.key]}
            onChange={(e) =>
              setValues((v) => ({ ...v, [q.key]: e.target.value }))
            }
            placeholder={q.placeholder}
            maxLength={q.key === "nextPriority" ? 500 : 1500}
            className="min-h-20"
          />
        </div>
      ))}
      <p className="text-sm text-muted-foreground">
        Every question is optional. Answer what’s useful.
      </p>
      <Button
        type="submit"
        size="lg"
        className="rounded-full px-6"
        disabled={pending}
      >
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? "Updating your plan…" : "Finish check-in"}
      </Button>
    </form>
  );
}
