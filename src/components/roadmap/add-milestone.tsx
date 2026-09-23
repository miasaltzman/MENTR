"use client";

import { Loader2, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addMilestone } from "@/lib/roadmap/actions";
import type { Enums } from "@/types/database";

export function AddMilestone({
  horizon,
  label,
}: {
  horizon: Exclude<Enums<"horizon">, "today">;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus />
        Add to {label.toLowerCase()}
      </Button>
    );
  }
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await addMilestone({ horizon, title });
          if (!r.ok) return void toast.error(r.error);
          setTitle("");
          setOpen(false);
        });
      }}
    >
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="A milestone in your own words"
        maxLength={200}
        className="h-10"
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />
      <Button type="submit" disabled={!title.trim() || pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Add
      </Button>
    </form>
  );
}
