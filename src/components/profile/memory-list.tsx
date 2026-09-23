"use client";

import { Trash2 } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteMemory } from "@/lib/profile/actions";

export function MemoryList({
  memories,
}: {
  memories: { id: string; content: string }[];
}) {
  const [, startTransition] = useTransition();
  const [items, remove] = useOptimistic(memories, (cur, id: string) =>
    cur.filter((m) => m.id !== id),
  );
  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing yet. As you chat and check in, Mentr keeps short notes here so
        you don’t have to repeat yourself.
      </p>
    );
  }
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {items.map((m) => (
        <li
          key={m.id}
          className="flex items-start justify-between gap-3 px-4 py-3 text-sm"
        >
          <span>{m.content}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Forget this"
            onClick={() =>
              startTransition(async () => {
                remove(m.id);
                const r = await deleteMemory(m.id);
                if (!r.ok) toast.error(r.error);
              })
            }
          >
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  );
}
