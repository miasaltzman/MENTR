"use client";

import { ArrowRight, Check, Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import {
  UniversityPicker,
  type SchoolValue,
} from "@/components/universities/university-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type Answer,
  type AnswerFor,
  isSkipped,
  NOT_SURE,
  type Option,
  type Step,
} from "@/lib/onboarding/flow";
import { cn } from "@/lib/utils";

type InputProps<K extends Step["kind"]> = {
  step: Extract<Step, { kind: K }>;
  initial: AnswerFor<K> | null;
  pending: boolean;
  onSubmit: (answer: Answer) => void;
};

function ContinueButton({
  disabled,
  pending,
  label = "Continue",
}: {
  disabled?: boolean;
  pending: boolean;
  label?: string;
}) {
  return (
    <Button
      type="submit"
      size="lg"
      className="rounded-full px-6"
      disabled={disabled || pending}
    >
      {pending ? <Loader2 className="animate-spin" /> : null}
      {label}
      {!pending ? <ArrowRight /> : null}
    </Button>
  );
}

function Chip({
  selected,
  onClick,
  children,
  hint,
  disabled,
}: {
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-left text-sm transition-colors",
        "hover:border-primary/40 hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "border-primary bg-accent text-accent-foreground"
          : "bg-card",
      )}
    >
      {selected ? <Check className="size-4 shrink-0 text-primary" /> : null}
      <span>
        {children}
        {hint ? (
          <span className="block text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------

export function TextStepInput({
  step,
  initial,
  pending,
  onSubmit,
}: InputProps<"text">) {
  const [value, setValue] = useState(initial?.value ?? "");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit({ value: value.trim() });
      }}
    >
      <Input
        autoFocus
        value={value}
        maxLength={step.maxLength ?? 200}
        onChange={(e) => setValue(e.target.value)}
        placeholder={step.placeholder}
        className="h-12 text-base"
        aria-label={step.prompt}
      />
      <ContinueButton pending={pending} disabled={!value.trim()} />
    </form>
  );
}

export function LongTextStepInput({
  step,
  initial,
  pending,
  onSubmit,
}: InputProps<"longtext">) {
  const [value, setValue] = useState(initial?.value ?? "");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit({ value: value.trim() });
      }}
    >
      <Textarea
        autoFocus
        value={value}
        maxLength={2000}
        onChange={(e) => setValue(e.target.value)}
        placeholder={step.placeholder}
        className="min-h-28 text-base"
        aria-label={step.prompt}
      />
      <ContinueButton pending={pending} disabled={!value.trim()} />
    </form>
  );
}

export function ChoiceStepInput({
  step,
  initial,
  pending,
  onSubmit,
}: InputProps<"choice">) {
  const options: Option[] = step.allowNotSure
    ? [...step.options, { value: NOT_SURE, label: "Not sure yet" }]
    : step.options;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip
          key={o.value}
          hint={o.hint}
          disabled={pending}
          selected={initial?.value === o.value}
          onClick={() => onSubmit({ value: o.value })}
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

function CustomAdder({
  onAdd,
  placeholder,
}: {
  onAdd: (v: string) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v) onAdd(v);
    setDraft("");
  };
  return (
    <div className="flex gap-2">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        placeholder={placeholder}
        className="h-11"
        maxLength={80}
      />
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        onClick={add}
        aria-label="Add"
      >
        <Plus />
      </Button>
    </div>
  );
}

