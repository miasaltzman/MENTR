"use client";

import { ArrowLeft, Loader2, Pencil, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  completeOnboarding,
  saveOnboardingAnswer,
} from "@/app/onboarding/actions";
import { LogoMark } from "@/components/brand/logo";
import { StepInput } from "@/components/onboarding/inputs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  type Answer,
  type Answers,
  applicableSteps,
  renderPrompt,
  summarizeAnswer,
} from "@/lib/onboarding/flow";

type Cursor =
  { type: "step"; key: string } | { type: "checkpoint" } | { type: "finish" };

function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export function initialCursor(answers: Answers): Cursor {
  const steps = applicableSteps(answers);
  const firstOpen = steps.find((s) => !(s.key in answers));
  // Everything answered but not yet finished: offer to build the plan.
  if (!firstOpen) return { type: "checkpoint" };
  // Core is done: offer to build the plan (or keep going with optional questions).
  if (firstOpen.tier === "deepen") return { type: "checkpoint" };
  return { type: "step", key: firstOpen.key };
}

function MentorBubble({
  children,
  helper,
}: {
  children: React.ReactNode;
  helper?: string;
}) {
  return (
    <div className="flex gap-3">
      <LogoMark className="mt-0.5 size-8" />
      <div className="min-w-0 flex-1">
        <p className="text-display text-[2rem] text-balance sm:text-[2.5rem]">
          {children}
        </p>
        {helper ? (
          <p className="mt-2 text-pretty text-muted-foreground">{helper}</p>
        ) : null}
      </div>
    </div>
  );
}

