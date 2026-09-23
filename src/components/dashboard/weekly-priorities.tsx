"use client";

import { Check } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setPriorityStatus } from "@/lib/plan/actions";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Priority = Pick<
  Tables<"weekly_priorities">,
  "id" | "title" | "why" | "status"
>;

export function WeeklyPriorities({ priorities }: { priorities: Priority[] }) {
  const [, startTransition] = useTransition();
  const [items, setOptimistic] = useOptimistic(
    priorities,
    (cur, u: { id: string; done: boolean }) =>
      cur.map((p) =>
        p.id === u.id ? { ...p, status: u.done ? "done" : "open" } : p,
      ),
  );

  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No priorities yet this week.
      </p>
    );
  }

  const done = items.filter((p) => p.status === "done").length;
  return (
    <div>
      <ul className="divide-y rounded-2xl border bg-card">
        {items.map((p) => {
          const checked = p.status === "done";
          return (
            <li key={p.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() =>
                  startTransition(async () => {
                    setOptimistic({ id: p.id, done: !checked });
                    const r = await setPriorityStatus(p.id, !checked);
                    if (!r.ok) toast.error(r.error);
                  })
                }
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border",
                    checked &&
                      "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {checked ? <Check className="size-3.5" /> : null}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block font-medium",
                      checked && "text-muted-foreground line-through",
                    )}
                  >
                    {p.title}
                  </span>
                  {p.why && !checked ? (
                    <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">
                      {p.why}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        {done} of {items.length} done this week
      </p>
    </div>
  );
}