export function MultiStepInput({
  step,
  initial,
  pending,
  onSubmit,
}: InputProps<"multi">) {
  const [values, setValues] = useState<string[]>(initial?.values ?? []);
  const custom = values.filter(
    (v) => v !== NOT_SURE && !step.options.some((o) => o.value === v),
  );
  const atMax = step.max !== undefined && values.length >= step.max;
  const toggle = (v: string) => {
    if (v === NOT_SURE)
      return setValues(values.includes(NOT_SURE) ? [] : [NOT_SURE]);
    setValues((cur) => {
      const without = cur.filter((x) => x !== NOT_SURE);
      if (without.includes(v)) return without.filter((x) => x !== v);
      if (step.max && without.length >= step.max) return without;
      return [...without, v];
    });
  };
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ values });
      }}
    >
      <div className="flex flex-wrap gap-2">
        {step.options.map((o) => (
          <Chip
            key={o.value}
            selected={values.includes(o.value)}
            disabled={!values.includes(o.value) && atMax}
            onClick={() => toggle(o.value)}
          >
            {o.label}
          </Chip>
        ))}
        {custom.map((v) => (
          <Chip key={v} selected onClick={() => toggle(v)}>
            {v}
          </Chip>
        ))}
        {step.allowNotSure ? (
          <Chip
            selected={values.includes(NOT_SURE)}
            onClick={() => toggle(NOT_SURE)}
          >
            Not sure yet
          </Chip>
        ) : null}
      </div>
      {step.allowCustom && !atMax ? (
        <CustomAdder onAdd={toggle} placeholder="Add your own" />
      ) : null}
      {step.max ? (
        <p className="text-xs text-muted-foreground">
          {values.filter((v) => v !== NOT_SURE).length} of {step.max} selected
        </p>
      ) : null}
      <ContinueButton pending={pending} disabled={values.length === 0} />
    </form>
  );
}

