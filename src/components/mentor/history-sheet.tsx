"use client";

import { History, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { deleteConversation } from "@/lib/mentor/actions";
import { cn } from "@/lib/utils";

type Conversation = {
  id: string;
  title: string | null;
  last_message_at: string;
};

export function MentorToolbar({
  conversations,
  activeId,
}: {
  conversations: Conversation[];
  activeId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center justify-between gap-2">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <History />
            Past conversations
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle>Conversations</SheetTitle>
          </SheetHeader>
          <ul className="space-y-1 overflow-y-auto px-2 pb-6">
            {conversations.length === 0 ? (
              <li className="px-2 text-sm text-muted-foreground">
                No conversations yet.
              </li>
            ) : null}
            {conversations.map((c) => (
              <li key={c.id} className="group flex items-center gap-1">
                <Link
                  href={`/mentor?c=${c.id}`}
                  className={cn(
                    "min-w-0 flex-1 rounded-lg px-3 py-2 text-sm hover:bg-muted",
                    c.id === activeId && "bg-muted font-medium",
                  )}
                >
                  <span className="block truncate">
                    {c.title || "Untitled"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(c.last_message_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete conversation ${c.title ?? ""}`}
                  className="opacity-60 group-hover:opacity-100"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteConversation(c.id);
                      if (c.id === activeId) router.push("/mentor");
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
      <Button asChild variant="outline" size="sm">
        <Link href="/mentor?new=1">
          <Plus />
          New chat
        </Link>
      </Button>
    </div>
  );
}
