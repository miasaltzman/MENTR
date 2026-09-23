"use client";

import {
  ArrowDownToLine,
  ArrowUpToLine,
  Check,
  ChevronDown,
  Clock,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  RefreshCw,
  SkipForward,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABELS } from "@/lib/domain/labels";
import {
  type ActionResult,
  completeDailyAction,
  replaceDailyAction,
  saveActionReflection,
  skipDailyAction,
  undoDailyAction,
} from "@/lib/plan/actions";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Props = {
  action: Tables<"daily_actions">;
  milestoneTitle: string | null;
  totalCompleted: number;
};

export function TodayActionCard({
  action,
  milestoneTitle,
  totalCompleted,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [reflection, setReflection] = useState("");
  const [reflectionSaved, setReflectionSaved] = useState(false);

  const run = (
    label: string,
    fn: () => Promise<ActionResult>,
    success?: string,
  ) => {
    setBusy(label);
    startTransition(async () => {
      const result = await fn();
      setBusy(null);
      if (!result.ok) toast.error(result.error);
      else if (success) toast.success(success);
    });
  };

  const done = action.status === "completed";
  const skipped = action.status === "skipped";
  const askHref = `/mentor?q=${encodeURIComponent(`Why is “${action.title}” a good next step for me, and how should I approach it?`)}`;

  return (
    <article
      aria-labelledby="today-title"
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm sm:p-6",
        done && "border-primary/30",
      )}
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold tracking-wide text-primary uppercase">
          Your 1% today
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-3.5" />~{action.estimated_minutes} min ·{" "}
          {CATEGORY_LABELS[action.category]}
        </span>
      </div>

      <h2
        id="today-title"
        className={cn(
          "mt-3 text-xl leading-snug font-semibold text-balance sm:text-2xl",
          done && "text-muted-foreground line-through decoration-primary/40",
        )}
      >
        {action.title}
      </h2>
      {action.description && !done ? (
        <p className="mt-2 text-pretty text-muted-foreground">
          {action.description}
        </p>
      ) : null}

      {done ? (
        <div className="mt-5 space-y-4">
          <p className="flex items-center gap-2 font-medium">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-3.5" />
            </span>
            Done. That’s {totalCompleted} growth{" "}
            {totalCompleted === 1 ? "action" : "actions"} so far.
          </p>
          {!reflectionSaved ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!reflection.trim()) return;
                run(
                  "reflect",
                  () => saveActionReflection(action.id, reflection),
                  "Saved your note",
                );
                setReflectionSaved(true);
              }}
            >
              <label
                htmlFor="reflection"
                className="text-sm text-muted-foreground"
              >
                Anything you learned or want to remember? (optional)
              </label>
              <Textarea
                id="reflection"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                maxLength={1000}
                className="min-h-16"
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  disabled={!reflection.trim() || pending}
                >
                  Save note
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  disabled={pending}
                  onClick={() => run("undo", () => undoDailyAction(action.id))}
                >
                  <Undo2 />
                  Undo
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : skipped ? (
        <div className="mt-5 space-y-3">
          <p className="text-muted-foreground">
            Skipped for today. No problem — tomorrow brings a new one.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              run("different", () => replaceDailyAction(action.id, "different"))
            }
          >
            {busy === "different" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            Actually, give me a different one
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button
              size="lg"
              className="rounded-full px-5"
              disabled={pending}
              onClick={() =>
                run("complete", () => completeDailyAction(action.id))
              }
            >
              {busy === "complete" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Check />
              )}
              Mark done
            </Button>
            <Button
              variant="ghost"
              className="rounded-full"
              aria-expanded={showWhy}
              onClick={() => setShowWhy((v) => !v)}
            >
              Why this?
              <ChevronDown
                className={cn("transition-transform", showWhy && "rotate-180")}
              />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto rounded-full"
                  aria-label="More options"
                  disabled={pending}
                >
                  {busy && busy !== "complete" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <MoreHorizontal />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onSelect={() =>
                    run("different", () =>
                      replaceDailyAction(action.id, "different"),
                    )
                  }
                >
                  <RefreshCw />
                  Something different
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={action.difficulty === "lighter"}
                  onSelect={() =>
                    run("lighter", () =>
                      replaceDailyAction(action.id, "lighter"),
                    )
                  }
                >
                  <ArrowDownToLine />
                  Make it easier
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={action.difficulty === "stretch"}
                  onSelect={() =>
                    run("stretch", () =>
                      replaceDailyAction(action.id, "stretch"),
                    )
                  }
                >
                  <ArrowUpToLine />
                  Make it harder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={askHref}>
                    <MessageCircle />
                    Ask Mentr about this
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => run("skip", () => skipDailyAction(action.id))}
                >
                  <SkipForward />
                  Skip today
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {showWhy ? (
            <div className="mt-4 animate-in rounded-xl bg-muted p-4 text-sm duration-200 fade-in">
              <p className="font-medium">Why this matters</p>
              <p className="mt-1 text-pretty text-muted-foreground">
                {action.why}
              </p>
              {milestoneTitle ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Moves forward:{" "}
                  <span className="font-medium text-foreground">
                    {milestoneTitle}
                  </span>
                </p>
              ) : null}
              <Link
                href={askHref}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary"
              >
                <MessageCircle className="size-3.5" />
                Ask Mentr more
              </Link>
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}

export function TodayActionSkeleton() {
  return (
    <div
      className="rounded-2xl border bg-card p-6"
      aria-busy="true"
      aria-label="Preparing today’s action"
    >
      <div className="h-3 w-28 animate-pulse rounded bg-muted" />
      <div className="mt-4 h-6 w-4/5 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-3/5 animate-pulse rounded bg-muted" />
      <div className="mt-6 h-10 w-32 animate-pulse rounded-full bg-muted" />
    </div>
  );
}