export function TagsStepInput({
  step,
  initial,
  pending,
  onSubmit,
}: InputProps<"tags">) {
  const [values, setValues] = useState<string[]>(initial?.values ?? []);
  const max = step.max ?? 20;
  const has = (v: string) =>
    values.some((x) => x.toLowerCase() === v.toLowerCase());
  const add = (v: string) => {
    if (!has(v) && values.length < max) setValues([...values, v]);
  };
  const remove = (v: string) => setValues(values.filter((x) => x !== v));
  const suggestions = step.suggestions.filter((s) => !has(s));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ values });
      }}
    >
      {values.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Added">
          {values.map((v) => (
            <li key={v}>
              <button
                type="button"
                onClick={() => remove(v)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm text-primary-foreground"
                aria-label={`Remove ${v}`}
              >
                {v}
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {values.length < max ? (
        <CustomAdder
          onAdd={add}
          placeholder={step.placeholder ?? "Type and press Enter"}
        />
      ) : null}
      {suggestions.length ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.slice(0, 14).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed bg-card px-3 py-1.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
            >
              <Plus className="size-3.5" />
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <ContinueButton pending={pending} disabled={values.length === 0} />
    </form>
  );
}

export function SchoolStepInput({
  initial,
  pending,
  onSubmit,
}: InputProps<"school">) {
  const [value, setValue] = useState<SchoolValue | null>(
    initial
      ? { id: initial.id, name: initial.name, location: initial.location }
      : null,
  );
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (value)
          onSubmit({
            id: value.id,
            name: value.name,
            location: value.location,
          });
      }}
    >
      <UniversityPicker value={value} onChange={setValue} autoFocus />
      <ContinueButton pending={pending} disabled={!value} />
    </form>
  );
}

export function StudyStepInput({
  initial,
  pending,
  onSubmit,
}: InputProps<"study">) {
  const [major, setMajor] = useState(initial?.major ?? "");
  const [undeclared, setUndeclared] = useState(
    initial ? initial.major === null : false,
  );
  const [second, setSecond] = useState(initial?.secondMajor ?? "");
  const [showSecond, setShowSecond] = useState(Boolean(initial?.secondMajor));
  const [minors, setMinors] = useState<string[]>(initial?.minors ?? []);
  const canSubmit = undeclared || major.trim().length > 0;
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({
          major: undeclared ? null : major.trim(),
          secondMajor: showSecond && second.trim() ? second.trim() : null,
          minors,
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="major">Major</Label>
        <Input
          id="major"
          autoFocus
          value={undeclared ? "" : major}
          disabled={undeclared}
          onChange={(e) => setMajor(e.target.value)}
          placeholder={
            undeclared ? "Undeclared" : "e.g. Artificial Intelligence"
          }
          className="h-12 text-base"
          maxLength={120}
        />
        <div className="flex flex-wrap gap-2">
          <Chip
            selected={undeclared}
            onClick={() => setUndeclared(!undeclared)}
          >
            Undeclared
          </Chip>
          {!showSecond ? (
            <Chip onClick={() => setShowSecond(true)}>+ Double major</Chip>
          ) : null}
        </div>
      </div>
      {showSecond ? (
        <div className="space-y-2">
          <Label htmlFor="second">Second major</Label>
          <Input
            id="second"
            value={second}
            onChange={(e) => setSecond(e.target.value)}
            className="h-11"
            maxLength={120}
          />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label>Minor(s) — optional</Label>
        {minors.length ? (
          <div className="flex flex-wrap gap-2">
            {minors.map((m) => (
              <Chip
                key={m}
                selected
                onClick={() => setMinors(minors.filter((x) => x !== m))}
              >
                {m}
              </Chip>
            ))}
          </div>
        ) : null}
        {minors.length < 4 ? (
          <CustomAdder
            onAdd={(m) => !minors.includes(m) && setMinors([...minors, m])}
            placeholder="e.g. Data Science"
          />
        ) : null}
      </div>
      <ContinueButton pending={pending} disabled={!canSubmit} />
    </form>
  );
}

const MONTH_OPTIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function SchoolYearStepInput({
  step,
  initial,
  pending,
  onSubmit,
}: InputProps<"schoolYear">) {
  const [year, setYear] = useState<string | null>(initial?.year ?? null);
  const [gradMonth, setGradMonth] = useState(
    initial?.graduation?.slice(5, 7) ?? "05",
  );
  const [gradYear, setGradYear] = useState(
    initial?.graduation?.slice(0, 4) ?? "",
  );
  const now = new Date().getFullYear();
  const isPast = step.key === "grad_date";
  const yearChoices = isPast
    ? Array.from({ length: 8 }, (_, i) => String(now - i))
    : Array.from({ length: 8 }, (_, i) => String(now + i));
  const graduation = gradYear ? `${gradYear}-${gradMonth}` : null;
  const canSubmit = step.years.length ? year !== null : graduation !== null;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit({ year, graduation });
      }}
    >
      {step.years.length ? (
        <div className="flex flex-wrap gap-2">
          {step.years.map((y) => (
            <Chip
              key={y.value}
              selected={year === y.value}
              onClick={() => setYear(y.value)}
            >
              {y.label}
            </Chip>
          ))}
        </div>
      ) : null}
      <div className="space-y-2">
        <Label>{isPast ? "Graduated" : "Expected graduation"}</Label>
        <div className="flex gap-2">
          <select
            value={gradMonth}
            onChange={(e) => setGradMonth(e.target.value)}
            className="h-11 rounded-md border bg-card px-3 text-sm"
            aria-label="Month"
          >
            {MONTH_OPTIONS.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, "0")}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={gradYear}
            onChange={(e) => setGradYear(e.target.value)}
            className="h-11 flex-1 rounded-md border bg-card px-3 text-sm"
            aria-label="Year"
          >
            <option value="">{isPast ? "Year" : "Year (optional)"}</option>
            {yearChoices.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
      <ContinueButton pending={pending} disabled={!canSubmit} />
    </form>
  );
}

export function NumberStepInput({
  step,
  initial,
  pending,
  onSubmit,
}: InputProps<"number">) {
  const [value, setValue] = useState(initial ? String(initial.value) : "");
  const n = Number(value);
  const valid =
    value.trim() !== "" && Number.isFinite(n) && n >= step.min && n <= step.max;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit({ value: n });
      }}
    >
      <Input
        autoFocus
        type="number"
        inputMode="decimal"
        min={step.min}
        max={step.max}
        step={step.stepSize}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={step.placeholder}
        className="h-12 max-w-40 text-base"
        aria-label={step.prompt}
      />
      <ContinueButton pending={pending} disabled={!valid} />
    </form>
  );
}

