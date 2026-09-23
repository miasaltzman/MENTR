import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Progress as Bar } from "@/components/ui/progress";
import type { RoadmapSummary } from "@/lib/data/dashboard";
import { horizonLabel } from "@/lib/domain/labels";

export function RoadmapSnapshot({
  roadmap,
  isStudent,
}: {
  roadmap: RoadmapSummary;
  isStudent: boolean;
}) {
  const pct = roadmap.total
    ? Math.round((roadmap.completed / roadmap.total) * 100)
    : 0;
  return (
    <Link
      href="/roadmap"
      className="group block rounded-2xl border bg-card p-5 transition-colors hover:border-primary/30"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold">{roadmap.title}</p>
          {roadmap.northStar ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {roadmap.northStar}
            </p>
          ) : null}
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      {roadmap.current ? (
        <div className="mt-4 rounded-xl bg-muted/60 p-3">
          <p className="text-xs text-muted-foreground">
            Current focus · {horizonLabel(roadmap.current.horizon, isStudent)}
          </p>
          <p className="mt-0.5 font-medium">{roadmap.current.title}</p>
        </div>
      ) : null}
      <div className="mt-4 flex items-center gap-3">
        <Bar value={pct} className="h-1.5" aria-label="Roadmap progress" />
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {roadmap.completed}/{roadmap.total} milestones
        </span>
      </div>
    </Link>
  );
}
