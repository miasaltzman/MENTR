"use client";

import {
  Check,
  ChevronDown,
  Circle,
  CircleDot,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  SkipForward,
  Trash2,
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
import { deleteMilestone, setMilestoneStatus } from "@/lib/roadmap/actions";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Milestone = Pick<
  Tables<"roadmap_milestones">,
  "id" | "title" | "description" | "why" | "status" | "origin"
>;

const NEXT_STATUS: Record<string, string> = {
  not_started: "in_progress",
  in_progress: "completed",
  completed: "not_started",
  skipped: "not_started",
};

export function MilestoneItem({ milestone }: { milestone: Milestone }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const m = milestone;
  const done = m.status === "completed";
  const skipped = m.status === "skipped";

  const update = (status: string) =>
    startTransition(async () => {
      const r = await setMilestoneStatus(m.id, status);
      if (!r.ok) toast.error(r.error);
      else if (status === "completed")
        toast.success("Milestone complete. Your roadmap has been updated.");
    });

  const StatusIcon = done
    ? Check
    : m.status === "in_progress"
      ? CircleDot
      : Circle;
  const statusLabel = done
    ? "Done"
    : m.status === "in_progress"
      ? "In progress"
      : skipped
        ? "Set aside"
        : "Not started";

  return (
    <li
      className={cn(
        "rounded-xl border bg-card p-4",
        (done || skipped) && "bg-card/60",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => update(NEXT_STATUS[m.status])}
          disabled={pending}
          aria-label={`Status: ${statusLabel}. Change status`}
          title={statusLabel}
          className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
            done && "border-primary bg-primary text-primary-foreground",
            m.status === "in_progress" && "border-primary text-primary",
          )}
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <StatusIcon
              className={cn(
                "size-3.5",
                !done && m.status !== "in_progress" && "opacity-0",
              )}
            />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-start justify-between gap-2 text-left"
          >
            <span
              className={cn(
                "font-medium",
                (done || skipped) && "text-muted-foreground",
                done && "line-through decoration-primary/40",
              )}
            >
              {m.title}
            </span>
            <ChevronDown
              className={cn(
                "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
          {m.status === "in_progress" ? (
            <span className="mt-1 inline-block rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
              In progress
            </span>
          ) : null}
          {open ? (
            <div className="mt-2 animate-in space-y-2 text-sm duration-200 fade-in">
              {m.description ? (
                <p className="text-muted-foreground">{m.description}</p>
              ) : null}
              {m.why ? (
                <p>
                  <span className="font-medium">Why it matters: </span>
                  <span className="text-muted-foreground">{m.why}</span>
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!done ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => update("completed")}
                  >
                    <Check />
                    Mark done
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" asChild>
                  <Link
                    href={`/mentor?q=${encodeURIComponent(`Help me make progress on this milestone: “${m.title}”. What are the next concrete steps?`)}`}
                  >
                    <MessageCircle />
                    Ask Mentr
                  </Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="More milestone options"
                      className="ml-auto"
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => update("in_progress")}
                      disabled={m.status === "in_progress"}
                    >
                      <CircleDot />
                      Mark in progress
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => update("not_started")}
                      disabled={m.status === "not_started"}
                    >
                      <Circle />
                      Mark not started
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => update("skipped")}
                      disabled={skipped}
                    >
                      <SkipForward />
                      Set aside
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() =>
                        startTransition(async () => {
                          const r = await deleteMilestone(m.id);
                          if (!r.ok) toast.error(r.error);
                        })
                      }
                    >
                      <Trash2 />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