const RELOCATION: Option[] = [
  { value: "stay", label: "Stay where I am" },
  { value: "specific", label: "Move somewhere specific" },
  { value: "open", label: "Open to moving" },
  { value: "remote", label: "Remote" },
  { value: "not_sure", label: "Not sure yet" },
];

export function LocationStepInput({
  initial,
  pending,
  onSubmit,
}: InputProps<"location">) {
  const [current, setCurrent] = useState(initial?.current ?? "");
  const [relocation, setRelocation] = useState<
    AnswerFor<"location">["relocation"]
  >(initial?.relocation ?? null);
  const [places, setPlaces] = useState<string[]>(initial?.places ?? []);
  const wantsPlaces = relocation === "specific" || relocation === "open";
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          current: current.trim() || null,
          relocation,
          places: wantsPlaces ? places : [],
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="current-location">Where are you based?</Label>
        <Input
          id="current-location"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="City, region"
          className="h-11"
          maxLength={120}
        />
      </div>
      <div className="space-y-2">
        <Label>In the future, do you want to…</Label>
        <div className="flex flex-wrap gap-2">
          {RELOCATION.map((o) => (
            <Chip
              key={o.value}
              selected={relocation === o.value}
              onClick={() =>
                setRelocation(o.value as AnswerFor<"location">["relocation"])
              }
            >
              {o.label}
            </Chip>
          ))}
        </div>
      </div>
      {wantsPlaces ? (
        <div className="space-y-2">
          <Label>
            {relocation === "specific"
              ? "Where?"
              : "Any places on your radar? (optional)"}
          </Label>
          {places.length ? (
            <div className="flex flex-wrap gap-2">
              {places.map((p) => (
                <Chip
                  key={p}
                  selected
                  onClick={() => setPlaces(places.filter((x) => x !== p))}
                >
                  {p}
                </Chip>
              ))}
            </div>
          ) : null}
          {places.length < 8 ? (
            <CustomAdder
              onAdd={(p) => !places.includes(p) && setPlaces([...places, p])}
              placeholder="e.g. Seattle"
            />
          ) : null}
        </div>
      ) : null}
      <ContinueButton
        pending={pending}
        disabled={!current.trim() && !relocation}
      />
    </form>
  );
}

/** Dispatches to the right input for a step. */
export function StepInput({
  step,
  initial,
  pending,
  onSubmit,
}: {
  step: Step;
  initial: Answer | undefined;
  pending: boolean;
  onSubmit: (answer: Answer) => void;
}) {
  const init = initial && !isSkipped(initial) ? initial : null;
  const common = { pending, onSubmit };
  switch (step.kind) {
    case "text":
      return (
        <TextStepInput
          step={step}
          initial={init as AnswerFor<"text"> | null}
          {...common}
        />
      );
    case "longtext":
      return (
        <LongTextStepInput
          step={step}
          initial={init as AnswerFor<"longtext"> | null}
          {...common}
        />
      );
    case "choice":
      return (
        <ChoiceStepInput
          step={step}
          initial={init as AnswerFor<"choice"> | null}
          {...common}
        />
      );
    case "multi":
      return (
        <MultiStepInput
          step={step}
          initial={init as AnswerFor<"multi"> | null}
          {...common}
        />
      );
    case "tags":
      return (
        <TagsStepInput
          step={step}
          initial={init as AnswerFor<"tags"> | null}
          {...common}
        />
      );
    case "school":
      return (
        <SchoolStepInput
          step={step}
          initial={init as AnswerFor<"school"> | null}
          {...common}
        />
      );
    case "study":
      return (
        <StudyStepInput
          step={step}
          initial={init as AnswerFor<"study"> | null}
          {...common}
        />
      );
    case "schoolYear":
      return (
        <SchoolYearStepInput
          step={step}
          initial={init as AnswerFor<"schoolYear"> | null}
          {...common}
        />
      );
    case "number":
      return (
        <NumberStepInput
          step={step}
          initial={init as AnswerFor<"number"> | null}
          {...common}
        />
      );
    case "location":
      return (
        <LocationStepInput
          step={step}
          initial={init as AnswerFor<"location"> | null}
          {...common}
        />
      );
  }
}
