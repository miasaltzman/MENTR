"use client";

import { useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const INTERESTS = [
  "AI",
  "Marketing",
  "Entrepreneurship",
  "Design",
  "Finance",
  "I’m not sure yet",
];
const CERTAINTY = [
  "I know exactly what I want",
  "I have a few ideas",
  "I’m still figuring it out",
];

const FIRST_STEP: Record<string, string> = {
  AI: "Follow one AI product manager on LinkedIn.",
  Marketing: "Save one campaign you wish you’d made.",
  Entrepreneurship: "Notice one everyday frustration today.",
  Design: "Follow one designer whose work you love.",
  Finance: "Follow one person who explains markets well.",
  "I’m not sure yet":
    "Watch one “day in the life” video for any role you’re curious about.",
};

const OPENER: Record<string, string> = {
  "I know exactly what I want": "Great — let’s build toward it.",
  "I have a few ideas": "Good. Let’s test them, one small step at a time.",
  "I’m still figuring it out": "That’s a fine place to start.",
};

function Mentor({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex animate-in items-start gap-3 duration-300 fade-in slide-in-from-bottom-1">
      <LogoMark className="mt-0.5 size-7" />
      <p className="text-lg leading-snug sm:text-xl">{children}</p>
    </div>
  );
}

function Reply({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex animate-in justify-end duration-200 fade-in">
      <p className="rounded-2xl rounded-br-md bg-foreground px-4 py-2 text-background">
        {children}
      </p>
    </div>
  );
}

function Choices({
  options,
  onPick,
}: {
  options: string[];
  onPick: (v: string) => void;
}) {
  return (
    <div className="flex animate-in flex-wrap gap-2 pl-10 duration-300 fade-in">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onPick(o)}
          className={cn(
            "rounded-full bg-muted px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
            "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/** A tiny, interactive taste of onboarding for the landing page. */
export function OnboardingPreview() {
  const [interest, setInterest] = useState<string | null>(null);
  const [certainty, setCertainty] = useState<string | null>(null);

  return (
    <div className="space-y-5" aria-live="polite">
      <Mentor>What are you interested in right now?</Mentor>
      {interest ? (
        <Reply>{interest}</Reply>
      ) : (
        <Choices options={INTERESTS} onPick={setInterest} />
      )}

      {interest ? <Mentor>What sounds most like you?</Mentor> : null}
      {interest && !certainty ? (
        <Choices options={CERTAINTY} onPick={setCertainty} />
      ) : null}
      {certainty ? <Reply>{certainty}</Reply> : null}

      {interest && certainty ? (
        <>
          <Mentor>
            {OPENER[certainty]} Here’s a first step:{" "}
            <span className="font-medium">{FIRST_STEP[interest]}</span>
          </Mentor>
          <button
            type="button"
            onClick={() => {
              setInterest(null);
              setCertainty(null);
            }}
            className="pl-10 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Start over
          </button>
        </>
      ) : null}
    </div>
  );
}
