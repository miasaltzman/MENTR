import { CATEGORY_LABELS } from "@/lib/domain/labels";
import type { Progress } from "@/lib/data/dashboard";
import type { Enums } from "@/types/database";

export function ProgressSummary({ progress }: { progress: Progress }) {
  const cats = Object.entries(progress.byCategory)
    .filter(([, n]) => (n ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as [
    Enums<"action_category">,
    number,
  ][];

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-pretty">
          <span className="text-3xl font-semibold tabular-nums">
            {progress.totalCompleted}
          </span>{" "}
          <span className="text-muted-foreground">
            growth {progress.totalCompleted === 1 ? "action" : "actions"}{" "}
            completed
            {progress.milestonesCompleted
              ? ` · ${progress.milestonesCompleted} milestone${progress.milestonesCompleted === 1 ? "" : "s"}`
              : ""}
          </span>
        </p>
        <p
          className="text-sm text-muted-foreground"
          aria-label={`Active ${progress.activeDaysLast7} of the last 7 days`}
        >
          <span
            className="mr-2 inline-flex gap-1 align-middle"
            aria-hidden="true"
          >
            {Array.from({ length: 7 }, (_, i) => (
              <span
                key={i}
                className={
                  i < progress.activeDaysLast7
                    ? "size-2 rounded-full bg-primary"
                    : "size-2 rounded-full bg-muted"
                }
              />
            ))}
          </span>
          {progress.activeDaysLast7} of the last 7 days
        </p>
      </div>
      {cats.length ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {cats.map(([cat, n]) => (
            <li
              key={cat}
              className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
            >
              {CATEGORY_LABELS[cat]} · {n}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Every action you finish shows up here, grouped by what it builds —
          skills, networking, experience and more.
        </p>
      )}
    </div>
  );
}
