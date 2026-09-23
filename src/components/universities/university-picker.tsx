"use client";

import { Check, GraduationCap, Loader2, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { UniversitySearchResult } from "@/app/api/universities/search/route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SchoolValue = {
  id: string | null;
  name: string;
  location?: string;
};

type Status = "idle" | "loading" | "done" | "error";

export function UniversityPicker({
  value,
  onChange,
  autoFocus,
}: {
  value: SchoolValue | null;
  onChange: (value: SchoolValue | null) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UniversitySearchResult[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(
          `/api/universities/search?q=${encodeURIComponent(trimmed)}`,
          {
            signal: controller.signal,
          },
        );
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as {
          results: UniversitySearchResult[];
        };
        setResults(body.results);
        setActive(0);
        setStatus("done");
      } catch (err) {
        if ((err as Error).name !== "AbortError") setStatus("error");
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <GraduationCap className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{value.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {value.id
              ? value.location || "Selected"
              : "Added by you — we’ll match it to our directory later"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Change school"
          onClick={() => {
            onChange(null);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          <X />
        </Button>
      </div>
    );
  }

  // Results list plus a final "use what I typed" option.
  const showList = trimmed.length >= 2 && status !== "idle";
  const options = [
    ...results.map((r) => ({
      key: r.id,
      value: { id: r.id, name: r.name, location: r.location },
      result: r,
    })),
    ...(status === "done" || status === "error"
      ? [{ key: "__custom", value: { id: null, name: trimmed }, result: null }]
      : []),
  ];

  const choose = (i: number) => {
    const opt = options[i];
    if (opt) onChange(opt.value);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length < 2) {
              setResults([]);
              setStatus("idle");
            }
          }}
          onKeyDown={(e) => {
            if (!options.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(active);
            }
          }}
          placeholder="Search by name or website (e.g. sdsu)"
          className="h-12 pl-9 text-base"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
        />
        {status === "loading" ? (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="overflow-hidden rounded-xl border bg-card"
        >
          {status === "error" ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">
              Search isn’t available right now. You can still add your school by
              name.
            </li>
          ) : null}
          {status === "done" && results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">
              No matches in our directory yet.
            </li>
          ) : null}
          {options.map((opt, i) => (
            <li
              key={opt.key}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(i);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-b-0",
                i === active && "bg-accent/60",
              )}
            >
              {opt.result ? (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {opt.result.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[opt.result.location, opt.result.domain]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              ) : (
                <p className="flex-1 text-sm">
                  Use “<span className="font-medium">{trimmed}</span>”
                </p>
              )}
              {i === active ? <Check className="size-4 text-primary" /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
