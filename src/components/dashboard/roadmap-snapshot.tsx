import { ArrowRight } from "lucide-react";
import Link from "next/link";
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
    <Link href="/roadmap" className="group block">
      {roadmap.current ? (
        <>
          <p className="text-sm text-muted-foreground">
            Next milestone · {horizonLabel(roadmap.current.horizon, isStudent)}
          </p>
          <p className="mt-1 text-xl leading-snug font-semibold tracking-tight">
            {roadmap.current.title}
          </p>
        </>
      ) : (
        <p className="text-xl font-semibold tracking-tight">{roadmap.title}</p>
      )}
      {roadmap.northStar ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Toward: {roadmap.northStar}
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-4">
        <div
          className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
          aria-hidden
        >
          <div
            className="h-1 rounded-full bg-primary transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(pct, 3)}%` }}
          />
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
          View roadmap
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
      <span className="sr-only">
        {roadmap.completed} of {roadmap.total} milestones complete
      </span>
    </Link>
  );
}
