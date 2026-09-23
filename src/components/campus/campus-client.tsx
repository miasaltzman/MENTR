"use client";

import { Bookmark, BookmarkCheck, Loader2, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  suggestCampusLink,
  toggleSavedCampusResource,
} from "@/lib/campus/actions";

export function SaveResourceButton({
  resourceId,
  saved,
}: {
  resourceId: string;
  saved: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [isSaved, setSaved] = useState(saved);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={isSaved ? "Remove from saved" : "Save"}
      aria-pressed={isSaved}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await toggleSavedCampusResource(resourceId, !isSaved);
          if (r.ok) setSaved(!isSaved);
          else toast.error("Couldn’t update saved items.");
        })
      }
    >
      {isSaved ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
    </Button>
  );
}

export function SuggestLinkForm({ universityId }: { universityId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus />
        Suggest a link
      </Button>
    );
  }
  return (
    <form
      className="space-y-3 rounded-2xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await suggestCampusLink({ universityId, name, url });
          if (!r.ok) return void toast.error(r.error);
          toast.success(
            "Thanks! We’ll verify it before it appears for anyone.",
          );
          setName("");
          setUrl("");
          setOpen(false);
        });
      }}
    >
      <p className="text-sm text-muted-foreground">
        Know a useful page on your school’s site? Suggestions are reviewed and
        verified before they’re shown to other students.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="sug-name">What is it?</Label>
        <Input
          id="sug-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Career center"
          maxLength={200}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sug-url">Link</Label>
        <Input
          id="sug-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
          inputMode="url"
          maxLength={500}
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={pending || !name.trim() || !url.trim()}
        >
          {pending ? <Loader2 className="animate-spin" /> : null}
          Submit
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
