"use client";

import { Loader2, Pencil, RefreshCw, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveOnboardingAnswer } from "@/app/onboarding/actions";
import { StepInput } from "@/components/onboarding/inputs";
import { Button } from "@/components/ui/button";
import {
  type Answer,
  type Answers,
  applicableSteps,
  isSkipped,
  STEP_LABELS,
  summarizeAnswer,
} from "@/lib/onboarding/flow";
import { rebuildPlan } from "@/lib/profile/actions";

export function ProfileAnswers({
  initialAnswers,
}: {
  initialAnswers: Answers;
}) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [editing, setEditing] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [pending, startTransition] = useTransition();
  const [rebuilding, startRebuild] = useTransition();
  const steps = useMemo(() => applicableSteps(answers), [answers]);

  const save = (key: string, answer: Answer) =>
    startTransition(async () => {
      const r = await saveOnboardingAnswer(key, answer);
      if (!r.ok) return void toast.error(r.error);
      setAnswers((a) => ({ ...a, [key]: answer }));
      setEditing(null);
      setChanged(true);
      toast.success("Saved");
    });

  return (
    <div>
      {changed ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent p-4 text-accent-foreground">
          <p className="text-sm">
            Your answers changed. Want Mentr to rebuild your roadmap around
            them?
          </p>
          <Button
            size="sm"
            disabled={rebuilding}
            onClick={() =>
              startRebuild(async () => {
                const r = await rebuildPlan();
                if (!r.ok) return void toast.error(r.error);
                setChanged(false);
                toast.success(
                  "Your plan has been rebuilt. Your previous roadmap was archived.",
                );
              })
            }
          >
            {rebuilding ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Rebuild my plan
          </Button>
        </div>
      ) : null}
      <ul className="divide-y border-y">
        {steps.map((step) => {
          const answer = answers[step.key];
          const isEditing = editing === step.key;
          const empty = !answer || isSkipped(answer);
          return (
            <li key={step.key} className="py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {STEP_LABELS[step.key] ?? step.key}
                  </p>
                  <p
                    className={
                      empty
                        ? "text-sm text-muted-foreground italic"
                        : "text-sm font-medium"
                    }
                  >
                    {empty ? "Not answered yet" : summarizeAnswer(step, answer)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={
                    isEditing
                      ? "Cancel"
                      : `Edit ${STEP_LABELS[step.key] ?? step.key}`
                  }
                  onClick={() => setEditing(isEditing ? null : step.key)}
                  disabled={pending}
                >
                  {isEditing ? <X /> : <Pencil />}
                </Button>
              </div>
              {isEditing ? (
                <div className="mt-3 animate-in duration-200 fade-in">
                  <StepInput
                    step={step}
                    initial={answer}
                    pending={pending}
                    onSubmit={(a) => save(step.key, a)}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