export function OnboardingFlow({
  initialAnswers,
  suggestedName,
}: {
  initialAnswers: Answers;
  suggestedName?: string | null;
}) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [cursor, setCursor] = useState<Cursor>(() =>
    initialCursor(initialAnswers),
  );
  const [pending, startTransition] = useTransition();
  const [finishing, setFinishing] = useState(false);
  const [showAllAnswers, setShowAllAnswers] = useState(false);
  const currentRef = useRef<HTMLDivElement>(null);

  const steps = useMemo(() => applicableSteps(answers), [answers]);
  const coreSteps = steps.filter((s) => s.tier === "core");
  const index =
    cursor.type === "step" ? steps.findIndex((s) => s.key === cursor.key) : -1;
  const step = index >= 0 ? steps[index] : null;

  const answeredBefore = steps.filter(
    (s, i) => s.key in answers && (cursor.type !== "step" ? true : i < index),
  );

  const hiddenCount = showAllAnswers
    ? 0
    : Math.max(0, answeredBefore.length - 3);
  const visibleAnswers = answeredBefore.slice(hiddenCount);

  const progress =
    cursor.type === "finish"
      ? 100
      : cursor.type === "checkpoint"
        ? 100
        : step?.tier === "core"
          ? Math.round(
              (coreSteps.findIndex((s) => s.key === step.key) /
                coreSteps.length) *
                100,
            )
          : 100;

  useEffect(() => {
    currentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [cursor]);

  function advanceFrom(key: string, next: Answers) {
    const nextSteps = applicableSteps(next);
    const i = nextSteps.findIndex((s) => s.key === key);
    const current = nextSteps[i];
    const following = nextSteps[i + 1];
    if (!following) return finish();
    if (current?.tier === "core" && following.tier === "deepen") {
      const startedDeepen = nextSteps.some(
        (s) => s.tier === "deepen" && s.key in next,
      );
      return setCursor(
        startedDeepen
          ? { type: "step", key: following.key }
          : { type: "checkpoint" },
      );
    }
    setCursor({ type: "step", key: following.key });
  }

  function submit(answer: Answer) {
    if (!step) return;
    const key = step.key;
    startTransition(async () => {
      const result = await saveOnboardingAnswer(key, answer, browserTimezone());
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const next = { ...answers, [key]: answer };
      setAnswers(next);
      advanceFrom(key, next);
    });
  }

  function finish() {
    setCursor({ type: "finish" });
    setFinishing(true);
    startTransition(async () => {
      const result = await completeOnboarding();
      // On success the action redirects; we only get here on failure.
      if (result && !result.ok) {
        setFinishing(false);
        toast.error(result.error);
        const firstMissing = applicableSteps(answers, "core").find(
          (s) => !s.optional && !(s.key in answers),
        );
        if (firstMissing) setCursor({ type: "step", key: firstMissing.key });
      }
    });
  }

  const goBack = () => {
    const i =
      cursor.type === "step"
        ? index
        : steps.findIndex((s) => !(s.key in answers));
    const prev = steps[(i === -1 ? steps.length : i) - 1] ?? steps[0];
    if (prev) setCursor({ type: "step", key: prev.key });
  };

  const firstName =
    answers.name && "value" in answers.name
      ? String(answers.name.value).split(" ")[0]
      : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-24 sm:px-8">
      <div className="sticky top-0 z-10 -mx-5 bg-background/90 px-5 pt-4 pb-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={goBack}
            disabled={
              pending || finishing || (cursor.type === "step" && index <= 0)
            }
            aria-label="Previous question"
          >
            <ArrowLeft />
          </Button>
          <Progress
            value={progress}
            className="h-1.5 flex-1"
            aria-label="Onboarding progress"
          />
        </div>
      </div>

      {answeredBefore.length ? (
        <ol className="mt-6 space-y-3" aria-label="Your answers so far">
          {hiddenCount > 0 ? (
            <li>
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0 text-muted-foreground"
                onClick={() => setShowAllAnswers(true)}
              >
                Show {hiddenCount} earlier{" "}
                {hiddenCount === 1 ? "answer" : "answers"}
              </Button>
            </li>
          ) : null}
          {visibleAnswers.map((s) => (
            <li
              key={s.key}
              className="group flex items-start justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate text-muted-foreground">
                  {renderPrompt(s.prompt, answers)}
                </p>
                <p className="mt-0.5 line-clamp-2 font-medium">
                  {summarizeAnswer(s, answers[s.key])}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100"
                onClick={() => setCursor({ type: "step", key: s.key })}
                disabled={pending || finishing}
                aria-label={`Edit: ${renderPrompt(s.prompt, answers)}`}
              >
                <Pencil />
              </Button>
            </li>
          ))}
        </ol>
      ) : null}

      <div ref={currentRef} className="scroll-mt-20 pt-8">
        {step ? (
          <div
            key={step.key}
            className="animate-in space-y-6 duration-300 fade-in slide-in-from-bottom-2"
          >
            <MentorBubble helper={step.helper}>
              {renderPrompt(step.prompt, answers)}
            </MentorBubble>
            <div className="sm:pl-11">
              <StepInput
                step={step}
                initial={
                  answers[step.key] ??
                  (step.key === "name" && suggestedName
                    ? { value: suggestedName }
                    : undefined)
                }
                pending={pending}
                onSubmit={submit}
              />
              {step.optional ? (
                <Button
                  variant="link"
                  className="mt-3 px-0 text-muted-foreground"
                  disabled={pending}
                  onClick={() => submit({ skipped: true })}
                >
                  Skip for now
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {cursor.type === "checkpoint" && !finishing ? (
          <div className="animate-in space-y-6 duration-300 fade-in slide-in-from-bottom-2">
            <MentorBubble helper="A few more quick questions would sharpen my suggestions. Totally optional.">
              {firstName ? `Thanks, ${firstName}. ` : "Thanks. "}That’s enough
              for me to build your first plan.
            </MentorBubble>
            <div className="flex flex-wrap gap-3 sm:pl-11">
              <Button
                size="lg"
                className="rounded-full px-6"
                onClick={finish}
                disabled={pending}
              >
                <Sparkles />
                Build my plan
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-6"
                disabled={pending}
                onClick={() => {
                  const firstDeepen = steps.find(
                    (s) => s.tier === "deepen" && !(s.key in answers),
                  );
                  if (firstDeepen)
                    setCursor({ type: "step", key: firstDeepen.key });
                  else finish();
                }}
              >
                Keep going
              </Button>
            </div>
          </div>
        ) : null}

        {cursor.type === "finish" || finishing ? (
          <div
            className="animate-in space-y-4 duration-300 fade-in"
            role="status"
            aria-live="polite"
          >
            <MentorBubble helper="Finding your first step.">
              Building your plan…
            </MentorBubble>
            <div className="flex items-center gap-2 text-sm text-muted-foreground sm:pl-11">
              <Loader2 className="size-4 animate-spin" />
              Working on it
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
