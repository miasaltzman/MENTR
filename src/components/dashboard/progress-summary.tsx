import type { Progress } from "@/lib/data/dashboard";
import { CATEGORY_LABELS } from "@/lib/domain/labels";
import type { Enums } from "@/types/database";

export function ProgressSummary({ progress }: { progress: Progress }) {
  const cats = Object.entries(progress.byCategory)
    .filter(([, n]) => (n ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as [
    Enums<"action_category">,
    number,
  ][];

  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-display text-5xl tabular-nums">
          {progress.totalCompleted}
        </span>
        <span className="text-muted-foreground">
          {progress.totalCompleted === 1 ? "step" : "steps"} taken
          {progress.milestonesCompleted
            ? ` · ${progress.milestonesCompleted} milestone${progress.milestonesCompleted === 1 ? "" : "s"}`
            : ""}
        </span>
      </p>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="inline-flex gap-1" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <span
              key={i}
              className={
                i < progress.activeDaysLast7
                  ? "size-1.5 rounded-full bg-primary"
                  : "size-1.5 rounded-full bg-border"
              }
            />
          ))}
        </span>
        Active {progress.activeDaysLast7} of the last 7 days
      </p>
      {cats.length ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {cats.map(([cat, n]) => `${CATEGORY_LABELS[cat]} ${n}`).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
