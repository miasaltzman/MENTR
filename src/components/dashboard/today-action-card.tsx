"use client";

import {
  ArrowDownToLine,
  ArrowUpToLine,
  Check,
  ChevronDown,
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

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

export function TodayActionCard({
  action,
  milestoneTitle,
  totalCompleted,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

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
  const askHref = `/mentor?q=${encodeURIComponent(`How should I approach this: “${action.title}”?`)}`;

  return (
    <article
      aria-labelledby="today-title"
      className="rounded-[1.75rem] bg-card p-6 shadow-[0_1px_2px_oklch(0.2_0.01_70/0.05),0_12px_32px_-16px_oklch(0.2_0.01_70/0.14)] sm:p-8"
    >
      <p className="text-sm font-medium text-primary">Your 1% today</p>
      <h2
        id="today-title"
        className={cn(
          "mt-3 text-[1.625rem] leading-[1.2] font-semibold tracking-tight text-balance sm:text-[1.875rem]",
          done && "text-muted-foreground",
        )}
      >
        {action.title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        ~{action.estimated_minutes} min · {CATEGORY_LABELS[action.category]}
      </p>

      {done ? (
        <div className="mt-6 animate-in duration-300 fade-in">
          <p className="flex items-center gap-2.5 font-medium">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-3.5" />
            </span>
            Done — that’s your {ordinal(totalCompleted)} step.
          </p>
          <div className="mt-3 flex items-center gap-4 pl-8.5 text-sm">
            {!noteOpen ? (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setNoteOpen(true)}
              >
                Add a note
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              disabled={pending}
              onClick={() => run("undo", () => undoDailyAction(action.id))}
            >
              <Undo2 className="size-3.5" />
              Undo
            </button>
          </div>
          {noteOpen ? (
            <form
              className="mt-3 space-y-2 pl-8.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                run(
                  "note",
                  () => saveActionReflection(action.id, note),
                  "Saved",
                );
                setNoteOpen(false);
              }}
            >
              <Textarea
                autoFocus
                aria-label="Note"
                placeholder="Anything worth remembering?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                className="min-h-16"
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={!note.trim() || pending}
              >
                Save
              </Button>
            </form>
          ) : null}
        </div>
      ) : skipped ? (
        <div className="mt-6 space-y-3">
          <p className="text-muted-foreground">
            Skipped for today. No problem.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full"
            disabled={pending}
            onClick={() =>
              run("another", () => replaceDailyAction(action.id, "different"))
            }
          >
            {busy === "another" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            Give me another
          </Button>
        </div>
      ) : (
        <>
          {action.description ? (
            <p className="mt-4 text-pretty text-muted-foreground">
              {action.description}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button
              size="lg"
              className="h-11 rounded-full px-6"
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
              Done
            </Button>
            <Button
              variant="ghost"
              className="h-11 rounded-full"
              disabled={pending}
              onClick={() =>
                run("another", () => replaceDailyAction(action.id, "different"))
              }
            >
              {busy === "another" ? <Loader2 className="animate-spin" /> : null}
              Give me another
            </Button>
            <Button
              variant="ghost"
              className="h-11 rounded-full text-muted-foreground"
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
                  className="ml-auto size-11 rounded-full text-muted-foreground"
                  aria-label="More options"
                  disabled={pending}
                >
                  {busy === "lighter" ||
                  busy === "stretch" ||
                  busy === "skip" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <MoreHorizontal />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
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
                  Make it bigger
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={askHref}>
                    <MessageCircle />
                    Ask Mentr about it
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
            <div className="mt-5 animate-in border-l-2 border-primary/30 pl-4 duration-200 fade-in">
              <p className="text-pretty">{action.why}</p>
              {milestoneTitle ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Moves you toward: {milestoneTitle}
                </p>
              ) : null}
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
      className="rounded-[1.75rem] bg-card p-6 sm:p-8"
      aria-busy="true"
      aria-label="Finding your next step"
    >
      <div className="h-3.5 w-24 animate-pulse rounded-full bg-muted" />
      <div className="mt-4 h-7 w-4/5 animate-pulse rounded-full bg-muted" />
      <div className="mt-3 h-3.5 w-32 animate-pulse rounded-full bg-muted" />
      <div className="mt-7 h-11 w-28 animate-pulse rounded-full bg-muted" />
    </div>
  );
}
